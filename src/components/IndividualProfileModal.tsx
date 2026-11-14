/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Student, Instructor, User, Course, Batch, AcademyReview, 
  ExamRegistration, Invoice, SwanayaDatabase 
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { 
  X, Mail, Phone, MapPin, GraduationCap, Star, Calendar, ShieldCheck, 
  CheckCircle2, AlertCircle, Edit3, Save, Download, QrCode, FileText, 
  ExternalLink, MessageCircle, DollarSign, BookOpen, Clock, UserCheck, Printer, User as LucideUser
} from 'lucide-react';

export interface IndividualProfileTarget {
  type: 'STUDENT' | 'INSTRUCTOR' | 'USER';
  id: string; // ID of student, instructor, or user
}

interface IndividualProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: IndividualProfileTarget | null;
  currentUser: User;
  onRefreshAllData: () => void;
}

export default function IndividualProfileModal({
  isOpen,
  onClose,
  target,
  currentUser,
  onRefreshAllData
}: IndividualProfileModalProps) {
  if (!isOpen || !target) return null;

  // Fetch database records
  const allStudents = SwanayaDatabase.get<Student[]>("students");
  const allUsers = SwanayaDatabase.get<User[]>("users");
  const allInstructors = SwanayaDatabase.get<Instructor[]>("instructors");
  const allCourses = SwanayaDatabase.get<Course[]>("courses");
  const allBatches = SwanayaDatabase.get<Batch[]>("batches");
  const allReviews = SwanayaDatabase.get<AcademyReview[]>("reviews");
  const allExamRegistrations = SwanayaDatabase.get<ExamRegistration[]>("examRegistrations");
  const allInvoices = SwanayaDatabase.get<Invoice[]>("invoices");

  // Determine profile object
  let studentObj: Student | undefined;
  let instructorObj: Instructor | undefined;
  let userObj: User | undefined;

  if (target.type === 'STUDENT') {
    studentObj = allStudents.find(s => s.id === target.id || s.userId === target.id);
    if (studentObj) {
      userObj = allUsers.find(u => u.id === studentObj?.userId || u.email === studentObj?.email);
    }
  } else if (target.type === 'INSTRUCTOR') {
    instructorObj = allInstructors.find(i => i.id === target.id || i.userId === target.id);
    if (instructorObj) {
      userObj = allUsers.find(u => u.id === instructorObj?.userId || u.email === instructorObj?.email);
    }
  } else {
    userObj = allUsers.find(u => u.id === target.id);
    if (userObj) {
      studentObj = allStudents.find(s => s.userId === userObj?.id || s.email === userObj?.email);
      instructorObj = allInstructors.find(i => i.userId === userObj?.id || i.email === userObj?.email);
    }
  }

  // Fallback defaults if target data is sparse
  const displayName = studentObj?.name || instructorObj?.name || userObj?.name || "User Profile";
  const displayEmail = studentObj?.email || instructorObj?.email || userObj?.email || "N/A";
  const displayPhone = studentObj?.phone || instructorObj?.phone || studentObj?.whatsappPhone || "+91 94460 00000";
  const displayAvatar = studentObj?.avatarUrl || instructorObj?.avatarUrl || userObj?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;
  const displayRole = userObj?.role || (studentObj ? 'STUDENT' : instructorObj ? 'INSTRUCTOR' : 'USER');
  const registerNo = studentObj?.studentId || (instructorObj ? `EMP-${instructorObj.id.substring(0, 6).toUpperCase()}` : `USR-${userObj?.id.substring(0, 6).toUpperCase()}`);
  const admissionNo = studentObj?.admissionNumber || `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  // Related data calculations
  const course = studentObj ? allCourses.find(c => c.id === studentObj?.courseId) : undefined;
  const batch = studentObj ? allBatches.find(b => b.id === studentObj?.batchId) : undefined;
  const userReviews = allReviews.filter(r =>
    (userObj && r.authorId === userObj.id) ||
    (studentObj && (r.authorId === studentObj.userId || r.authorName === studentObj.name))
  );
  const hallTickets = studentObj ? allExamRegistrations.filter(r => r.studentId === studentObj?.id && r.status === 'APPROVED') : [];
  const studentInvoice = studentObj ? allInvoices.find(inv => inv.studentId === studentObj?.id) : undefined;

  // Modal active tab
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'academic' | 'financial' | 'idcard'>('overview');

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: displayName,
    phone: displayPhone,
    whatsappPhone: studentObj?.whatsappPhone || displayPhone,
    guardianName: studentObj?.guardianName || 'Parent / Guardian',
    guardianPhone: studentObj?.guardianPhone || '+91 94460 00000',
    academicBackground: studentObj?.academicBackground || instructorObj?.qualification || 'Graduate',
    skills: studentObj?.skills.join(', ') || instructorObj?.specialization || 'Media & Design',
    bio: instructorObj?.bio || 'Academic participant at Swanaya Media Academy',
    avatarUrl: displayAvatar
  });

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Enforce MD Identity for specific administrative emails
      const isAdminEmail = displayEmail === 'aadithyan@swanayamedia.com' || displayEmail === 'swanayamediaenterprisesadmins@gmail.com';
      
      const updatedData: any = {
        name: isAdminEmail ? 'AADITHYAN M MENON' : editForm.name,
        phone: editForm.phone,
        whatsappPhone: editForm.whatsappPhone,
        guardianName: editForm.guardianName,
        guardianPhone: editForm.guardianPhone,
        academicBackground: editForm.academicBackground,
        skills: editForm.skills.split(',').map(item => item.trim()).filter(Boolean),
        avatarUrl: isAdminEmail ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aadithyan&mood[]=happy&clothingColor=25555c' : editForm.avatarUrl
      };

      // Check if it's Aadithyan and set professional defaults if needed
      if (displayEmail === 'aadithyan@swanayamedia.com' || displayEmail === 'swanayamediaenterprisesadmins@gmail.com') {
        updatedData.name = 'AADITHYAN M MENON';
        // Professional avatar if it was the default dicebear one
        if (editForm.avatarUrl.includes('dicebear')) {
          updatedData.avatarUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aadithyan&mood[]=happy&clothingColor=25555c';
        }
      }

      if (studentObj) {
        // Sync to mockDb for UI compatibility
        const updatedStudents = allStudents.map(s => s.id === studentObj?.id ? { ...s, ...updatedData } : s);
        SwanayaDatabase.set("students", updatedStudents);
      }

      if (userObj) {
        const updatedUsers = allUsers.map(u => u.id === userObj?.id ? { ...u, ...updatedData } : u);
        SwanayaDatabase.set("users", updatedUsers);
        // Save to real Firestore
        await academyService.updateUserProfile(userObj.id, updatedData);
      }

      if (instructorObj) {
        const updatedInstructors = allInstructors.map(i => i.id === instructorObj?.id ? { ...i, ...updatedData } : i);
        SwanayaDatabase.set("instructors", updatedInstructors);
      }

      setIsEditing(false);
      onRefreshAllData();
    } catch (err) {
      alert('Failed to update profile.');
    }
  };

  const handlePrintIdCard = () => {
    const printWindow = window.open('', '_blank', 'width=700,height=500');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Digital Identity Card - ${displayName}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #07090E; color: #f8fafc; padding: 40px; display: flex; justify-content: center; }
            .card { width: 420px; border: 2px solid #334155; border-radius: 16px; background: #0f172a; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            .header { display: flex; align-items: center; justify-content: space-between; border-b: 1px solid #334155; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 14px; font-weight: bold; letter-spacing: 2px; color: #fbbf24; text-transform: uppercase; }
            .subtitle { font-size: 10px; color: #94a3b8; letter-spacing: 1px; }
            .profile-grid { display: flex; gap: 20px; align-items: center; margin-bottom: 20px; }
            .avatar { width: 90px; height: 90px; border-radius: 12px; border: 2px solid #fbbf24; object-fit: cover; }
            .details { flex-grow: 1; }
            .name { font-size: 18px; font-weight: bold; color: #ffffff; margin: 0 0 4px 0; }
            .role-badge { display: inline-block; padding: 3px 8px; background: rgba(251, 191, 36, 0.15); color: #fbbf24; border-radius: 4px; font-size: 10px; font-weight: bold; font-family: monospace; }
            .info-row { font-size: 11px; margin-top: 6px; color: #cbd5e1; }
            .info-label { font-weight: bold; color: #64748b; font-size: 9px; text-transform: uppercase; }
            .barcode-box { text-align: center; border-t: 1px dashed #334155; padding-top: 16px; margin-top: 16px; }
            .barcode { font-family: 'Courier New', monospace; font-size: 22px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; }
            .qr-placeholder { font-size: 9px; color: #64748b; margin-top: 4px; font-mono; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div>
                <div class="title">SWANAYA MEDIA ACADEMY</div>
                <div class="subtitle">OFFICIAL IDENTITY CREDENTIAL PASS</div>
              </div>
              <div style="font-size: 10px; font-weight: bold; color: #34d399;">VERIFIED</div>
            </div>
            <div class="profile-grid">
              <img src="${displayAvatar}" class="avatar" alt="Avatar" />
              <div class="details">
                <div class="name">${displayName}</div>
                <div class="role-badge">${displayRole}</div>
                <div class="info-row"><span class="info-label">Register ID:</span> ${registerNo}</div>
                <div class="info-row"><span class="info-label">Admission No:</span> ${admissionNo}</div>
                <div class="info-row"><span class="info-label">Program:</span> ${course?.name || 'Academic Program'}</div>
              </div>
            </div>
            <div class="barcode-box">
              <div class="barcode">||| | |||| | ||| |||| |</div>
              <div class="qr-placeholder">VERIFY CODE: ${registerNo}-${Date.now().toString().slice(-4)}</div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0B0F17] border border-slate-800 rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl relative my-8">
        
        {/* Header Bar */}
        <div className="bg-[#0f172a]/80 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold font-serif text-white tracking-wide">
              Individual Identity Profile
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-bold">
              {displayRole}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-amber-500/40 rounded text-xs text-amber-400 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User Card Hero Header */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <img 
            src={editForm.avatarUrl} 
            alt={displayName}
            className="w-20 h-20 rounded-xl border-2 border-amber-500/50 object-cover bg-slate-900 shadow-md shrink-0" 
          />

          <div className="space-y-1.5 text-center sm:text-left flex-grow">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold font-serif text-white">{displayName}</h2>
              {userObj?.isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                  <CheckCircle2 className="w-3 h-3" /> VERIFIED ACADEMY ID
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400 font-sans">
              <span>Reg ID: <strong className="text-slate-200 font-mono">{registerNo}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Adm No: <strong className="text-slate-200 font-mono">{admissionNo}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Email: <strong className="text-slate-200">{displayEmail}</strong></span>
            </div>

            {course && (
              <p className="text-xs text-amber-400/90 font-mono font-medium">
                🎓 {course.name} ({course.code}) · {batch?.name || 'Primary Cohort'}
              </p>
            )}

            {/* Quick Action Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <a 
                href={`https://wa.me/${displayPhone.replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent(`Hello ${displayName}, reaching out from Swanaya Media Academy.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-400 rounded text-[11px] font-mono font-medium flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp ({displayPhone})</span>
              </a>

              <a 
                href={`mailto:${displayEmail}`}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-300 rounded text-[11px] font-mono font-medium flex items-center gap-1.5 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Send Email</span>
              </a>

              <button
                onClick={handlePrintIdCard}
                className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded text-[11px] font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print Digital ID Pass</span>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Navigation Tabs */}
        <div className="bg-slate-950 border-b border-slate-800 px-6 flex gap-2">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-3 text-xs font-semibold font-mono uppercase border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'overview'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Personal & Credentials
          </button>

          {studentObj && (
            <>
              <button
                onClick={() => setActiveSubTab('academic')}
                className={`px-4 py-3 text-xs font-semibold font-mono uppercase border-b-2 transition-colors cursor-pointer ${
                  activeSubTab === 'academic'
                    ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Academic Stats & Exams
              </button>

              <button
                onClick={() => setActiveSubTab('financial')}
                className={`px-4 py-3 text-xs font-semibold font-mono uppercase border-b-2 transition-colors cursor-pointer ${
                  activeSubTab === 'financial'
                    ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Fee Ledger ({studentObj.outstandingBalance > 0 ? `₹${studentObj.outstandingBalance.toLocaleString('en-IN')} Due` : 'Paid'})
              </button>
            </>
          )}

          <button
            onClick={() => setActiveSubTab('idcard')}
            className={`px-4 py-3 text-xs font-semibold font-mono uppercase border-b-2 transition-colors cursor-pointer ${
              activeSubTab === 'idcard'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Digital ID Card Badge
          </button>
        </div>

        {/* Main Tab Content Field */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          
          {/* EDIT FORM MODE */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-lg p-5">
              <h4 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider mb-3">
                Edit Profile Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Full Name</label>
                  <input 
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Phone Number</label>
                  <input 
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">WhatsApp Contact Phone</label>
                  <input 
                    type="text"
                    value={editForm.whatsappPhone}
                    onChange={(e) => setEditForm({ ...editForm, whatsappPhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Guardian / Parent Name</label>
                  <input 
                    type="text"
                    value={editForm.guardianName}
                    onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Guardian Contact Phone</label>
                  <input 
                    type="text"
                    value={editForm.guardianPhone}
                    onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Avatar Image URL</label>
                  <input 
                    type="text"
                    value={editForm.avatarUrl}
                    onChange={(e) => setEditForm({ ...editForm, avatarUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Academic Background / Qualification</label>
                  <input 
                    type="text"
                    value={editForm.academicBackground}
                    onChange={(e) => setEditForm({ ...editForm, academicBackground: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Skills / Specialization (Comma separated)</label>
                  <input 
                    type="text"
                    value={editForm.skills}
                    onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Profile Updates</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeSubTab === 'overview' && (
                <div className="space-y-6">
                  
                  {/* Key Stats Bar */}
                  {studentObj && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Attendance Rate</span>
                        <p className="text-lg font-mono font-bold text-emerald-400 tabular-nums">
                          {studentObj.attendancePercentage}%
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Career Score</span>
                        <p className="text-lg font-mono font-bold text-amber-400 tabular-nums">
                          {studentObj.careerReadinessScore} / 100
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Reviews Posted</span>
                        <p className="text-lg font-mono font-bold text-amber-400 tabular-nums">
                          {userReviews.length} Posted
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Fee Status</span>
                        <p className={`text-sm font-mono font-bold ${studentObj.outstandingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {studentObj.outstandingBalance > 0 ? `₹${studentObj.outstandingBalance.toLocaleString('en-IN')} Due` : 'CLEARED'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Personal Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg space-y-3">
                      <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4" /> Academic Credentials
                      </h4>

                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex justify-between border-b border-slate-850 pb-1.5">
                          <span className="text-slate-500 font-mono">Admission Number:</span>
                          <span className="font-mono font-semibold text-white">{admissionNo}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1.5">
                          <span className="text-slate-500 font-mono">Register Student ID:</span>
                          <span className="font-mono font-semibold text-white">{registerNo}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1.5">
                          <span className="text-slate-500 font-mono">Enrolled Program:</span>
                          <span className="font-semibold text-amber-300">{course?.name || 'Academy Course'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1.5">
                          <span className="text-slate-500 font-mono">Batch Cohort:</span>
                          <span className="font-semibold text-slate-200">{batch?.name || 'Regular Batch'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-mono">Prior Qualification:</span>
                          <span className="font-semibold text-slate-200">{editForm.academicBackground}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg space-y-3">
                      <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <LucideUser className="w-4 h-4" /> Guardian & Contact Records
                      </h4>

                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex justify-between border-b border-slate-850 pb-1.5">
                          <span className="text-slate-500 font-mono">Primary Contact Phone:</span>
                          <span className="font-mono font-semibold text-white">{editForm.phone}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1.5">
                          <span className="text-slate-500 font-mono">WhatsApp Number:</span>
                          <span className="font-mono font-semibold text-emerald-400">{editForm.whatsappPhone}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1.5">
                          <span className="text-slate-500 font-mono">Parent / Guardian:</span>
                          <span className="font-semibold text-slate-200">{editForm.guardianName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-850 pb-1.5">
                          <span className="text-slate-500 font-mono">Guardian Emergency Phone:</span>
                          <span className="font-mono font-semibold text-white">{editForm.guardianPhone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-mono">Campus Account Status:</span>
                          <span className="font-mono font-bold text-emerald-400 uppercase">{studentObj?.status || userObj?.status || 'ACTIVE'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Skills & Competencies */}
                  <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg space-y-2">
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Technical Skills & Specializations
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(editForm.skills.split(',')).map((sk, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 rounded text-xs font-mono">
                          {sk.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ACADEMIC STATS & EXAMS */}
              {activeSubTab === 'academic' && studentObj && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Approved Exam Registrations & Hall Tickets
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">{hallTickets.length} Session Pass(es)</span>
                  </div>

                  {hallTickets.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {hallTickets.map(ht => (
                        <div key={ht.id} className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-[9px] font-mono font-bold uppercase">
                              HALL TICKET ISSUED
                            </span>
                            <span className="text-[10px] font-mono text-amber-400 font-bold">{ht.hallTicketNo || 'HT-2026-X'}</span>
                          </div>
                          <p className="text-xs font-bold text-white font-serif">{ht.examTitle}</p>
                          <div className="text-[11px] font-mono text-slate-400 space-y-1">
                            <div>Subject: <strong className="text-slate-200">{ht.subjectName} ({ht.subjectCode})</strong></div>
                            <div>Venue: <strong className="text-slate-200">{ht.examCenterName || 'Main Campus Hall Alpha'}</strong></div>
                            <div>Seat No: <strong className="text-slate-200">{ht.seatNumber || 'Desk A-01'}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-900/30 border border-slate-800 rounded-lg text-center space-y-2">
                      <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">No active examination hall tickets issued currently for this student.</p>
                    </div>
                  )}

                  {/* Submitted Academy Reviews */}
                  <div className="pt-4 border-t border-slate-850 space-y-3">
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Submitted Academy Reviews
                    </h4>
                    {userReviews.length > 0 ? (
                      <div className="space-y-2">
                        {userReviews.map(rev => (
                          <div key={rev.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-white font-serif">{rev.title}</p>
                              <p className="text-[10px] font-mono text-slate-400">{rev.courseName} · {rev.createdAt?.substring(0, 10)}</p>
                            </div>
                            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded font-mono tabular-nums font-bold text-[10px] flex items-center gap-1 shrink-0">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {Number(rev.rating).toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No academy reviews submitted yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: FINANCIAL LEDGER */}
              {activeSubTab === 'financial' && studentObj && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Total Course Fee Ledger</span>
                      <p className="text-xl font-mono font-bold text-white">
                        ₹{(course?.fee || 145000).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Outstanding Dues</span>
                      <p className={`text-xl font-mono font-bold ${studentObj.outstandingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ₹{studentObj.outstandingBalance.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-300">
                      Status: {studentObj.outstandingBalance === 0 ? 'CLEARED ✅' : 'PARTIAL DUES ⚠️'}
                    </div>
                  </div>

                  {studentInvoice ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                        Payment Receipts History
                      </h4>
                      {studentInvoice.payments.map((pmt, i) => (
                        <div key={i} className="p-3 bg-slate-900/40 border border-slate-800 rounded flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-slate-200">Receipt No: {pmt.receiptNo}</p>
                            <p className="text-[10px] font-mono text-slate-400">Date: {pmt.date} · Method: {pmt.method}</p>
                          </div>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            +₹{pmt.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No invoice payment receipts logged.</p>
                  )}
                </div>
              )}

              {/* TAB 4: DIGITAL ID CARD */}
              {activeSubTab === 'idcard' && (
                <div className="space-y-4 text-center">
                  <div className="max-w-md mx-auto p-6 bg-slate-950 border-2 border-slate-800 rounded-2xl shadow-xl space-y-4 relative">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                      <div className="text-left">
                        <p className="text-xs font-serif font-bold text-amber-400 tracking-wider">SWANAYA MEDIA ACADEMY</p>
                        <p className="text-[9px] font-mono text-slate-500 uppercase">IDENTITY PASS CREDENTIAL</p>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-[9px] font-mono font-bold">
                        ACTIVE ID
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-left">
                      <img 
                        src={editForm.avatarUrl} 
                        alt={displayName}
                        className="w-24 h-24 rounded-xl border-2 border-amber-500/40 object-cover bg-slate-900 shrink-0" 
                      />
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-white font-serif">{displayName}</h3>
                        <p className="text-xs font-mono font-bold text-amber-300">{displayRole}</p>
                        <p className="text-[11px] font-mono text-slate-400">ID: {registerNo}</p>
                        <p className="text-[11px] font-mono text-slate-400">ADM: {admissionNo}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-dashed border-slate-800 space-y-1">
                      <div className="text-sky-400 font-mono text-xl font-bold tracking-[6px]">
                        ||| | |||| | ||| |||| |
                      </div>
                      <p className="text-[9px] font-mono text-slate-500">
                        SCAN CODE AT CAMPUS GATES & EXAM CENTERS
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handlePrintIdCard}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase rounded-lg shadow-md cursor-pointer transition-colors inline-flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Formal Digital ID Pass</span>
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
