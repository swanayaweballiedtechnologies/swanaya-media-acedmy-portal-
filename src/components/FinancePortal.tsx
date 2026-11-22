/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Plus,
  FileText,
  CheckCircle,
  Search,
  CreditCard,
  Receipt,
  Calendar,
  ShieldCheck,
  Clock,
  XCircle,
  Download,
  Copy,
  Check,
  AlertCircle,
  History,
} from 'lucide-react';
import {
  AuditLog,
  Course,
  FeePaymentTransaction,
  Invoice,
  Student,
  SwanayaDatabase,
} from '../db/mockDb';
import {
  generateUniqueInvoiceNumber,
  getVerifiedAcademyUpi,
  paymentService,
} from '../services/paymentService';
import { downloadFeeReceiptPdf } from '../utils/pdfReceipt';

interface FinancePortalProps {
  currentUser: any;
  onRefreshAllData: () => void;
}

export default function FinancePortal({ currentUser, onRefreshAllData }: FinancePortalProps) {
  const [students, setStudents] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>('students'));
  const [invoices, setInvoices] = useState<Invoice[]>(() => SwanayaDatabase.get<Invoice[]>('invoices'));
  const [courses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>('courses'));
  const [transactions, setTransactions] = useState<FeePaymentTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => SwanayaDatabase.get<AuditLog[]>('auditLogs'));

  const [activeTab, setActiveTab] = useState<'verification' | 'invoices' | 'audit'>('verification');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'AWAITING_PAYMENT'>('PENDING_VERIFICATION');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Manual Payment Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState(45000);
  const [paymentMethod, setPaymentMethod] = useState('Google Pay (GPay) / UPI');
  const [manualUtr, setManualUtr] = useState('');
  const [manualModalError, setManualModalError] = useState<string | null>(null);

  const academyUpi = useMemo(() => getVerifiedAcademyUpi(), []);

  useEffect(() => {
    const unsub = paymentService.subscribeTransactions({
      onData: (list) => {
        setTransactions(list);
        setStudents(SwanayaDatabase.get<Student[]>('students'));
        setInvoices(SwanayaDatabase.get<Invoice[]>('invoices'));
        setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));
      },
    });
    return () => unsub();
  }, []);

  const syncLocalSnapshots = () => {
    setStudents(SwanayaDatabase.get<Student[]>('students'));
    setInvoices(SwanayaDatabase.get<Invoice[]>('invoices'));
    setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));
  };

  // Metrics
  const totalRevenueExpected = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalRevenueCollected = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalOutstanding = Math.max(
    totalRevenueExpected - totalRevenueCollected,
    students.reduce((sum, st) => sum + Number(st.outstandingBalance || 0), 0)
  );
  const pendingVerifications = transactions.filter((t) => t.status === 'PENDING_VERIFICATION');
  const verifiedTransactions = transactions.filter((t) => t.status === 'VERIFIED');

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleVerifyTransaction = async (tx: FeePaymentTransaction) => {
    setNotice(null);
    setProcessingId(tx.id);
    try {
      const verified = await paymentService.verifyPaymentByAdmin({
        transaction: tx,
        adminUser: currentUser,
      });
      syncLocalSnapshots();
      setNotice({
        type: 'success',
        text: `Verified Invoice ${verified.invoiceNumber} (UTR: ${verified.utrNumber || 'N/A'}) · Receipt ${verified.receiptNumber} issued & student balance updated.`,
      });
      onRefreshAllData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to verify payment.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTransaction = async (tx: FeePaymentTransaction) => {
    setNotice(null);
    setProcessingId(tx.id);
    try {
      await paymentService.rejectPaymentByAdmin({
        transaction: tx,
        adminUser: currentUser,
        reason: rejectReason || 'UTR did not match Academy bank statement.',
      });
      setRejectingId(null);
      setRejectReason('');
      syncLocalSnapshots();
      setNotice({
        type: 'info',
        text: `Declined Invoice ${tx.invoiceNumber}. Student balance remains unchanged and student was notified.`,
      });
      onRefreshAllData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to reject payment.' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDownloadReceipt = (tx: FeePaymentTransaction) => {
    try {
      const st = students.find((s) => s.id === tx.studentId || s.userId === tx.userId);
      downloadFeeReceiptPdf(tx, st, st?.outstandingBalance);
      syncLocalSnapshots();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to generate PDF receipt.' });
    }
  };

  const handleOpenPaymentModal = () => {
    setManualModalError(null);
    setManualUtr('');
    setIsPaymentModalOpen(true);
    setPaymentSaved(false);
    if (!selectedInvoiceId && invoices[0]?.id) {
      setSelectedInvoiceId(invoices[0].id);
    }
  };

  const handleLogPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setManualModalError(null);

    const targetInvoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!targetInvoice) {
      setManualModalError('Select a valid student invoice first.');
      return;
    }

    const cleanUtr = manualUtr.trim().toUpperCase();
    if (cleanUtr) {
      const dupTx = transactions.find(
        (t) => t.status !== 'REJECTED' && String(t.utrNumber || '').trim().toUpperCase() === cleanUtr
      );
      const dupInv = invoices.some((inv) =>
        inv.payments.some((p) => p.utrNumber && p.utrNumber.toUpperCase() === cleanUtr)
      );
      if (dupTx || dupInv) {
        setManualModalError(`Duplicate transaction blocked: UTR ${cleanUtr} is already recorded.`);
        return;
      }
    }

    const receiptNo = `REC-SMA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const newPayment = {
      id: `pay-${Date.now()}`,
      amount: Number(paymentAmount),
      date: nowIso.split('T')[0],
      method: paymentMethod,
      receiptNo,
      utrNumber: cleanUtr || undefined,
      verifiedBy: currentUser?.name || 'Finance Admin',
    };

    const newPaidAmount = targetInvoice.paidAmount + Number(paymentAmount);
    const newStatus: Invoice['status'] = newPaidAmount >= targetInvoice.amount ? 'PAID' : 'PARTIAL';

    const updatedInvoices = invoices.map((inv) =>
      inv.id === selectedInvoiceId
        ? {
            ...inv,
            invoiceNumber: inv.invoiceNumber || generateUniqueInvoiceNumber(),
            paidAmount: newPaidAmount,
            status: newStatus,
            payments: [...inv.payments, newPayment],
          }
        : inv
    );

    SwanayaDatabase.set('invoices', updatedInvoices);
    setInvoices(updatedInvoices);

    const updatedStudents = students.map((st) =>
      st.id === targetInvoice.studentId
        ? {
            ...st,
            outstandingBalance: Math.max(Number(st.outstandingBalance || 0) - Number(paymentAmount), 0),
          }
        : st
    );

    SwanayaDatabase.set('students', updatedStudents);
    setStudents(updatedStudents);

    const studentObj = students.find((s) => s.id === targetInvoice.studentId);
    const courseObj = courses.find((c) => c.id === targetInvoice.courseId);

    // Also record verified transaction entry so PDF receipt download is available immediately
    const verifiedTx: FeePaymentTransaction = {
      id: newPayment.id,
      invoiceNumber: targetInvoice.invoiceNumber || targetInvoice.id,
      invoiceId: targetInvoice.id,
      studentId: targetInvoice.studentId,
      userId: studentObj?.userId || targetInvoice.studentId,
      studentName: studentObj?.name || 'Enrolled Student',
      studentEmail: studentObj?.email || '',
      courseId: targetInvoice.courseId,
      courseName: courseObj?.name || '',
      amount: Number(paymentAmount),
      currency: 'INR',
      paymentMethod: paymentMethod.includes('GPay') ? 'GPAY_UPI' : 'BANK_TRANSFER',
      upiIdPaidTo: academyUpi.upiId,
      utrNumber: cleanUtr || receiptNo,
      upiAppName: paymentMethod,
      status: 'VERIFIED',
      receiptNumber: receiptNo,
      verifiedBy: currentUser?.name || 'Finance Admin',
      verifiedById: currentUser?.id || 'admin',
      verifiedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const allTxs = SwanayaDatabase.get<FeePaymentTransaction[]>('paymentTransactions') || [];
    SwanayaDatabase.set('paymentTransactions', [verifiedTx, ...allTxs]);
    setTransactions([verifiedTx, ...allTxs]);

    SwanayaDatabase.log(
      currentUser?.email || 'finance@swanayamedia.com',
      currentUser?.name || 'Finance Admin',
      'PAYMENT_RECORD',
      `Verified manual payment ₹${paymentAmount} for Invoice ${verifiedTx.invoiceNumber} · UTR ${cleanUtr || 'N/A'} · Receipt ${receiptNo}`
    );

    setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));
    setPaymentSaved(true);
    onRefreshAllData();
    setTimeout(() => {
      setIsPaymentModalOpen(false);
      setPaymentSaved(false);
    }, 1500);
  };

  const getStatusStyle = (status: Invoice['status']) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400';
      case 'PARTIAL':
        return 'bg-amber-500/10 border border-amber-500/20 text-amber-400';
      default:
        return 'bg-rose-500/10 border border-rose-500/20 text-rose-400';
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesStatus = statusFilter === 'ALL' || tx.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      tx.studentName.toLowerCase().includes(q) ||
      tx.invoiceNumber.toLowerCase().includes(q) ||
      (tx.utrNumber || '').toLowerCase().includes(q) ||
      (tx.receiptNumber || '').toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const filteredInvoices = invoices.filter((inv) => {
    const student = students.find((s) => s.id === inv.studentId);
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      (student?.name || '').toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q) ||
      (inv.invoiceNumber || '').toLowerCase().includes(q)
    );
  });

  const paymentAuditLogs = auditLogs.filter((l) =>
    l.action.includes('PAYMENT') || l.action.includes('UPI') || l.action.includes('FEE') || l.action.includes('RAZORPAY')
  );

  return (
    <div className="space-y-6">
      {/* Finance KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-mono font-bold">
            PENDING GPAY / UPI VERIFICATION
          </p>
          <h3 className="text-2xl font-bold font-serif text-cyan-300 tracking-tight mt-1">
            {pendingVerifications.length} Requests
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            ₹{pendingVerifications.reduce((s, t) => s + Number(t.amount || 0), 0).toLocaleString('en-IN')} awaiting review
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">
            VERIFIED REVENUE COLLECTED
          </p>
          <h3 className="text-2xl font-bold font-serif text-emerald-400 tracking-tight mt-1">
            ₹{Math.max(totalRevenueCollected, verifiedTransactions.reduce((s, t) => s + t.amount, 0)).toLocaleString('en-IN')}
          </h3>
          <p className="text-[10px] text-emerald-500 mt-1">
            {verifiedTransactions.length} verified UPI / bank receipts
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">
            TOTAL OUTSTANDING LEDGER
          </p>
          <h3 className="text-2xl font-bold font-serif text-amber-400 tracking-tight mt-1">
            ₹{totalOutstanding.toLocaleString('en-IN')}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">Deducted strictly on verified payment</p>
        </div>

        <div className="bg-slate-900/60 border border-emerald-500/20 p-5 rounded-xl">
          <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED ACADEMY UPI
          </p>
          <h3 className="text-sm font-bold font-mono text-white tracking-tight mt-2 truncate">
            {academyUpi.upiId}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 truncate">{academyUpi.payeeName}</p>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-lg p-3.5 border text-xs flex items-center justify-between gap-3 ${
            notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Sub-Tabs & Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] p-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#F4F3F7] dark:bg-[#1D1D2B] p-1 rounded-lg border border-[#E5E1EA] dark:border-[#38384B]">
          <button
            type="button"
            onClick={() => setActiveTab('verification')}
            className={`px-3.5 py-2 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'verification' ? 'bg-[var(--sma-role-accent)] text-white dark:text-[#151521]' : 'text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>UPI Verification Queue</span>
            {pendingVerifications.length > 0 && (
              <span className="px-1.5 py-0.2 bg-[#477DBB] dark:bg-[#75A7E0] text-white dark:text-[#151521] rounded-full text-[10px] font-mono font-extrabold">
                {pendingVerifications.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`px-3.5 py-2 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'invoices' ? 'bg-[var(--sma-role-accent)] text-white dark:text-[#151521]' : 'text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA]'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Student Invoices ({invoices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-md text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit' ? 'bg-[var(--sma-role-accent)] text-white dark:text-[#151521]' : 'text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Transaction Audit Logs ({paymentAuditLogs.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-grow lg:flex-grow-0">
            <Search className="w-4 h-4 text-[#555770] dark:text-[#B8B5C5] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search student, invoice or UTR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full lg:w-64 bg-[#FFFFFF] dark:bg-[#191927] border border-[#E5E1EA] dark:border-[#38384B] rounded-lg pl-9 pr-4 py-2 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[var(--sma-role-accent)] font-mono"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenPaymentModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--sma-role-accent)] hover:bg-[var(--sma-role-accent-hover)] text-white dark:text-[#151521] text-xs font-bold uppercase rounded-lg cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Bank / UPI Receipt</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADMIN PAYMENT VERIFICATION DASHBOARD */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'AWAITING_PAYMENT', 'ALL'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold uppercase cursor-pointer border transition-colors ${
                  statusFilter === st
                    ? 'bg-[var(--sma-role-accent-soft)] border-[var(--sma-role-accent)] text-[var(--sma-role-accent-text)]'
                    : 'bg-[#FFFFFF] dark:bg-[#242436] border-[#E5E1EA] dark:border-[#38384B] text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA]'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center space-y-2">
              <CreditCard className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-serif font-bold text-slate-300">
                No {statusFilter === 'ALL' ? '' : statusFilter.replace(/_/g, ' ').toLowerCase()} UPI transactions found
              </p>
              <p className="text-xs text-slate-500">
                When students pay via Google Pay (GPay) or UPI QR and submit their UTR reference, verification requests appear here immediately.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-300">{tx.invoiceNumber}</span>
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
                      <span className="text-[11px] font-mono text-slate-400">
                        {tx.upiAppName || tx.paymentMethod.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {tx.studentName}{' '}
                        <span className="text-xs font-normal text-slate-400">({tx.courseName || tx.courseId})</span>
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                        <span>
                          Amount:{' '}
                          <strong className="text-amber-400 font-mono">
                            ₹{Number(tx.amount).toLocaleString('en-IN')}.00
                          </strong>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1.5">
                          UTR / Ref:{' '}
                          <strong className="text-white font-mono">{tx.utrNumber || 'Not Submitted'}</strong>
                          {tx.utrNumber && (
                            <button
                              type="button"
                              onClick={() => void handleCopy(tx.id, tx.utrNumber!)}
                              className="text-slate-400 hover:text-amber-300 cursor-pointer"
                              title="Copy UTR"
                            >
                              {copiedId === tx.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </span>
                        <span>·</span>
                        <span>Paid to: {tx.upiIdPaidTo}</span>
                      </div>
                      {tx.proofNote && (
                        <p className="text-[11px] text-slate-400 mt-1 italic">Note: &ldquo;{tx.proofNote}&rdquo;</p>
                      )}
                      {tx.receiptNumber && (
                        <p className="text-[11px] text-emerald-400 font-mono mt-1">
                          Official Receipt: {tx.receiptNumber} · Verified by {tx.verifiedBy}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Admin Verification Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    {tx.status === 'PENDING_VERIFICATION' && (
                      <>
                        {rejectingId === tx.id ? (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for rejection..."
                              className="bg-slate-950 border border-rose-500/40 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={processingId === tx.id}
                              onClick={() => void handleRejectTransaction(tx)}
                              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold uppercase rounded cursor-pointer"
                            >
                              Confirm Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason('');
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 text-slate-300 text-xs rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={processingId === tx.id}
                              onClick={() => void handleVerifyTransaction(tx)}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded-lg cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>{processingId === tx.id ? 'Verifying...' : 'Verify & Issue Receipt'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={processingId === tx.id}
                              onClick={() => setRejectingId(tx.id)}
                              className="px-3.5 py-2 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {tx.status === 'VERIFIED' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(tx)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download PDF Receipt</span>
                      </button>
                    )}

                    {tx.status === 'AWAITING_PAYMENT' && (
                      <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Student has not submitted UTR yet
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVOICE LEDGER TABLE */}
      {activeTab === 'invoices' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
                <th className="p-4">Invoice ID &amp; Due Date</th>
                <th className="p-4">Student &amp; Course</th>
                <th className="p-4">Total Amount</th>
                <th className="p-4">Verified Paid</th>
                <th className="p-4">Remaining Balance</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Receipts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredInvoices.map((inv) => {
                const student = students.find((s) => s.id === inv.studentId);
                const course = courses.find((c) => c.id === inv.courseId);
                const remaining = Math.max(0, inv.amount - inv.paidAmount);
                return (
                  <tr key={inv.id} className="hover:bg-slate-900/20">
                    <td className="p-4 space-y-1">
                      <p className="font-bold text-slate-200 font-mono">{inv.invoiceNumber || inv.id}</p>
                      <p className="text-slate-500 text-[10px] flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Due {inv.dueDate}
                      </p>
                    </td>
                    <td className="p-4 space-y-0.5">
                      <p className="font-bold text-slate-300">{student?.name || 'Student'}</p>
                      <span className="text-[10px] text-slate-500">
                        {course?.code} · {course?.name}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-semibold text-slate-300">
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4 font-mono text-emerald-400 font-semibold">
                      ₹{inv.paidAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4 font-mono text-amber-500 font-bold">
                      ₹{remaining.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${getStatusStyle(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-y-1">
                      {inv.payments.map((p) => (
                        <div key={p.id} className="text-[10px] font-mono text-slate-400">
                          <strong className="text-slate-200">{p.receiptNo}</strong> · ₹{p.amount.toLocaleString('en-IN')}
                          {p.utrNumber ? ` · UTR ${p.utrNumber}` : ''}
                        </div>
                      ))}
                      {inv.payments.length === 0 && (
                        <span className="text-[10px] text-slate-500 italic">No verified receipts yet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: TRANSACTION AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Actor</th>
                <th className="p-4">Event Action</th>
                <th className="p-4">Transaction Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {paymentAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No fee payment audit events logged yet.
                  </td>
                </tr>
              ) : (
                paymentAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/20">
                    <td className="p-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="p-4">
                      <p className="font-bold text-slate-200">{log.userName}</p>
                      <p className="text-[10px] font-mono text-slate-500">{log.userEmail}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">{log.entity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Payment Entry Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif">
              Record Verified Bank / GPay Receipt
            </h3>

            {manualModalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300">
                {manualModalError}
              </div>
            )}

            {paymentSaved ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
                <h4 className="text-sm font-bold text-slate-200">Transaction Verified &amp; Cleared</h4>
                <p className="text-slate-500 text-xs">Official receipt logged and student balance updated.</p>
              </div>
            ) : (
              <form onSubmit={handleLogPayment} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Student Invoice</label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  >
                    {invoices.map((inv) => {
                      const st = students.find((s) => s.id === inv.studentId);
                      return (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber || inv.id} · {st?.name || 'Student'} (Due: ₹{Math.max(0, inv.amount - inv.paidAmount)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Transaction Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">UPI Reference / UTR (Optional for Cash)</label>
                  <input
                    type="text"
                    value={manualUtr}
                    onChange={(e) => setManualUtr(e.target.value.toUpperCase())}
                    placeholder="e.g. 432198765432"
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Clearance Route</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="Google Pay (GPay) / UPI">Google Pay (GPay) / UPI</option>
                    <option value="PhonePe / Paytm / BHIM UPI">PhonePe / Paytm / BHIM UPI</option>
                    <option value="Direct Bank NEFT / RTGS">Direct Bank Transfer NEFT</option>
                    <option value="POS Debit Card Clearance">POS Debit Card</option>
                    <option value="Cash Counter Ledger">Cash Deposit</option>
                  </select>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                  >
                    Verify &amp; Receipt
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
