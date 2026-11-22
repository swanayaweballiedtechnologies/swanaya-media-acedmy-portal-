/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import { AcademySettings, FeePaymentTransaction, Student, SwanayaDatabase } from '../db/mockDb';

export function downloadFeeReceiptPdf(
  tx: FeePaymentTransaction,
  student?: Student | null,
  remainingBalance?: number
): void {
  if (tx.status !== 'VERIFIED' || !tx.receiptNumber) {
    throw new Error('Official PDF receipt can only be generated for verified payments.');
  }

  const settings = SwanayaDatabase.get<AcademySettings>('settings');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Header Band
  doc.setFillColor(15, 23, 42); // Slate-900 dark navy
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setFillColor(245, 158, 11); // Gold accent strip
  doc.rect(0, 42, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(settings.academyName || 'SWANAYA MEDIA ACADEMY', 16, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text('A Division of Swanaya Media Enterprises · Official Fee Collection Receipt', 16, 25);
  doc.text(
    `${settings.address || 'Thiruvananthapuram, Kerala, India'} | ${settings.email || 'academy@swanayamedia.com'} | ${settings.phone || '+91 94460 00000'}`,
    16,
    31
  );

  // Verified Badge on Right Header
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(pageWidth - 58, 13, 42, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('VERIFIED PAID', pageWidth - 37, 20, { align: 'center' });

  // Receipt Title & Metadata Box
  let y = 56;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('OFFICIAL PAYMENT RECEIPT', 16, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 16, y, { align: 'right' });

  y += 8;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(16, y, pageWidth - 32, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('RECEIPT NUMBER', 22, y + 9);
  doc.text('INVOICE NUMBER', 85, y + 9);
  doc.text('VERIFIED DATE', 148, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(tx.receiptNumber, 22, y + 16);
  doc.text(tx.invoiceNumber, 85, y + 16);
  doc.text(
    tx.verifiedAt ? new Date(tx.verifiedAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
    148,
    y + 16
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`UTR / Reference No: ${tx.utrNumber || tx.gatewayPaymentId || 'VERIFIED-TXN'}`, 22, y + 27);
  doc.text(`Status: VERIFIED & SETTLED`, 148, y + 27);

  // Student & Course Details Section
  y += 44;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('STUDENT & PROGRAM DETAILS', 16, y);

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, pageWidth - 16, y);

  y += 8;
  const rows: Array<[string, string]> = [
    ['Student Name', tx.studentName || student?.name || 'Enrolled Student'],
    ['Student Registration ID', student?.studentId || tx.studentId],
    ['Student Email', tx.studentEmail || student?.email || 'N/A'],
    ['Enrolled Program / Course', tx.courseName || tx.courseId],
    ['Payment Mode', `${tx.paymentMethod.replace(/_/g, ' ')}${tx.upiAppName ? ` (${tx.upiAppName})` : ''}`],
    ['Academy UPI Account (Credited)', `${tx.upiIdPaidTo} (${settings.upiPayeeName || 'Swanaya Media Academy'})`],
    ['Verified By', tx.verifiedBy || 'Academy Finance Desk'],
  ];

  doc.setFontSize(10);
  rows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`${label}:`, 16, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(val || '—'), 80, y);
    y += 7.5;
  });

  // Financial Summary Table
  y += 6;
  doc.setFillColor(15, 23, 42);
  doc.rect(16, y, pageWidth - 32, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('FEE DESCRIPTION', 20, y + 6.5);
  doc.text('AMOUNT (INR)', pageWidth - 20, y + 6.5, { align: 'right' });

  y += 10;
  doc.setDrawColor(203, 213, 225);
  doc.rect(16, y, pageWidth - 32, 14);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Tuition / Academic Fee Settlement (${tx.invoiceNumber})`, 20, y + 9);
  doc.setFont('helvetica', 'bold');
  doc.text(`INR ${Number(tx.amount).toLocaleString('en-IN')}.00`, pageWidth - 20, y + 9, { align: 'right' });

  y += 14;
  doc.setFillColor(236, 253, 245);
  doc.rect(16, y, pageWidth - 32, 13, 'FD');
  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL VERIFIED AMOUNT PAID', 20, y + 8.5);
  doc.text(`INR ${Number(tx.amount).toLocaleString('en-IN')}.00`, pageWidth - 20, y + 8.5, { align: 'right' });

  if (typeof remainingBalance === 'number') {
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Remaining Student Outstanding Balance after this payment: INR ${Math.max(0, remainingBalance).toLocaleString('en-IN')}.00`,
      16,
      y
    );
  }

  // Security & Verification Footer
  y = 258;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, pageWidth - 16, y);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This is a digitally verified official fee receipt issued by Swanaya Media Academy.',
    16,
    y + 6
  );
  doc.text(
    `Verification Ref: ${tx.id} · UTR: ${tx.utrNumber || tx.gatewayPaymentId || 'N/A'} · Authorized Signatory: ${tx.verifiedBy || 'Finance Admin'}`,
    16,
    y + 11
  );

  doc.save(`Swanaya_Receipt_${tx.receiptNumber}.pdf`);

  SwanayaDatabase.log(
    tx.studentEmail || 'student@swanayamedia.com',
    tx.studentName,
    'FEE_RECEIPT_DOWNLOADED',
    `Downloaded PDF receipt ${tx.receiptNumber} for Invoice ${tx.invoiceNumber}`
  );
}
