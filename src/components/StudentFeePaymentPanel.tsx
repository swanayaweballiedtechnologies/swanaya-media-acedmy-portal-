/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  CreditCard,
  Smartphone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Lock,
  Receipt,
  RefreshCw,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { Course, FeePaymentTransaction, Invoice, Student, SwanayaDatabase } from '../db/mockDb';
import {
  buildUpiPaymentUri,
  generateUpiQrDataUrl,
  getVerifiedAcademyUpi,
  paymentService,
} from '../services/paymentService';
import { downloadFeeReceiptPdf } from '../utils/pdfReceipt';

interface StudentFeePaymentPanelProps {
  studentUser: Student;
  currentUser: any;
  studentCourse?: Course | null;
  onRefreshAllData: () => void;
}

export default function StudentFeePaymentPanel({
  studentUser,
  currentUser,
  studentCourse,
  onRefreshAllData,
}: StudentFeePaymentPanelProps) {
  const [transactions, setTransactions] = useState<FeePaymentTransaction[]>([]);
  const [invoice, setInvoice] = useState<Invoice>(() =>
    paymentService.ensureStudentInvoice(studentUser, studentCourse)
  );
  const [selectedMethod, setSelectedMethod] = useState<'GPAY_UPI' | 'UPI_QR' | 'UPI_INTENT' | 'RAZORPAY_UPI'>('GPAY_UPI');
  const [payableAmount, setPayableAmount] = useState<number>(() =>
    Math.max(0, Number(studentUser.outstandingBalance || 0))
  );
  const [activeRequest, setActiveRequest] = useState<FeePaymentTransaction | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [upiCopied, setUpiCopied] = useState(false);

  // UTR Submission states
  const [utrInput, setUtrInput] = useState('');
  const [upiAppUsed, setUpiAppUsed] = useState('Google Pay (GPay)');
  const [proofNote, setProofNote] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<{ razorpayConfigured: boolean; keyId: string | null }>({
    razorpayConfigured: false,
    keyId: null,
  });
  const [razorpayBusy, setRazorpayBusy] = useState(false);

  const [notice, setNotice] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);

  const academyUpi = useMemo(() => getVerifiedAcademyUpi(), []);

  // Refresh latest student balance and invoice
  const freshStudent = useMemo(() => {
    const allStudents = SwanayaDatabase.get<Student[]>('students') || [];
    return allStudents.find((s) => s.id === studentUser.id) || studentUser;
  }, [studentUser, transactions]);

  const outstandingBalance = Math.max(0, Number(freshStudent.outstandingBalance || 0));

  useEffect(() => {
    setInvoice(paymentService.ensureStudentInvoice(freshStudent, studentCourse));
    if (!activeRequest) {
      setPayableAmount(outstandingBalance);
    }
  }, [freshStudent.id, outstandingBalance, studentCourse?.id]);

  useEffect(() => {
    paymentService.fetchGatewayStatus().then(setGatewayStatus);
    const unsub = paymentService.subscribeTransactions({
      studentUserId: currentUser?.id || freshStudent.userId || freshStudent.id,
      onData: (list) => {
        // Also match by studentId in case auth uid differs from local student record
        const allLocal = SwanayaDatabase.get<FeePaymentTransaction[]>('paymentTransactions') || [];
        const combinedMap = new Map<string, FeePaymentTransaction>();
        [...list, ...allLocal].forEach((tx) => {
          if (
            tx.studentId === freshStudent.id ||
            tx.userId === (currentUser?.id || freshStudent.userId)
          ) {
            combinedMap.set(tx.id, tx);
          }
        });
        const sorted = Array.from(combinedMap.values()).sort((a, b) =>
          String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))
        );
        setTransactions(sorted);
      },
    });
    return () => unsub();
  }, [freshStudent.id, currentUser?.id]);

  // Generate UPI QR whenever activeRequest changes
  useEffect(() => {
    let active = true;
    if (!activeRequest) {
      setQrDataUrl('');
      return;
    }
    const { standardUpiUri } = buildUpiPaymentUri({
      amount: activeRequest.amount,
      invoiceNumber: activeRequest.invoiceNumber,
      studentName: freshStudent.name,
      upiAccount: academyUpi,
    });
    generateUpiQrDataUrl(standardUpiUri)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [activeRequest?.id, activeRequest?.amount, activeRequest?.invoiceNumber]);

  const verifiedPaidTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.status === 'VERIFIED')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [transactions]
  );

  const pendingVerificationTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.status === 'PENDING_VERIFICATION')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [transactions]
  );

  const handleGeneratePaymentInvoice = async (methodOverride?: FeePaymentTransaction['paymentMethod']) => {
    setNotice(null);
    const chosenMethod = methodOverride || selectedMethod;
    const amt = Number(payableAmount);

    if (!(amt > 0)) {
      setNotice({ type: 'error', text: 'Enter a valid payable fee amount greater than ₹0.' });
      return;
    }
    if (outstandingBalance > 0 && amt > outstandingBalance) {
      setNotice({
        type: 'error',
        text: `Payable amount (₹${amt.toLocaleString('en-IN')}) cannot exceed your remaining balance (₹${outstandingBalance.toLocaleString('en-IN')}).`,
      });
      return;
    }

    setCreatingRequest(true);
    try {
      const tx = await paymentService.createPaymentRequest({
        invoiceId: invoice.id,
        student: freshStudent,
        userId: currentUser?.id || freshStudent.userId || freshStudent.id,
        course: studentCourse,
        amount: amt,
        paymentMethod: chosenMethod,
      });
      setActiveRequest(tx);
      setUtrInput('');
      setNotice({
        type: 'info',
        text: `Invoice ${tx.invoiceNumber} created for ₹${tx.amount.toLocaleString('en-IN')}. Complete payment via Google Pay / UPI QR below and submit your 12-digit UTR for verification.`,
      });
      onRefreshAllData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to generate fee payment invoice.' });
    } finally {
      setCreatingRequest(false);
    }
  };

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(academyUpi.upiId);
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest) return;
    setNotice(null);
    setSubmittingUtr(true);

    try {
      const updated = await paymentService.submitUtrReference({
        transaction: activeRequest,
        utrNumber: utrInput,
        upiAppName: upiAppUsed,
        proofNote,
      });
      setActiveRequest(updated);
      setUtrInput('');
      setProofNote('');
      setNotice({
        type: 'success',
        text: `UTR "${updated.utrNumber}" submitted for Invoice ${updated.invoiceNumber}. Status is now PENDING ADMIN VERIFICATION. Your outstanding balance will update automatically once Finance Admin approves it.`,
      });
      onRefreshAllData();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to submit UTR reference number.',
      });
    } finally {
      setSubmittingUtr(false);
    }
  };

  const handleRazorpayCheckout = async () => {
    if (!activeRequest) return;
    setNotice(null);
    setRazorpayBusy(true);
    try {
      const verifiedTx = await paymentService.initiateRazorpayUpiCheckout({
        transaction: activeRequest,
        student: freshStudent,
      });
      setActiveRequest(verifiedTx);
      setNotice({
        type: 'success',
        text: `Instant Razorpay UPI payment verified! Receipt #${verifiedTx.receiptNumber} generated and your fee balance has been updated.`,
      });
      onRefreshAllData();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Razorpay checkout was not completed.',
      });
    } finally {
      setRazorpayBusy(false);
    }
  };

  const handleDownloadPdf = (tx: FeePaymentTransaction) => {
    try {
      downloadFeeReceiptPdf(tx, freshStudent, outstandingBalance);
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to download receipt PDF.' });
    }
  };

  const upiLinks = activeRequest
    ? buildUpiPaymentUri({
        amount: activeRequest.amount,
        invoiceNumber: activeRequest.invoiceNumber,
        studentName: freshStudent.name,
        upiAccount: academyUpi,
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Header & Security Notice */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Academy UPI Desk
            </span>
            <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3" /> Zero UPI PIN Storage
            </span>
          </div>
          <h3 className="text-lg font-serif font-bold text-white">
            Fee Collection · Google Pay (GPay) &amp; UPI Payment Portal
          </h3>
          <p className="text-xs text-slate-400">
            Pay course fees securely to Swanaya Media Academy&apos;s verified UPI account. Balances update and official PDF receipts unlock strictly after payment verification.
          </p>
        </div>

        <div className="bg-slate-950 border border-emerald-500/30 rounded-lg px-4 py-3 shrink-0 space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified Academy UPI ID
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-white">{academyUpi.upiId}</span>
            <button
              type="button"
              onClick={handleCopyUpi}
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
              title="Copy Verified Academy UPI ID"
            >
              {upiCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">{academyUpi.payeeName}</p>
        </div>
      </div>

      {/* KPI Fee Ledger Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Program Total Fee</span>
          <p className="text-xl font-bold font-mono text-white">
            ₹{Number(studentCourse?.fee || invoice.amount || outstandingBalance).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500 truncate">{studentCourse?.name || 'Enrolled Course'}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Outstanding Payable</span>
          <p className="text-xl font-bold font-mono text-amber-400">
            ₹{outstandingBalance.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500">Updates only after verified payment</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Verified Paid</span>
          <p className="text-xl font-bold font-mono text-emerald-400">
            ₹{verifiedPaidTotal.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500">Approved &amp; PDF receipt ready</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">Pending Verification</span>
          <p className="text-xl font-bold font-mono text-cyan-300">
            ₹{pendingVerificationTotal.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-500">Submitted UTR awaiting Admin check</p>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg p-3.5 border text-xs flex items-start justify-between gap-3 ${
            notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Split: Payment Method & Invoice Generator / Active Payment & UTR Submission */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Choose Payment Method & Exact Amount */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-850 pb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
              Step 1 · Select Payment Method &amp; Amount
            </span>
            <h4 className="text-base font-serif font-bold text-white mt-0.5">
              Choose Google Pay / UPI Option
            </h4>
          </div>

          {/* Payment Options List — Google Pay highlighted prominently */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                setSelectedMethod('GPAY_UPI');
                setUpiAppUsed('Google Pay (GPay)');
              }}
              className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                selectedMethod === 'GPAY_UPI'
                  ? 'bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 shadow">
                  <span className="text-xs font-extrabold tracking-tight">
                    <span className="text-blue-600">G</span>
                    <span className="text-slate-800">Pay</span>
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    Google Pay (GPay) Direct UPI
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-mono uppercase">
                      Recommended
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400">Pay via GPay App or GPay QR · Verified by Admin UTR</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('UPI_QR')}
              className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                selectedMethod === 'UPI_QR'
                  ? 'bg-cyan-500/10 border-cyan-400 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Dynamic UPI QR Code Scan</p>
                  <p className="text-[11px] text-slate-400">Scan from PhonePe, GPay, Paytm, BHIM or Bank App</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('UPI_INTENT')}
              className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                selectedMethod === 'UPI_INTENT'
                  ? 'bg-indigo-500/10 border-indigo-400'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Compatible UPI Applications</p>
                  <p className="text-[11px] text-slate-400">PhonePe, Paytm, Amazon Pay, BHIM UPI Intent Link</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('RAZORPAY_UPI')}
              className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                selectedMethod === 'RAZORPAY_UPI'
                  ? 'bg-emerald-500/10 border-emerald-400'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    Razorpay Automated UPI Gateway
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                        gatewayStatus.razorpayConfigured
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {gatewayStatus.razorpayConfigured ? 'Auto-Confirm Active' : 'Manual UTR Mode'}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {gatewayStatus.razorpayConfigured
                      ? 'Instant cryptographic payment confirmation'
                      : 'Requires server Razorpay keys; use GPay/UPI QR for direct transfer'}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Exact Payable Amount Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-850">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                Exact Payable Amount (INR ₹)
              </label>
              {outstandingBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setPayableAmount(outstandingBalance)}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-mono cursor-pointer"
                >
                  Use Full Balance (₹{outstandingBalance.toLocaleString('en-IN')})
                </button>
              )}
            </div>
            <input
              type="number"
              min={1}
              step="1"
              value={payableAmount || ''}
              onChange={(e) => setPayableAmount(Number(e.target.value))}
              placeholder="Enter fee amount in ₹"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
            />
            <p className="text-[10px] text-slate-500">
              A unique invoice number will be generated and locked to this exact payable amount.
            </p>
          </div>

          <button
            type="button"
            disabled={creatingRequest || !(payableAmount > 0)}
            onClick={() => void handleGeneratePaymentInvoice()}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/15 disabled:opacity-50"
          >
            {creatingRequest ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>
              {activeRequest
                ? 'Generate New Payment Invoice'
                : `Proceed to Pay ₹${Number(payableAmount || 0).toLocaleString('en-IN')}`}
            </span>
          </button>
        </div>

        {/* Right: Active Invoice, UPI QR Code, GPay Intent & UTR Submission */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          {!activeRequest ? (
            <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-amber-400" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h4 className="text-base font-serif font-bold text-white">
                  Generate Your Unique Fee Invoice &amp; UPI QR
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Select <strong>Google Pay (GPay)</strong>, <strong>UPI QR</strong>, or another UPI option on the left, confirm the exact payable amount, and click <strong>Proceed to Pay</strong> to display your scannable QR code and deep-link.
                </p>
              </div>
              <div className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
                Verified Academy Payee: {academyUpi.upiId}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Unique Invoice Header */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Unique Invoice Number
                  </span>
                  <p className="text-sm font-mono font-bold text-cyan-300">{activeRequest.invoiceNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Exact Payable Amount
                  </span>
                  <p className="text-lg font-mono font-extrabold text-amber-400">
                    ₹{Number(activeRequest.amount).toLocaleString('en-IN')}.00
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                    Verification Status
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase ${
                      activeRequest.status === 'VERIFIED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : activeRequest.status === 'PENDING_VERIFICATION'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : activeRequest.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {activeRequest.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Verified State Banner */}
              {activeRequest.status === 'VERIFIED' ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center space-y-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-base font-serif font-bold text-white">
                      Payment Verified &amp; Settled!
                    </h4>
                    <p className="text-xs text-slate-300">
                      Receipt <strong className="font-mono text-emerald-300">{activeRequest.receiptNumber}</strong> · UTR:{' '}
                      <strong className="font-mono">{activeRequest.utrNumber}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(activeRequest)}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded-lg cursor-pointer inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Official PDF Receipt</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* QR Code + Deep Link Apps */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                    <div className="md:col-span-5 flex flex-col items-center space-y-2">
                      <div className="bg-white p-3 rounded-xl shadow-lg">
                        {qrDataUrl ? (
                          <img
                            src={qrDataUrl}
                            alt={`UPI QR for ${activeRequest.invoiceNumber}`}
                            className="w-44 h-44 object-contain"
                          />
                        ) : (
                          <div className="w-44 h-44 flex items-center justify-center text-slate-500 text-xs">
                            Generating QR...
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 text-center">
                        Scan with GPay, PhonePe, Paytm or BHIM
                      </span>
                    </div>

                    <div className="md:col-span-7 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">
                          Pay via Google Pay (GPay) or Compatible UPI App
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Verified Payee: <strong className="text-emerald-300 font-mono">{academyUpi.upiId}</strong>
                        </p>
                      </div>

                      {upiLinks && (
                        <div className="flex flex-col gap-2">
                          <a
                            href={upiLinks.gpayUri}
                            onClick={() => {
                              setUpiAppUsed('Google Pay (GPay)');
                              setNotice({
                                type: 'info',
                                text: 'Google Pay link launched. After completing payment in GPay, enter your 12-digit UTR below so Admin can verify it.',
                              });
                            }}
                            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow"
                          >
                            <span className="font-extrabold">
                              <span className="text-blue-600">G</span>Pay
                            </span>
                            <span>Open Google Pay App (₹{activeRequest.amount.toLocaleString('en-IN')})</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                          </a>

                          <a
                            href={upiLinks.standardUpiUri}
                            onClick={() => {
                              setNotice({
                                type: 'info',
                                text: 'UPI app intent triggered. After payment completes, submit your UPI Transaction Reference Number (UTR) below for Admin verification.',
                              });
                            }}
                            className="w-full py-2.5 px-4 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                          >
                            <Smartphone className="w-4 h-4 text-cyan-400" />
                            <span>Pay via Any UPI App (PhonePe / Paytm / BHIM)</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          {gatewayStatus.razorpayConfigured && (
                            <button
                              type="button"
                              disabled={razorpayBusy}
                              onClick={() => void handleRazorpayCheckout()}
                              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                            >
                              <CreditCard className="w-4 h-4" />
                              <span>{razorpayBusy ? 'Opening Razorpay...' : 'Instant Pay via Razorpay UPI'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      <p className="text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                        Important: Clicking a payment app button does NOT mark your fee paid. Direct UPI payments require valid UTR submission and Admin verification.
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Submit UTR Reference Form */}
                  <form
                    onSubmit={handleSubmitUtr}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-amber-400" />
                        <span>Step 2 · Submit UPI Transaction Reference (UTR)</span>
                      </h5>
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Never enter UPI PIN
                      </span>
                    </div>

                    {activeRequest.status === 'PENDING_VERIFICATION' && (
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>
                          UTR <strong className="font-mono">{activeRequest.utrNumber}</strong> is currently{' '}
                          <strong>Pending Admin Verification</strong>. You can update it below only if you entered a typo.
                        </span>
                      </div>
                    )}

                    {activeRequest.status === 'REJECTED' && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-200 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>
                          Previous submission was declined: <strong>{activeRequest.rejectionReason}</strong>. Re-check and submit a valid UTR below.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                          UPI Transaction Ref / UTR Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value.toUpperCase())}
                          placeholder="e.g. 432198765432"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                          UPI App Used
                        </label>
                        <select
                          value={upiAppUsed}
                          onChange={(e) => setUpiAppUsed(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                        >
                          <option value="Google Pay (GPay)">Google Pay (GPay)</option>
                          <option value="PhonePe">PhonePe</option>
                          <option value="Paytm">Paytm</option>
                          <option value="BHIM UPI">BHIM UPI</option>
                          <option value="Bank Mobile App UPI">Bank Mobile App UPI</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                        Optional Payer Note / Reference Remark
                      </label>
                      <input
                        type="text"
                        value={proofNote}
                        onChange={(e) => setProofNote(e.target.value)}
                        placeholder="e.g. Paid from father's GPay account"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingUtr || !utrInput.trim()}
                      className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {submittingUtr ? 'Verifying Format & Submitting...' : 'Submit UTR for Admin Verification'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Requests & Verified PDF Receipts History */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-850 pb-3">
          <div>
            <h4 className="text-sm font-serif font-bold text-white">
              My Fee Invoices, UTR Submissions &amp; Official PDF Receipts
            </h4>
            <p className="text-[11px] text-slate-400">
              Downloadable PDF receipts become available as soon as your GPay / UPI payment is verified.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {transactions.length} Transaction(s)
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No UPI payment requests generated yet. Create a payment invoice above to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                  <th className="p-3">Invoice Number</th>
                  <th className="p-3">Method &amp; UTR Ref</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action / Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-950/50">
                    <td className="p-3 space-y-0.5">
                      <p className="font-mono font-bold text-cyan-300">{tx.invoiceNumber}</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(tx.createdAt).toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="p-3 space-y-0.5">
                      <p className="text-slate-200 font-semibold">
                        {tx.upiAppName || tx.paymentMethod.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">
                        UTR: {tx.utrNumber || 'Not submitted yet'}
                      </p>
                      {tx.rejectionReason && (
                        <p className="text-[10px] text-rose-400">Reason: {tx.rejectionReason}</p>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-amber-400">
                      ₹{Number(tx.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          tx.status === 'VERIFIED'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : tx.status === 'PENDING_VERIFICATION'
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : tx.status === 'REJECTED'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {tx.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {tx.status === 'VERIFIED' ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(tx)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold uppercase rounded cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF Receipt</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveRequest(tx)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold uppercase rounded cursor-pointer"
                        >
                          {tx.status === 'AWAITING_PAYMENT' ? 'Open QR / Submit UTR' : 'View / Update UTR'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
