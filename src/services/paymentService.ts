/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import QRCode from 'qrcode';
import { collection, doc, onSnapshot, query, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  AcademySettings,
  Course,
  FeePaymentTransaction,
  Invoice,
  Notification,
  Student,
  SwanayaDatabase,
} from '../db/mockDb';

export interface VerifiedAcademyUpiAccount {
  upiId: string;
  payeeName: string;
  merchantCode: string;
  verified: boolean;
}

export function getVerifiedAcademyUpi(): VerifiedAcademyUpiAccount {
  const settings = SwanayaDatabase.get<AcademySettings>('settings');
  return {
    upiId: (settings?.upiId || 'swanayamedia@okaxis').trim(),
    payeeName: (settings?.upiPayeeName || settings?.academyName || 'Swanaya Media Academy').trim(),
    merchantCode: (settings?.upiMerchantCode || '8299').trim(),
    verified: settings?.upiVerified !== false,
  };
}

export function generateUniqueInvoiceNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timePart = String(Date.now()).slice(-4);
  return `INV-SMA-${datePart}-${randPart}${timePart}`;
}

export function buildUpiPaymentUri(params: {
  amount: number;
  invoiceNumber: string;
  studentName: string;
  upiAccount?: VerifiedAcademyUpiAccount;
}): { standardUpiUri: string; gpayUri: string } {
  const upi = params.upiAccount || getVerifiedAcademyUpi();
  const exactAmount = Number(params.amount).toFixed(2);
  const note = `Swanaya Fee ${params.invoiceNumber} - ${params.studentName}`.slice(0, 60);

  const queryParams = new URLSearchParams({
    pa: upi.upiId,
    pn: upi.payeeName,
    mc: upi.merchantCode,
    tr: params.invoiceNumber,
    tn: note,
    am: exactAmount,
    cu: 'INR',
  });

  return {
    standardUpiUri: `upi://pay?${queryParams.toString()}`,
    gpayUri: `tez://upi/pay?${queryParams.toString()}`,
  };
}

export async function generateUpiQrDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

function mergeTransactions(lists: FeePaymentTransaction[][]): FeePaymentTransaction[] {
  const map = new Map<string, FeePaymentTransaction>();
  lists.flat().forEach((tx) => {
    if (!tx || !tx.id) return;
    const existing = map.get(tx.id);
    if (!existing || String(tx.updatedAt || '') >= String(existing.updatedAt || '')) {
      map.set(tx.id, tx);
    }
  });
  return Array.from(map.values()).sort((a, b) =>
    String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))
  );
}

function applyVerifiedPaymentToLedgers(tx: FeePaymentTransaction): void {
  // Guard: strictly ONLY apply to student balance & invoice if status is VERIFIED
  if (tx.status !== 'VERIFIED') return;

  const invoices = SwanayaDatabase.get<Invoice[]>('invoices') || [];
  let invoiceFound = false;
  let deltaApplied = false;

  const updatedInvoices = invoices.map((inv) => {
    if (inv.id !== tx.invoiceId && inv.invoiceNumber !== tx.invoiceNumber) return inv;
    invoiceFound = true;
    // Prevent duplicate application of the same transaction ID
    const alreadyRecorded = inv.payments.some(
      (p) => p.id === tx.id || (tx.utrNumber && p.utrNumber && p.utrNumber === tx.utrNumber)
    );
    if (alreadyRecorded) return inv;

    deltaApplied = true;
    const newPaidAmount = inv.paidAmount + Number(tx.amount);
    const newStatus: Invoice['status'] = newPaidAmount >= inv.amount ? 'PAID' : 'PARTIAL';
    return {
      ...inv,
      paidAmount: newPaidAmount,
      status: newStatus,
      payments: [
        ...inv.payments,
        {
          id: tx.id,
          amount: Number(tx.amount),
          date: (tx.verifiedAt || new Date().toISOString()).split('T')[0],
          method: `${tx.paymentMethod.replace(/_/g, ' ')}${tx.upiAppName ? ` (${tx.upiAppName})` : ''}`,
          receiptNo: tx.receiptNumber || `REC-${Date.now()}`,
          utrNumber: tx.utrNumber,
          verifiedBy: tx.verifiedBy,
        },
      ],
    };
  });

  if (!invoiceFound) {
    deltaApplied = true;
    updatedInvoices.unshift({
      id: tx.invoiceId,
      invoiceNumber: tx.invoiceNumber,
      studentId: tx.studentId,
      courseId: tx.courseId,
      amount: Number(tx.amount),
      dueDate: new Date().toISOString().split('T')[0],
      status: 'PAID',
      paidAmount: Number(tx.amount),
      payments: [
        {
          id: tx.id,
          amount: Number(tx.amount),
          date: (tx.verifiedAt || new Date().toISOString()).split('T')[0],
          method: `${tx.paymentMethod.replace(/_/g, ' ')}${tx.upiAppName ? ` (${tx.upiAppName})` : ''}`,
          receiptNo: tx.receiptNumber || `REC-${Date.now()}`,
          utrNumber: tx.utrNumber,
          verifiedBy: tx.verifiedBy,
        },
      ],
    });
  }

  SwanayaDatabase.set('invoices', updatedInvoices);

  if (deltaApplied) {
    const students = SwanayaDatabase.get<Student[]>('students') || [];
    const updatedStudents = students.map((st) => {
      if (st.id !== tx.studentId && st.userId !== tx.userId) return st;
      return {
        ...st,
        outstandingBalance: Math.max(0, Number(st.outstandingBalance || 0) - Number(tx.amount)),
      };
    });
    SwanayaDatabase.set('students', updatedStudents);
  }
}

function pushNotification(targetUserId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR') {
  const existing = SwanayaDatabase.get<Notification[]>('notifications') || [];
  const notif: Notification = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: targetUserId,
    title,
    message,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  };
  SwanayaDatabase.set('notifications', [notif, ...existing]);
}

export const paymentService = {
  async fetchGatewayStatus(): Promise<{ razorpayConfigured: boolean; keyId: string | null }> {
    try {
      const res = await fetch('/api/payments/gateway-status');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return { razorpayConfigured: false, keyId: null };
  },

  ensureStudentInvoice(student: Student, course?: Course | null): Invoice {
    const invoices = SwanayaDatabase.get<Invoice[]>('invoices') || [];
    const existing = invoices.find((inv) => inv.studentId === student.id && inv.status !== 'PAID');
    if (existing) {
      if (!existing.invoiceNumber) {
        existing.invoiceNumber = generateUniqueInvoiceNumber();
        SwanayaDatabase.set(
          'invoices',
          invoices.map((inv) => (inv.id === existing.id ? existing : inv))
        );
      }
      return existing;
    }

    const paidInvoice = invoices.find((inv) => inv.studentId === student.id);
    if (paidInvoice && Number(student.outstandingBalance || 0) <= 0) {
      return paidInvoice;
    }

    const payableTotal = Math.max(Number(student.outstandingBalance || 0), Number(course?.fee || 0), 0);
    const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: generateUniqueInvoiceNumber(),
      studentId: student.id,
      courseId: student.courseId || course?.id || 'general',
      amount: payableTotal,
      dueDate,
      status: payableTotal > 0 ? 'PENDING' : 'PAID',
      paidAmount: 0,
      payments: [],
    };
    SwanayaDatabase.set('invoices', [newInvoice, ...invoices]);
    return newInvoice;
  },

  subscribeTransactions(params: {
    studentUserId?: string;
    onData: (txs: FeePaymentTransaction[]) => void;
    onError?: (err: Error) => void;
  }): () => void {
    const emitCurrent = (extraLists: FeePaymentTransaction[][] = []) => {
      const localList = SwanayaDatabase.get<FeePaymentTransaction[]>('paymentTransactions') || [];
      const merged = mergeTransactions([localList, ...extraLists]);
      SwanayaDatabase.set('paymentTransactions', merged);
      const filtered = params.studentUserId
        ? merged.filter((t) => t.userId === params.studentUserId || t.studentId === params.studentUserId)
        : merged;
      params.onData(filtered);
    };

    emitCurrent();

    // Sync from backend server store
    fetch('/api/payments/transactions')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.transactions)) {
          emitCurrent([data.transactions]);
        }
      })
      .catch(() => {});

    const onStorage = () => emitCurrent();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      window.addEventListener('sma-autosave', onStorage);
    }

    let unsubFirestore = () => {};
    if (auth.currentUser) {
      try {
        const q = query(collection(db, 'fee_payments'));
        unsubFirestore = onSnapshot(
          q,
          (snapshot) => {
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as FeePaymentTransaction));
            emitCurrent([list]);
          },
          (err) => {
            console.warn('Fee payments Firestore sync notice:', err?.message);
          }
        );
      } catch (err: any) {
        params.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }

    return () => {
      unsubFirestore();
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('sma-autosave', onStorage);
      }
    };
  },

  async createPaymentRequest(input: {
    invoiceId: string;
    student: Student;
    userId: string;
    course?: Course | null;
    amount: number;
    paymentMethod: FeePaymentTransaction['paymentMethod'];
  }): Promise<FeePaymentTransaction> {
    const amountNum = Number(Number(input.amount).toFixed(2));
    if (!(amountNum > 0)) {
      throw new Error('Payable amount must be greater than ₹0.');
    }

    const upi = getVerifiedAcademyUpi();
    const invoiceNumber = generateUniqueInvoiceNumber();
    const nowIso = new Date().toISOString();
    const existing = SwanayaDatabase.get<FeePaymentTransaction[]>('paymentTransactions') || [];

    if (existing.some((t) => t.invoiceNumber === invoiceNumber)) {
      throw new Error('Generated invoice number collided. Please retry.');
    }

    const tx: FeePaymentTransaction = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceNumber,
      invoiceId: input.invoiceId,
      studentId: input.student.id,
      userId: input.userId || input.student.userId || input.student.id,
      studentName: input.student.name,
      studentEmail: input.student.email,
      courseId: input.course?.id || input.student.courseId || 'general',
      courseName: input.course?.name || 'Academy Program',
      amount: amountNum,
      currency: 'INR',
      paymentMethod: input.paymentMethod,
      upiIdPaidTo: upi.upiId,
      status: 'AWAITING_PAYMENT',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Persist locally
    SwanayaDatabase.set('paymentTransactions', [tx, ...existing]);
    SwanayaDatabase.log(
      tx.studentEmail || 'student@swanayamedia.com',
      tx.studentName,
      'PAYMENT_REQUEST_CREATED',
      `Generated Invoice ${tx.invoiceNumber} for exact payable ₹${tx.amount.toLocaleString('en-IN')} (${tx.paymentMethod})`
    );

    // Sync to Express server
    try {
      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: tx }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) throw new Error(err.error || 'Duplicate invoice number.');
      }
    } catch (err: any) {
      if (err?.message?.includes('Duplicate')) throw err;
    }

    // Mirror to Firestore if signed in
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'fee_payments', tx.id), { ...tx, userId: auth.currentUser.uid });
      } catch (err: any) {
        console.warn('Firestore fee_payments create notice:', err?.message);
      }
    }

    return tx;
  },

  async submitUtrReference(params: {
    transaction: FeePaymentTransaction;
    utrNumber: string;
    upiAppName: string;
    proofNote?: string;
  }): Promise<FeePaymentTransaction> {
    const cleanUtr = params.utrNumber.trim().toUpperCase();
    if (!/^[A-Z0-9]{10,26}$/.test(cleanUtr)) {
      throw new Error('Please enter a valid 10–26 character UPI Transaction Reference / UTR number (e.g. 12-digit UTR).');
    }

    const allTxs = SwanayaDatabase.get<FeePaymentTransaction[]>('paymentTransactions') || [];
    const duplicate = allTxs.find(
      (t) =>
        t.id !== params.transaction.id &&
        t.status !== 'REJECTED' &&
        String(t.utrNumber || '').trim().toUpperCase() === cleanUtr
    );
    if (duplicate) {
      throw new Error(
        `Duplicate transaction entry blocked: UTR "${cleanUtr}" has already been submitted for Invoice ${duplicate.invoiceNumber}.`
      );
    }

    if (params.transaction.status === 'VERIFIED') {
      throw new Error('This payment has already been verified and settled.');
    }

    // Check server-side first to guarantee global duplicate protection
    const apiRes = await fetch('/api/payments/utr-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: params.transaction.id,
        utrNumber: cleanUtr,
        upiAppName: params.upiAppName,
        proofNote: params.proofNote || '',
        transactionFallback: params.transaction,
      }),
    }).catch(() => null);

    if (apiRes && !apiRes.ok) {
      const errJson = await apiRes.json().catch(() => ({}));
      throw new Error(errJson.error || 'Duplicate or invalid UTR reference.');
    }

    const nowIso = new Date().toISOString();
    const updated: FeePaymentTransaction = {
      ...params.transaction,
      utrNumber: cleanUtr,
      upiAppName: params.upiAppName,
      proofNote: params.proofNote?.trim() || '',
      status: 'PENDING_VERIFICATION',
      rejectionReason: undefined,
      updatedAt: nowIso,
    };

    const nextList = allTxs.some((t) => t.id === updated.id)
      ? allTxs.map((t) => (t.id === updated.id ? updated : t))
      : [updated, ...allTxs];
    SwanayaDatabase.set('paymentTransactions', nextList);

    SwanayaDatabase.log(
      updated.studentEmail || 'student@swanayamedia.com',
      updated.studentName,
      'UPI_UTR_SUBMITTED',
      `Submitted UTR ${cleanUtr} (${params.upiAppName}) for Invoice ${updated.invoiceNumber} (₹${updated.amount}) — Awaiting Admin Verification`
    );

    // Notify Admins (NOTE: student balance is NOT updated yet!)
    pushNotification(
      'usr-md',
      'New GPay / UPI Fee Verification Request',
      `${updated.studentName} submitted UTR ${cleanUtr} for ₹${updated.amount.toLocaleString('en-IN')} (${updated.invoiceNumber}). Review in Payment Verification Dashboard.`,
      'INFO'
    );

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'fee_payments', updated.id), { ...updated, userId: auth.currentUser.uid });
      } catch (err: any) {
        console.warn('Firestore UTR update notice:', err?.message);
      }
    }

    return updated;
  },

  async verifyPaymentByAdmin(params: {
    transaction: FeePaymentTransaction;
    adminUser: { id?: string; name?: string; email?: string };
  }): Promise<FeePaymentTransaction> {
    if (params.transaction.status === 'VERIFIED') {
      throw new Error('This transaction is already verified.');
    }

    const allTxs = SwanayaDatabase.get<FeePaymentTransaction[]>('paymentTransactions') || [];
    const cleanUtr = String(params.transaction.utrNumber || '').trim().toUpperCase();
    if (cleanUtr) {
      const dup = allTxs.find(
        (t) =>
          t.id !== params.transaction.id &&
          t.status === 'VERIFIED' &&
          String(t.utrNumber || '').trim().toUpperCase() === cleanUtr
      );
      if (dup) {
        throw new Error(`Duplicate UTR blocked: ${cleanUtr} is already verified on ${dup.invoiceNumber}.`);
      }
    }

    const apiRes = await fetch('/api/payments/admin-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: params.transaction.id,
        decision: 'VERIFY',
        adminName: params.adminUser?.name || 'Finance Admin',
        adminEmail: params.adminUser?.email || 'admin@swanayamedia.com',
        adminId: params.adminUser?.id || 'admin',
        transactionFallback: params.transaction,
      }),
    }).catch(() => null);

    let serverTx: FeePaymentTransaction | null = null;
    if (apiRes) {
      const json = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        throw new Error(json.error || 'Server rejected verification.');
      }
      serverTx = json.transaction || null;
    }

    const nowIso = new Date().toISOString();
    const receiptNumber =
      serverTx?.receiptNumber ||
      `REC-SMA-${nowIso.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const updated: FeePaymentTransaction = {
      ...params.transaction,
      ...(serverTx || {}),
      status: 'VERIFIED',
      receiptNumber,
      verifiedBy: params.adminUser?.name || 'Academy Finance Admin',
      verifiedById: params.adminUser?.id || 'admin',
      verifiedAt: serverTx?.verifiedAt || nowIso,
      rejectionReason: undefined,
      updatedAt: nowIso,
    };

    const nextList = allTxs.some((t) => t.id === updated.id)
      ? allTxs.map((t) => (t.id === updated.id ? updated : t))
      : [updated, ...allTxs];
    SwanayaDatabase.set('paymentTransactions', nextList);

    // Update Student Outstanding Balance & Invoice ONLY now after verification!
    applyVerifiedPaymentToLedgers(updated);

    SwanayaDatabase.log(
      params.adminUser?.email || 'admin@swanayamedia.com',
      params.adminUser?.name || 'Finance Admin',
      'PAYMENT_VERIFIED_APPROVED',
      `Verified Invoice ${updated.invoiceNumber} · UTR ${cleanUtr || 'MANUAL'} · ₹${updated.amount.toLocaleString('en-IN')} · Receipt ${updated.receiptNumber}`
    );

    pushNotification(
      updated.userId || updated.studentId,
      'Fee Payment Verified & Receipt Ready',
      `Your payment of ₹${updated.amount.toLocaleString('en-IN')} (${updated.invoiceNumber}) has been verified! Receipt #${updated.receiptNumber} is now available for PDF download.`,
      'SUCCESS'
    );

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'fee_payments', updated.id), updated);
      } catch (err: any) {
        console.warn('Firestore verification sync notice:', err?.message);
      }
    }

    return updated;
  },

  async rejectPaymentByAdmin(params: {
    transaction: FeePaymentTransaction;
    adminUser: { id?: string; name?: string; email?: string };
    reason: string;
  }): Promise<FeePaymentTransaction> {
    if (params.transaction.status === 'VERIFIED') {
      throw new Error('Cannot reject an already verified payment.');
    }

    const cleanReason = params.reason.trim() || 'UTR reference did not match academy bank statement.';

    await fetch('/api/payments/admin-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionId: params.transaction.id,
        decision: 'REJECT',
        adminName: params.adminUser?.name || 'Finance Admin',
        adminEmail: params.adminUser?.email || 'admin@swanayamedia.com',
        adminId: params.adminUser?.id || 'admin',
        rejectionReason: cleanReason,
        transactionFallback: params.transaction,
      }),
    }).catch(() => null);

    const nowIso = new Date().toISOString();
    const updated: FeePaymentTransaction = {
      ...params.transaction,
      status: 'REJECTED',
      rejectionReason: cleanReason,
      verifiedBy: params.adminUser?.name || 'Academy Finance Admin',
      verifiedById: params.adminUser?.id || 'admin',
      verifiedAt: nowIso,
      updatedAt: nowIso,
    };

    const allTxs = SwanayaDatabase.get<FeePaymentTransaction[]>('paymentTransactions') || [];
    const nextList = allTxs.some((t) => t.id === updated.id)
      ? allTxs.map((t) => (t.id === updated.id ? updated : t))
      : [updated, ...allTxs];
    SwanayaDatabase.set('paymentTransactions', nextList);

    SwanayaDatabase.log(
      params.adminUser?.email || 'admin@swanayamedia.com',
      params.adminUser?.name || 'Finance Admin',
      'PAYMENT_REJECTED',
      `Rejected ${updated.invoiceNumber} (UTR ${updated.utrNumber || 'N/A'}): ${cleanReason}`
    );

    pushNotification(
      updated.userId || updated.studentId,
      'Fee Payment Verification Declined',
      `Your payment submission for ${updated.invoiceNumber} was declined: ${cleanReason}. Please verify your UTR reference and resubmit.`,
      'WARNING'
    );

    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'fee_payments', updated.id), updated);
      } catch (err: any) {
        console.warn('Firestore rejection sync notice:', err?.message);
      }
    }

    return updated;
  },

  async initiateRazorpayUpiCheckout(params: {
    transaction: FeePaymentTransaction;
    student: Student;
  }): Promise<FeePaymentTransaction> {
    const orderRes = await fetch('/api/payments/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountInr: params.transaction.amount,
        invoiceNumber: params.transaction.invoiceNumber,
        studentId: params.student.id,
        courseId: params.transaction.courseId,
      }),
    });
    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok || !orderData?.order?.id) {
      throw new Error(orderData?.error || 'Razorpay gateway is not configured.');
    }

    // Dynamically load Razorpay checkout script if needed
    await new Promise<void>((resolve, reject) => {
      if ((window as any).Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay Checkout SDK.'));
      document.body.appendChild(script);
    });

    return await new Promise<FeePaymentTransaction>((resolve, reject) => {
      const options = {
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: 'INR',
        name: 'Swanaya Media Academy',
        description: `Fee Invoice ${params.transaction.invoiceNumber}`,
        order_id: orderData.order.id,
        prefill: {
          name: params.student.name,
          email: params.student.email,
          contact: params.student.phone || '',
        },
        method: {
          upi: true,
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionId: params.transaction.id,
                ...response,
                transactionFallback: params.transaction,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok || !verifyData.verified) {
              reject(new Error(verifyData.error || 'Payment signature verification failed.'));
              return;
            }
            const verifiedTx: FeePaymentTransaction = verifyData.transaction;
            const allTxs = SwanayaDatabase.get<FeePaymentTransaction[]>('paymentTransactions') || [];
            SwanayaDatabase.set(
              'paymentTransactions',
              allTxs.some((t) => t.id === verifiedTx.id)
                ? allTxs.map((t) => (t.id === verifiedTx.id ? verifiedTx : t))
                : [verifiedTx, ...allTxs]
            );
            applyVerifiedPaymentToLedgers(verifiedTx);
            SwanayaDatabase.log(
              params.student.email,
              params.student.name,
              'RAZORPAY_UPI_VERIFIED',
              `Razorpay UPI payment verified for ${verifiedTx.invoiceNumber} (${response.razorpay_payment_id})`
            );
            resolve(verifiedTx);
          } catch (err: any) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Razorpay payment window was closed before completion.')),
        },
        theme: {
          color: '#f59e0b',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    });
  },
};
