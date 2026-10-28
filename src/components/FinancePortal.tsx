/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DollarSign, Plus, FileText, CheckCircle, Search, CreditCard, Receipt, Calendar } from 'lucide-react';
import { SwanayaDatabase, Student, Invoice, Course } from '../db/mockDb';

interface FinancePortalProps {
  currentUser: any;
  onRefreshAllData: () => void;
}

export default function FinancePortal({ currentUser, onRefreshAllData }: FinancePortalProps) {
  const [students, setStudents] = useState<Student[]>(() => SwanayaDatabase.get<Student[]>("students"));
  const [invoices, setInvoices] = useState<Invoice[]>(() => SwanayaDatabase.get<Invoice[]>("invoices"));
  const [courses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses"));

  const [searchQuery, setSearchQuery] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  
  // Payment Form States
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(invoices[0]?.id || '');
  const [paymentAmount, setPaymentAmount] = useState(45000);
  const [paymentMethod, setPaymentMethod] = useState('UPI / PhonePe / GPay');

  // Math Metrics
  const totalRevenueExpected = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalRevenueCollected = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalOutstanding = totalRevenueExpected - totalRevenueCollected;

  const handleOpenPaymentModal = () => {
    setIsPaymentModalOpen(true);
    setPaymentSaved(false);
  };

  const handleLogPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const targetInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
    if (!targetInvoice) return;

    const receiptNo = `REC-${Math.floor(10000 + Math.random() * 90000)}`;
    const newPayment = {
      id: `pay-${Date.now()}`,
      amount: Number(paymentAmount),
      date: new Date().toISOString().split('T')[0],
      method: paymentMethod,
      receiptNo
    };

    const newPaidAmount = targetInvoice.paidAmount + Number(paymentAmount);
    let newStatus: Invoice['status'] = 'PARTIAL';
    if (newPaidAmount >= targetInvoice.amount) {
      newStatus = 'PAID';
    }

    // Update Invoice
    const updatedInvoices = invoices.map(inv => inv.id === selectedInvoiceId ? {
      ...inv,
      paidAmount: newPaidAmount,
      status: newStatus,
      payments: [...inv.payments, newPayment]
    } : inv);

    SwanayaDatabase.set("invoices", updatedInvoices);
    setInvoices(updatedInvoices);

    // Update Student outstanding balance
    const updatedStudents = students.map(st => st.id === targetInvoice.studentId ? {
      ...st,
      outstandingBalance: Math.max(st.outstandingBalance - Number(paymentAmount), 0)
    } : st);

    SwanayaDatabase.set("students", updatedStudents);
    setStudents(updatedStudents);

    // Audit Log
    SwanayaDatabase.log(currentUser.email, currentUser.name, "PAYMENT_RECORD", `Log payment of ₹${paymentAmount} for Invoice ID: ${selectedInvoiceId}`);

    setPaymentSaved(true);
    onRefreshAllData();
    setTimeout(() => {
      setIsPaymentModalOpen(false);
      setPaymentSaved(false);
    }, 2000);
  };

  const getStatusStyle = (status: Invoice['status']) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400';
      case 'PARTIAL': return 'bg-amber-500/10 border border-amber-500/20 text-amber-400';
      default: return 'bg-rose-500/10 border border-rose-500/20 text-rose-400';
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const student = students.find(s => s.id === inv.studentId);
    return student?.name.toLowerCase().includes(searchQuery.toLowerCase()) || inv.id.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      
      {/* Finance KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">TOTAL ACADEMY RECEIVABLES</p>
          <h3 className="text-2xl font-bold font-serif text-white tracking-tight mt-1">₹{totalRevenueExpected.toLocaleString('en-IN')}</h3>
          <p className="text-[10px] text-slate-400 mt-2">Combined syllabus fee structures</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">TOTAL REVENUE COLLECTED</p>
          <h3 className="text-2xl font-bold font-serif text-emerald-400 tracking-tight mt-1">₹{totalRevenueCollected.toLocaleString('en-IN')}</h3>
          <p className="text-[10px] text-emerald-500 mt-2">Bank clearance approved</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">TOTAL OUTSTANDING LEDGER</p>
          <h3 className="text-2xl font-bold font-serif text-amber-500 tracking-tight mt-1">₹{totalOutstanding.toLocaleString('en-IN')}</h3>
          <p className="text-[10px] text-rose-400 mt-2">Dues follow-up active</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
        <div className="relative flex-grow sm:flex-grow-0 w-full sm:w-auto">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Search invoice student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 max-w-xs font-mono"
          />
        </div>

        <button
          onClick={handleOpenPaymentModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors w-full sm:w-auto justify-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Log UPI / Bank Receipt
        </button>
      </div>

      {/* Invoice Grid Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[9px] tracking-wider">
              <th className="p-4">Invoice ID & Due Date</th>
              <th className="p-4">Student & Course</th>
              <th className="p-4">Total Amount</th>
              <th className="p-4">Paid Amount</th>
              <th className="p-4">Remaining Balance</th>
              <th className="p-4">Payment Status</th>
              <th className="p-4 text-right">Transactions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {filteredInvoices.map((inv) => {
              const student = students.find(s => s.id === inv.studentId);
              const course = courses.find(c => c.id === inv.courseId);
              const remaining = inv.amount - inv.paidAmount;
              return (
                <tr key={inv.id} className="hover:bg-slate-900/20">
                  <td className="p-4 space-y-1">
                    <p className="font-bold text-slate-200 font-mono">{inv.id}</p>
                    <p className="text-slate-500 text-[10px] flex items-center gap-1"><Calendar className="w-3 h-3" /> Due {inv.dueDate}</p>
                  </td>
                  <td className="p-4 space-y-0.5">
                    <p className="font-bold text-slate-300">{student?.name}</p>
                    <span className="text-[10px] text-slate-500">{course?.code} · {course?.name}</span>
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
                    {inv.payments.map((p, idx) => (
                      <div key={p.id} className="text-[9px] font-mono text-slate-500 block">
                        Receipt: <strong className="text-slate-300">{p.receiptNo}</strong> · UPI (₹{p.amount.toLocaleString('en-IN')})
                      </div>
                    ))}
                    {inv.payments.length === 0 && (
                      <span className="text-[10px] text-slate-500 italic">No receipts generated</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Payment Entry Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif">
              Log Digital Payment Entry
            </h3>

            {paymentSaved ? (
              <div className="text-center py-8 space-y-3">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
                <h4 className="text-sm font-bold text-slate-200">Transaction Cleared</h4>
                <p className="text-slate-500 text-xs">Receipt logged and student ledger balanced instantly.</p>
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
                    {invoices.map(inv => {
                      const st = students.find(s=>s.id===inv.studentId);
                      return (
                        <option key={inv.id} value={inv.id}>
                          {inv.id} · {st?.name} (Due: ₹{inv.amount - inv.paidAmount})
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
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
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
                    <option value="UPI / PhonePe / GPay">UPI / GPay / PhonePe</option>
                    <option value="Direct Bank NEFT / RTGS">Direct Bank Transfer NEFT</option>
                    <option value="POS Debit Card Clearance">POS Debit Card</option>
                    <option value="Cash Counter Ledger">Cash Deposit</option>
                  </select>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                  >
                    Verify & Receipt
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
