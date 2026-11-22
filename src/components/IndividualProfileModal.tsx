/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Student,
  Instructor,
  User,
  Course,
  Batch,
  AcademyReview,
  ExamRegistration,
  Invoice,
  SwanayaDatabase
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';
import {
  MAX_FACE_IMAGE_BYTES,
  formatMediaBytes,
  optimizeFaceImageForProfile
} from '../utils/mediaHelpers';
import {
  X,
  Mail,
  GraduationCap,
  Star,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  Printer,
  UserCheck,
  User as LucideUser,
  Clock,
  MessageCircle,
  Upload,
  Camera,
  RotateCcw,
  Trash2,
  KeyRound
} from 'lucide-react';

export interface IndividualProfileTarget {
  type: 'STUDENT' | 'INSTRUCTOR' | 'USER';
  id: string;
}

interface IndividualProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: IndividualProfileTarget | null;
  currentUser: User;
  onRefreshAllData: () => void;
  initialEditMode?: boolean;
  onUserUpdated?: (updatedUser: User) => void;
  onRequestReauth?: () => void;
}

export default function IndividualProfileModal({
  isOpen,
  onClose,
  target,
  currentUser,
  onRefreshAllData,
  initialEditMode = false,
  onUserUpdated,
  onRequestReauth
}: IndividualProfileModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'academic' | 'financial' | 'idcard'>('overview');
  const [isEditing, setIsEditing] = useState(Boolean(initialEditMode));
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedFileMeta, setSelectedFileMeta] = useState<{ name: string; sizeText: string } | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragOverFace, setIsDragOverFace] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const lastUploadedFileRef = useRef<File | null>(null);


  const resolvedProfile = useMemo(() => {
    if (!isOpen || !target) return null;

    const allStudents = SwanayaDatabase.get<Student[]>('students') || [];
    const allUsers = SwanayaDatabase.get<User[]>('users') || [];
    const allInstructors = SwanayaDatabase.get<Instructor[]>('instructors') || [];
    const allCourses = SwanayaDatabase.get<Course[]>('courses') || [];
    const allBatches = SwanayaDatabase.get<Batch[]>('batches') || [];
    const allReviews = SwanayaDatabase.get<AcademyReview[]>('reviews') || [];
    const allExamRegistrations = SwanayaDatabase.get<ExamRegistration[]>('examRegistrations') || [];
    const allInvoices = SwanayaDatabase.get<Invoice[]>('invoices') || [];

    let studentObj: Student | undefined;
    let instructorObj: Instructor | undefined;
    let userObj: User | undefined;

    if (target.type === 'STUDENT') {
      studentObj = allStudents.find((s) => s.id === target.id || s.userId === target.id);
      if (studentObj) {
        userObj = allUsers.find((u) => u.id === studentObj?.userId || u.email === studentObj?.email);
      }
    } else if (target.type === 'INSTRUCTOR') {
      instructorObj = allInstructors.find((i) => i.id === target.id || i.userId === target.id);
      if (instructorObj) {
        userObj = allUsers.find((u) => u.id === instructorObj?.userId || u.email === instructorObj?.email);
      }
    } else {
      userObj = allUsers.find((u) => u.id === target.id);
      if (userObj) {
        studentObj = allStudents.find((s) => s.userId === userObj?.id || s.email === userObj?.email);
        instructorObj = allInstructors.find((i) => i.userId === userObj?.id || i.email === userObj?.email);
      }
    }

    if (!userObj && target.id === currentUser.id) {
      userObj = currentUser;
      if (!studentObj) {
        studentObj = allStudents.find((s) => s.userId === currentUser.id || s.email === currentUser.email);
      }
      if (!instructorObj) {
        instructorObj = allInstructors.find((i) => i.userId === currentUser.id || i.email === currentUser.email);
      }
    }

    const displayName = studentObj?.name || instructorObj?.name || userObj?.name || currentUser.name || 'User Profile';
    const displayEmail = studentObj?.email || instructorObj?.email || userObj?.email || currentUser.email || 'N/A';
    const displayPhone =
      studentObj?.phone ||
      instructorObj?.phone ||
      userObj?.phone ||
      studentObj?.whatsappPhone ||
      userObj?.whatsappPhone ||
      '';
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;
    const displayAvatar =
      studentObj?.avatarUrl || instructorObj?.avatarUrl || userObj?.avatarUrl || defaultAvatar;
    const displayFocus: 'top' | 'center' = userObj?.avatarFocus || 'top';
    const displayRole = userObj?.role || (studentObj ? 'STUDENT' : instructorObj ? 'INSTRUCTOR' : currentUser.role || 'USER');
    const registerNo =
      studentObj?.studentId ||
      (instructorObj
        ? `EMP-${instructorObj.id.substring(0, 6).toUpperCase()}`
        : `USR-${(userObj?.id || currentUser.id).substring(0, 6).toUpperCase()}`);
    const admissionNo = studentObj?.admissionNumber || `ADM-2026-${registerNo.slice(-4)}`;

    const course = studentObj ? allCourses.find((c) => c.id === studentObj?.courseId) : undefined;
    const batch = studentObj ? allBatches.find((b) => b.id === studentObj?.batchId) : undefined;
    const userReviews = allReviews.filter(
      (r) =>
        (userObj && r.authorId === userObj.id) ||
        (studentObj && (r.authorId === studentObj.userId || r.authorName === studentObj.name))
    );
    const hallTickets = studentObj
      ? allExamRegistrations.filter((r) => r.studentId === studentObj?.id && r.status === 'APPROVED')
      : [];
    const studentInvoice = studentObj ? allInvoices.find((inv) => inv.studentId === studentObj?.id) : undefined;

    return {
      allStudents,
      allUsers,
      allInstructors,
      studentObj,
      instructorObj,
      userObj,
      displayName,
      displayEmail,
      displayPhone,
      defaultAvatar,
      displayAvatar,
      displayFocus,
      displayRole,
      registerNo,
      admissionNo,
      course,
      batch,
      userReviews,
      hallTickets,
      studentInvoice,
    };
  }, [isOpen, target, currentUser]);

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    whatsappPhone: '',
    guardianName: '',
    guardianPhone: '',
    academicBackground: '',
    skills: '',
    bio: '',
    avatarUrl: '',
    avatarFocus: 'top' as 'top' | 'center',
  });

  useEffect(() => {
    if (!isOpen || !resolvedProfile) return;
    const {
      studentObj,
      instructorObj,
      userObj,
      displayName,
      displayPhone,
      displayAvatar,
      displayFocus,
    } = resolvedProfile;

    setEditForm({
      name: displayName,
      phone: displayPhone,
      whatsappPhone: studentObj?.whatsappPhone || userObj?.whatsappPhone || displayPhone,
      guardianName: studentObj?.guardianName || userObj?.guardianName || 'Parent / Guardian',
      guardianPhone: studentObj?.guardianPhone || userObj?.guardianPhone || '',
      academicBackground:
        studentObj?.academicBackground ||
        instructorObj?.qualification ||
        userObj?.academicBackground ||
        'Media & Communication Studies',
      skills:
        studentObj?.skills?.join(', ') ||
        instructorObj?.specialization ||
        userObj?.skills?.join(', ') ||
        'Media & Design',
      bio: instructorObj?.bio || userObj?.bio || 'Academic participant at Swanaya Media Academy',
      avatarUrl: displayAvatar,
      avatarFocus: displayFocus,
    });

    setIsEditing(Boolean(initialEditMode));
    setActiveSubTab('overview');
    setFaceError(null);
    setSaveNotice(null);
    setSelectedFileMeta(null);
    setUploadProgress(0);
    setUploadingFace(false);
    setAvatarLoadFailed(false);
    lastUploadedFileRef.current = null;
  }, [isOpen, target?.id, target?.type, initialEditMode, resolvedProfile?.displayName, resolvedProfile?.displayAvatar]);

  if (!isOpen || !target || !resolvedProfile) return null;

  const {
    allStudents,
    allUsers,
    allInstructors,
    studentObj,
    instructorObj,
    userObj,
    displayName,
    displayEmail,
    displayPhone,
    defaultAvatar,
    displayRole,
    registerNo,
    admissionNo,
    course,
    batch,
    userReviews,
    hallTickets,
    studentInvoice,
  } = resolvedProfile;

  const isValidImageFileSelected = (file: File) => {
    if (file.type && file.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|webp|gif|avif|bmp|svg|ico)$/i.test(file.name);
  };

  const handleFaceFileSelected = async (file: File | undefined | null) => {
    if (!file) return;
    setFaceError(null);
    setSaveNotice(null);

    if (!isValidImageFileSelected(file)) {
      setFaceError('Please select a valid face image (JPG, PNG, WebP, GIF, AVIF, BMP, or SVG).');
      return;
    }

    if (file.size <= 0) {
      setFaceError('The selected image file is empty.');
      return;
    }

    if (file.size > MAX_FACE_IMAGE_BYTES) {
      setFaceError(
        `File exceeds the 2 GB maximum size limit (selected file is ${formatMediaBytes(file.size)}).`
      );
      return;
    }

    lastUploadedFileRef.current = file;
    setSelectedFileMeta({
      name: file.name,
      sizeText: `${formatMediaBytes(file.size)} / 2 GB max`,
    });
    setUploadingFace(true);
    setUploadProgress(8);

    try {
      let finalUrl = '';
      const targetUid = auth.currentUser?.uid || userObj?.id || currentUser.id;

      // For Firebase-authenticated users uploading larger photos, attempt Storage first with live progress
      if (auth.currentUser && file.size > 350 * 1024) {
        try {
          finalUrl = await academyService.uploadProfileFaceImage(targetUid, file, (pct) => {
            setUploadProgress(pct);
          });
        } catch {
          // Fall back cleanly to browser-side memory-safe face portrait optimization
          setUploadProgress(65);
          finalUrl = await optimizeFaceImageForProfile(file, editForm.avatarFocus);
        }
      } else {
        setUploadProgress(60);
        finalUrl = await optimizeFaceImageForProfile(file, editForm.avatarFocus);
      }

      setUploadProgress(100);
      setAvatarLoadFailed(false);
      setEditForm((prev) => ({ ...prev, avatarUrl: finalUrl }));
      setSaveNotice({
        type: 'success',
        text: 'Face photo loaded! Click "Save Profile Updates" below to apply across your account.',
      });
    } catch (err: any) {
      setFaceError(err?.message || 'Unable to process the selected face photo.');
      setUploadProgress(0);
    } finally {
      setUploadingFace(false);
    }
  };

  const handleChangeAvatarFocus = async (nextFocus: 'top' | 'center') => {
    setEditForm((prev) => ({ ...prev, avatarFocus: nextFocus }));
    if (lastUploadedFileRef.current && editForm.avatarUrl.startsWith('data:image/')) {
      try {
        const recropped = await optimizeFaceImageForProfile(lastUploadedFileRef.current, nextFocus);
        setEditForm((prev) => ({ ...prev, avatarUrl: recropped, avatarFocus: nextFocus }));
      } catch {
        // Keep CSS object-position update even if re-crop skipped
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFaceError(null);
    setSaveNotice(null);
    setSavingProfile(true);

    try {
      const normalizedSkills = editForm.skills
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 25);

      const finalAvatarUrl = editForm.avatarUrl.trim() || defaultAvatar;
      const lowerDisplayEmail = String(displayEmail || '').trim().toLowerCase();
      const isSpecialMdAccount =
        lowerDisplayEmail === 'aadithyan@swanayamedia.com' ||
        lowerDisplayEmail === 'aadithyan.menon@swanayamedia.com' ||
        lowerDisplayEmail === 'swanayamediaenterprisesadmins@gmail.com' ||
        lowerDisplayEmail === 'swanyamediaenterprisesadmins@gmail.com' ||
        lowerDisplayEmail === 'aadithyanmmenon@gmail.com';
      const finalName = isSpecialMdAccount
        ? editForm.name.trim() || 'AADITHYAN M MENON'
        : editForm.name.trim() || displayName;

      const now = new Date().toISOString();

      const localPatch = {
        name: finalName,
        phone: editForm.phone.trim(),
        whatsappPhone: editForm.whatsappPhone.trim(),
        guardianName: editForm.guardianName.trim(),
        guardianPhone: editForm.guardianPhone.trim(),
        academicBackground: editForm.academicBackground.trim(),
        skills: normalizedSkills,
        bio: editForm.bio.trim(),
        avatarUrl: finalAvatarUrl,
        avatarFocus: editForm.avatarFocus,
        updatedAt: now,
      };

      if (studentObj) {
        const updatedStudents = allStudents.map((s) =>
          s.id === studentObj.id ? { ...s, ...localPatch } : s
        );
        SwanayaDatabase.set('students', updatedStudents);
      }

      if (instructorObj) {
        const updatedInstructors = allInstructors.map((i) =>
          i.id === instructorObj.id
            ? {
                ...i,
                name: finalName,
                phone: localPatch.phone,
                qualification: localPatch.academicBackground || i.qualification,
                specialization: normalizedSkills.join(', ') || i.specialization,
                bio: localPatch.bio || i.bio,
                avatarUrl: finalAvatarUrl,
              }
            : i
        );
        SwanayaDatabase.set('instructors', updatedInstructors);
      }

      const effectiveUserId = userObj?.id || currentUser.id;
      const baseUser: User = userObj || {
        ...currentUser,
        id: effectiveUserId,
        email: displayEmail,
        role: displayRole as User['role'],
        status: 'ACTIVE',
        createdAt: now,
      };

      const updatedUserRecord: User = {
        ...baseUser,
        ...localPatch,
      };

      const userExistsInLocal = allUsers.some((u) => u.id === effectiveUserId);
      const nextUsers = userExistsInLocal
        ? allUsers.map((u) => (u.id === effectiveUserId ? updatedUserRecord : u))
        : [...allUsers, updatedUserRecord];
      SwanayaDatabase.set('users', nextUsers);

      // Sync to centralized cloud store and Firestore so profile is identical across all systems
      let cloudSynced = false;
      try {
        const studentPayload = studentObj ? { ...studentObj, ...localPatch } : null;
        const instructorPayload = instructorObj ? { ...instructorObj, ...localPatch } : null;
        await academyService.syncProfileToCloud(updatedUserRecord, studentPayload, instructorPayload);
        cloudSynced = true;
      } catch (syncErr: any) {
        console.warn('Sync profile to cloud warning:', syncErr.message);
      }

      SwanayaDatabase.log(
        displayEmail,
        finalName,
        'PROFILE_UPDATED',
        `Updated profile details and face photo (${cloudSynced ? 'Cloud + Local' : 'Local Session'})`
      );

      onUserUpdated?.(updatedUserRecord);
      onRefreshAllData();
      setIsEditing(false);
      setSaveNotice({
        type: 'success',
        text: cloudSynced
          ? 'Profile & face photo saved and synced to cloud storage.'
          : 'Profile & face photo updated for your active portal session.',
      });
    } catch (err: any) {
      setSaveNotice({
        type: 'error',
        text: err?.message || 'Unable to save profile updates. Please verify permissions and try again.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePrintIdCard = () => {
    window.print();
  };

  const isEmailVerified = Boolean(userObj?.email_verified ?? userObj?.isVerified ?? (userObj?.status === 'ACTIVE'));

  const avatarObjectClass = editForm.avatarFocus === 'top' ? 'object-cover object-top' : 'object-cover object-center';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] text-[#25263A] dark:text-[#F5F3FA] rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl relative my-8">
        {/* Header Bar */}
        <div className="bg-[#F4F3F7] dark:bg-[#1D1D2B] border-b border-[#E5E1EA] dark:border-[#38384B] px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserCheck className="w-5 h-5 text-[var(--sma-role-accent)] shrink-0" />
            <h3 className="text-sm font-bold font-serif text-[#25263A] dark:text-[#F5F3FA] tracking-wide truncate">
              Individual Profile Settings
            </h3>
            <span className="text-xs font-mono text-amber-400 font-semibold whitespace-nowrap shrink-0">
              · {displayRole.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsEditing((prev) => !prev);
                setFaceError(null);
                setSaveNotice(null);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-amber-500/40 rounded text-xs text-amber-400 font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Profile & Photo'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close profile dialog"
              className="p-1.5 bg-slate-900 border border-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User Card Hero Header */}
        <div className="p-6 bg-[#F9F8FC] dark:bg-[#1D1D2B] border-b border-[#E5E1EA] dark:border-[#38384B] flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="w-24 h-24 rounded-xl border-2 border-[var(--sma-role-accent-border)] bg-[#FFFFFF] dark:bg-[#242436] shadow-md overflow-hidden flex items-center justify-center">
              {!avatarLoadFailed && editForm.avatarUrl ? (
                <img
                  src={editForm.avatarUrl}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarLoadFailed(true)}
                  className={`w-full h-full ${avatarObjectClass}`}
                />
              ) : (
                <span className="text-xl font-serif font-bold text-amber-300">{initials || 'SM'}</span>
              )}
            </div>
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-[11px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Camera className="w-3 h-3" />
                <span>Change Face Photo</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5 text-center sm:text-left flex-grow">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold font-serif text-[#25263A] dark:text-[#F5F3FA]">{editForm.name || displayName}</h2>
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#2E7051] dark:text-[#76BD99] font-mono font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Email Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300 font-mono">
                  <Clock className="w-3.5 h-3.5" /> Verification Pending
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-slate-400 font-sans">
              <span>
                Reg ID: <strong className="text-slate-200 font-mono">{registerNo}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Adm No: <strong className="text-slate-200 font-mono">{admissionNo}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Email: <strong className="text-slate-200">{displayEmail}</strong>
              </span>
            </div>

            {course && (
              <p className="text-xs text-amber-400/90 font-mono font-medium">
                {course.name} ({course.code}) · {batch?.name || 'Primary Cohort'}
              </p>
            )}

            {/* Quick Action Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {(editForm.phone || displayPhone) && (
                <a
                  href={`https://wa.me/${(editForm.phone || displayPhone).replace(/[^\d+]/g, '').replace(/^\+/, '')}?text=${encodeURIComponent(
                    `Hello ${displayName}, reaching out from Swanaya Media Academy.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-400 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp ({editForm.phone || displayPhone})</span>
                </a>
              )}

              <a
                href={`mailto:${displayEmail}`}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span>Send Email</span>
              </a>

              <button
                type="button"
                onClick={handlePrintIdCard}
                className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print Digital ID Pass</span>
              </button>

              {onRequestReauth && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRequestReauth();
                  }}
                  className="px-2.5 py-1.5 bg-[#7652A8]/15 hover:bg-[#7652A8]/25 border border-[#7652A8]/40 text-[#5E3C8F] dark:text-[#D5BEFA] rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Re-Auth Username &amp; Password</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Navigation Tabs */}
        {!isEditing && (
          <div className="bg-slate-950 border-b border-slate-800 px-6 flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className={`px-4 py-3 text-xs font-semibold font-mono uppercase border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'overview'
                  ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Personal &amp; Credentials
            </button>

            {studentObj && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('academic')}
                  className={`px-4 py-3 text-xs font-semibold font-mono uppercase border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeSubTab === 'academic'
                      ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Academic Stats &amp; Exams
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('financial')}
                  className={`px-4 py-3 text-xs font-semibold font-mono uppercase border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
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
              type="button"
              onClick={() => setActiveSubTab('idcard')}
              className={`px-4 py-3 text-xs font-semibold font-mono uppercase border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'idcard'
                  ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Digital ID Card
            </button>
          </div>
        )}

        {/* Main Tab Content Field */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {saveNotice && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                saveNotice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {saveNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{saveNotice.text}</span>
            </div>
          )}

          {/* EDIT FORM MODE */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* FACE PHOTO UPLOADER STUDIO */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">
                      Face &amp; Profile Photo Upload
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Upload a clear headshot or portrait up to 2 GB (JPG, PNG, WebP, GIF, AVIF, SVG).
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums whitespace-nowrap">
                    Max Limit: 2 GB
                  </span>
                </div>

                {faceError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{faceError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Live Dual Preview (Square ID + Circular Avatar) */}
                  <div className="md:col-span-4 flex flex-col items-center gap-3">
                    <div className="flex items-end gap-3">
                      <div className="w-24 h-24 rounded-xl border-2 border-amber-500/50 bg-slate-950 overflow-hidden flex items-center justify-center shrink-0">
                        {!avatarLoadFailed && editForm.avatarUrl ? (
                          <img
                            src={editForm.avatarUrl}
                            alt="Face ID preview"
                            referrerPolicy="no-referrer"
                            onError={() => setAvatarLoadFailed(true)}
                            className={`w-full h-full ${avatarObjectClass}`}
                          />
                        ) : (
                          <span className="text-xl font-serif font-bold text-amber-300">{initials || 'SM'}</span>
                        )}
                      </div>

                      <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-950 overflow-hidden flex items-center justify-center shrink-0">
                        {!avatarLoadFailed && editForm.avatarUrl ? (
                          <img
                            src={editForm.avatarUrl}
                            alt="Circular avatar preview"
                            referrerPolicy="no-referrer"
                            className={`w-full h-full ${avatarObjectClass}`}
                          />
                        ) : (
                          <span className="text-xs font-bold text-amber-300">{initials || 'SM'}</span>
                        )}
                      </div>
                    </div>

                    {/* Face Framing Switch */}
                    <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => handleChangeAvatarFocus('top')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                          editForm.avatarFocus === 'top'
                            ? 'bg-amber-500 text-black font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Face Focus
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChangeAvatarFocus('center')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                          editForm.avatarFocus === 'center'
                            ? 'bg-amber-500 text-black font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Center Crop
                      </button>
                    </div>
                  </div>

                  {/* Drag & Drop Zone + Controls */}
                  <div className="md:col-span-8 space-y-3">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOverFace(true);
                      }}
                      onDragLeave={() => setIsDragOverFace(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOverFace(false);
                        const droppedFile = e.dataTransfer.files?.[0];
                        handleFaceFileSelected(droppedFile);
                      }}
                      className={`border border-dashed rounded-xl p-4 transition-colors text-center space-y-3 ${
                        isDragOverFace
                          ? 'border-amber-400 bg-amber-500/10'
                          : 'border-slate-700 bg-slate-950/80 hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-200">
                          Drop your face photo here or choose a file
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Supports high-resolution DSLR, mobile, and studio images up to 2 GB
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{uploadingFace ? 'Processing Photo...' : 'Upload Face Photo (Max 2 GB)'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingFace}
                            className="sr-only"
                            onChange={(e) => {
                              const picked = e.target.files?.[0];
                              e.target.value = '';
                              handleFaceFileSelected(picked);
                            }}
                          />
                        </label>

                        <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0">
                          <Camera className="w-3.5 h-3.5 text-amber-400" />
                          <span>Use Camera</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            disabled={uploadingFace}
                            className="sr-only"
                            onChange={(e) => {
                              const picked = e.target.files?.[0];
                              e.target.value = '';
                              handleFaceFileSelected(picked);
                            }}
                          />
                        </label>
                      </div>

                      {selectedFileMeta && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span className="truncate max-w-[240px]">{selectedFileMeta.name}</span>
                            <span className="tabular-nums text-amber-300">{selectedFileMeta.sizeText}</span>
                          </div>
                          {(uploadingFace || uploadProgress > 0) && (
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 transition-all duration-200"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Direct Image URL & Reset Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        value={editForm.avatarUrl}
                        onChange={(e) => {
                          setAvatarLoadFailed(false);
                          setEditForm({ ...editForm, avatarUrl: e.target.value });
                        }}
                        placeholder="Or paste direct image URL (https://...)"
                        className="flex-grow bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarLoadFailed(false);
                          setSelectedFileMeta(null);
                          setFaceError(null);
                          setEditForm((prev) => ({ ...prev, avatarUrl: defaultAvatar }));
                        }}
                        className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Avatar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarLoadFailed(false);
                          setSelectedFileMeta(null);
                          setFaceError(null);
                          setEditForm((prev) => ({ ...prev, avatarUrl: '' }));
                        }}
                        className="px-3 py-2 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 rounded text-xs text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* PERSONAL DETAILS FORM */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-bold font-mono text-amber-400 uppercase tracking-wider">
                  Personal Details &amp; Contact Information
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
                    <label className="text-[10px] text-slate-400 uppercase font-bold">
                      Academic Background / Qualification
                    </label>
                    <input
                      type="text"
                      value={editForm.academicBackground}
                      onChange={(e) => setEditForm({ ...editForm, academicBackground: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">
                      Skills / Specialization (Comma separated)
                    </label>
                    <input
                      type="text"
                      value={editForm.skills}
                      onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Profile Bio</label>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile || uploadingFace}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingProfile ? 'Saving...' : 'Save Profile Updates'}</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeSubTab === 'overview' && (
                <div className="space-y-6">
                  {studentObj && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Attendance Rate</span>
                        <p
                          className={`text-lg font-mono font-bold tabular-nums ${
                            studentObj.attendancePercentage < 75 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {studentObj.attendancePercentage}%
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Career Score</span>
                        <p className="text-lg font-mono font-bold text-amber-400 tabular-nums">
                          {studentObj.careerReadinessScore} / 100
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Reviews Posted</span>
                        <p className="text-lg font-mono font-bold text-amber-400 tabular-nums">
                          {userReviews.length} Posted
                        </p>
                      </div>

                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1">
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Fee Status</span>
                        <p
                          className={`text-sm font-mono font-bold tabular-nums ${
                            studentObj.outstandingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {studentObj.outstandingBalance > 0
                            ? `₹${studentObj.outstandingBalance.toLocaleString('en-IN')} Due`
                            : 'CLEARED'}
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
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500 font-mono">Admission Number:</span>
                          <span className="font-mono font-semibold text-white">{admissionNo}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500 font-mono">Register Student ID:</span>
                          <span className="font-mono font-semibold text-white">{registerNo}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500 font-mono">Enrolled Program:</span>
                          <span className="font-semibold text-amber-300">{course?.name || 'Academy Course'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
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
                        <LucideUser className="w-4 h-4" /> Guardian &amp; Contact Records
                      </h4>

                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500 font-mono">Primary Contact Phone:</span>
                          <span className="font-mono font-semibold text-white">{editForm.phone}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500 font-mono">WhatsApp Number:</span>
                          <span className="font-mono font-semibold text-emerald-400">{editForm.whatsappPhone}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500 font-mono">Parent / Guardian:</span>
                          <span className="font-semibold text-slate-200">{editForm.guardianName}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                          <span className="text-slate-500 font-mono">Guardian Emergency Phone:</span>
                          <span className="font-mono font-semibold text-white">{editForm.guardianPhone}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-mono">Campus Account Status:</span>
                          <span className="font-mono font-bold text-emerald-400 uppercase">
                            {studentObj?.status || userObj?.status || 'ACTIVE'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {editForm.bio && (
                    <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg space-y-1.5">
                      <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">Bio</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{editForm.bio}</p>
                    </div>
                  )}

                  {/* Skills & Competencies */}
                  <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg space-y-2">
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Technical Skills &amp; Specializations
                    </h4>
                    <p className="text-xs text-slate-300 font-mono">
                      {editForm.skills
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .join(' · ') || 'None specified'}
                    </p>
                  </div>

                  {/* Email Verification & Contact Summary */}
                  <div className="p-4 bg-[#F9F8FC] dark:bg-[#1D1D2B] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-mono font-bold text-[var(--sma-role-accent-text)] uppercase tracking-wider flex items-center gap-1.5">
                        <Mail className="w-4 h-4" />
                        <span>Email Verification &amp; Contact Details</span>
                      </h4>
                      <span
                        className={`text-[11px] font-mono font-semibold flex items-center gap-1 ${
                          isEmailVerified
                            ? 'text-[#2E7051] dark:text-[#76BD99]'
                            : 'text-amber-600 dark:text-amber-300'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isEmailVerified ? 'EMAIL VERIFIED' : 'VERIFICATION PENDING'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#555770] dark:text-[#B8B5C5]">
                      <div>
                        <span className="block text-[11px] uppercase tracking-wider font-mono text-[#555770] dark:text-[#B8B5C5]">
                          Verified Email
                        </span>
                        <strong className="text-[#25263A] dark:text-[#F5F3FA] font-mono break-all">
                          {displayEmail}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] uppercase tracking-wider font-mono text-[#555770] dark:text-[#B8B5C5]">
                          Contact Number
                        </span>
                        <strong className="text-[#25263A] dark:text-[#F5F3FA] font-mono">
                          {editForm.phone || displayPhone || 'Not provided'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ACADEMIC STATS & EXAMS */}
              {activeSubTab === 'academic' && studentObj && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Approved Exam Registrations &amp; Hall Tickets
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">{hallTickets.length} Session Pass(es)</span>
                  </div>

                  {hallTickets.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {hallTickets.map((ht) => (
                        <div key={ht.id} className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">
                              Hall Ticket Issued
                            </span>
                            <span className="text-[11px] font-mono text-amber-400 font-bold">
                              {ht.hallTicketNo || 'HT-2026-X'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white font-serif">{ht.examTitle}</p>
                          <div className="text-[11px] font-mono text-slate-400 space-y-1">
                            <div>
                              Subject: <strong className="text-slate-200">{ht.subjectName} ({ht.subjectCode})</strong>
                            </div>
                            <div>
                              Venue: <strong className="text-slate-200">{ht.examCenterName || 'Main Campus Hall Alpha'}</strong>
                            </div>
                            <div>
                              Seat No: <strong className="text-slate-200">{ht.seatNumber || 'Desk A-01'}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-900/30 border border-slate-800 rounded-lg text-center space-y-2">
                      <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">
                        No active examination hall tickets issued currently for this student.
                      </p>
                    </div>
                  )}

                  {/* Submitted Academy Reviews */}
                  <div className="pt-4 border-t border-slate-800/80 space-y-3">
                    <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Submitted Academy Reviews
                    </h4>
                    {userReviews.length > 0 ? (
                      <div className="space-y-2">
                        {userReviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-bold text-white font-serif">{rev.title}</p>
                              <p className="text-[11px] font-mono text-slate-400">
                                {rev.courseName} · {rev.createdAt?.substring(0, 10)}
                              </p>
                            </div>
                            <span className="font-mono tabular-nums font-bold text-xs text-amber-300 flex items-center gap-1 shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
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
                      <p className="text-xl font-mono font-bold text-white tabular-nums">
                        ₹{(course?.fee || 145000).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Outstanding Dues</span>
                      <p
                        className={`text-xl font-mono font-bold tabular-nums ${
                          studentObj.outstandingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        ₹{studentObj.outstandingBalance.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="text-xs font-mono font-bold text-slate-300">
                      Status: {studentObj.outstandingBalance === 0 ? 'Cleared' : 'Partial Dues'}
                    </div>
                  </div>

                  {studentInvoice ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                        Payment Receipts History
                      </h4>
                      {studentInvoice.payments.map((pmt, i) => (
                        <div
                          key={i}
                          className="p-3 bg-slate-900/40 border border-slate-800 rounded flex justify-between items-center text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-200">Receipt No: {pmt.receiptNo}</p>
                            <p className="text-[11px] font-mono text-slate-400">
                              Date: {pmt.date} · Method: {pmt.method}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-emerald-400 text-sm tabular-nums">
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
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <div className="text-left">
                        <p className="text-xs font-serif font-bold text-amber-400 tracking-wider">SWANAYA MEDIA ACADEMY</p>
                        <p className="text-[10px] font-mono text-slate-500 uppercase">Identity Pass Credential</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400">Active ID</span>
                    </div>

                    <div className="flex items-center gap-4 text-left">
                      <div className="w-24 h-24 rounded-xl border-2 border-amber-500/40 bg-slate-900 shrink-0 overflow-hidden flex items-center justify-center">
                        {!avatarLoadFailed && editForm.avatarUrl ? (
                          <img
                            src={editForm.avatarUrl}
                            alt={displayName}
                            referrerPolicy="no-referrer"
                            className={`w-full h-full ${avatarObjectClass}`}
                          />
                        ) : (
                          <span className="text-lg font-serif font-bold text-amber-300">{initials || 'SM'}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-white font-serif">{editForm.name || displayName}</h3>
                        <p className="text-xs font-mono font-bold text-amber-300">{displayRole}</p>
                        <p className="text-[11px] font-mono text-slate-400">ID: {registerNo}</p>
                        <p className="text-[11px] font-mono text-slate-400">ADM: {admissionNo}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-dashed border-slate-800 space-y-1">
                      <div className="text-sky-400 font-mono text-xl font-bold tracking-[6px]">
                        ||| | |||| | ||| |||| |
                      </div>
                      <p className="text-[10px] font-mono text-slate-500">
                        Scan code at campus gates &amp; exam centers
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePrintIdCard}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold uppercase rounded-lg shadow-md cursor-pointer transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Digital ID Pass</span>
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
