/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Shield,
  User as UserIcon,
  Lock,
  ArrowLeft,
  ArrowRight,
  Mail,
  MailCheck,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  MessageCircle,
  ExternalLink,
  Camera,
  MapPin,
  GraduationCap,
  Award,
  Briefcase,
  Clock,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { User, UserRole, SwanayaDatabase, Course } from '../db/mockDb';
import { auth } from '../firebase';
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithPopup, signOut } from 'firebase/auth';
import { academyService } from '../services/academyService';
import ThemeToggle from './ThemeToggle';
import campusStudioImg from '../assets/images/academy_campus_studio_1794672061245.jpg';
import filmProductionImg from '../assets/images/academy_film_production_1794672061497.jpg';
import codingLabImg from '../assets/images/academy_coding_lab_1794672063747.jpg';

const ACADEMY_GALLERY = [
  {
    id: 'campus',
    src: campusStudioImg,
    alt: 'Swanaya Media Academy main campus atrium with collaborative glass studios in Kerala',
    title: 'Swanaya Campus Atrium',
    subtitle: 'Architectural studios & collaborative learning spaces',
    location: 'Thiruvananthapuram, Kerala',
  },
  {
    id: 'cinema',
    src: filmProductionImg,
    alt: 'Students training with cinema camera equipment and studio lighting inside Swanaya Media Academy',
    title: 'Cinema & Media Stage',
    subtitle: 'Hands-on camera direction, lighting & post-production',
    location: 'Studio Floor A',
  },
  {
    id: 'coding',
    src: codingLabImg,
    alt: 'Mentor guiding software engineering students at ultrawide workstations in the AI engineering lab',
    title: 'AI & Software Lab',
    subtitle: 'Production web engineering & mentored studio builds',
    location: 'Engineering Wing',
  },
];

export type AuthGatewayMode =
  | 'signin'
  | 'register'
  | 'verify-pending'
  | 'verify-result'
  | 'forgot-password'
  | 'reset-password'
  | 'confirm-email-change';

interface AuthGatewayProps {
  onLoginSuccess: (user: User) => void;
  onBack: () => void;
  initialCourseId?: string;
  initialAuthMode?: AuthGatewayMode;
  initialRoleTab?: 'ADMIN' | 'TUTOR' | 'STUDENT';
  actionToken?: string;
  onClearUrlAction?: () => void;
  onOpenCourseSelection?: (currentCourseId?: string) => void;
  initialForgotEmail?: string;
}

const ROLE_STYLES = {
  ADMIN: {
    label: 'ADMIN',
    activeBg: 'bg-[var(--sma-primary)] text-white',
    accentText: 'text-[var(--sma-primary)]',
    accentBorder: 'border-[var(--sma-primary)]/40',
    accentBgSoft: 'bg-[var(--sma-primary)]/12',
    btnBg: 'bg-[var(--sma-primary)] hover:bg-[var(--sma-primary-hover)] text-white',
  },
  TUTOR: {
    label: 'TUTOR',
    activeBg: 'bg-[var(--sma-secondary)] text-white',
    accentText: 'text-[var(--sma-secondary)] dark:text-[#75A7E0]',
    accentBorder: 'border-[var(--sma-secondary)]/40',
    accentBgSoft: 'bg-[var(--sma-secondary)]/12',
    btnBg: 'bg-[var(--sma-secondary)] hover:bg-[var(--sma-secondary-hover)] text-white',
  },
  STUDENT: {
    label: 'STUDENT',
    activeBg: 'bg-[var(--sma-accent)] text-white',
    accentText: 'text-[var(--sma-accent)]',
    accentBorder: 'border-[var(--sma-accent)]/40',
    accentBgSoft: 'bg-[var(--sma-accent)]/12',
    btnBg: 'bg-[var(--sma-accent)] hover:bg-[var(--sma-accent-hover)] text-white',
  },
};

export default function AuthGateway({
  onLoginSuccess,
  onBack,
  initialCourseId,
  initialAuthMode,
  initialRoleTab,
  actionToken,
  onClearUrlAction,
  onOpenCourseSelection,
  initialForgotEmail,
}: AuthGatewayProps) {
  const [authMode, setAuthMode] = useState<AuthGatewayMode>(initialAuthMode || 'signin');
  const [selectedRoleTab, setSelectedRoleTab] = useState<'ADMIN' | 'TUTOR' | 'STUDENT'>(initialRoleTab || 'STUDENT');

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Sign In state
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [infoBanner, setInfoBanner] = useState('');
  const [loading, setLoading] = useState(false);

  // Dynamic Database state (Firestore courses)
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [regCourseId, setRegCourseId] = useState(initialCourseId || '');
  const academySettings = SwanayaDatabase.get<any>('settings') || {};
  const supportPhone = academySettings.phone || '+91 94460 55555';
  const cleanSupportPhone = supportPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');

  // Registration state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Email verification state
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingRole, setPendingRole] = useState<'STUDENT' | 'INSTRUCTOR'>('STUDENT');
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [verifyState, setVerifyState] = useState<'idle' | 'loading' | 'success' | 'expired' | 'error'>('idle');
  const [verifyFeedback, setVerifyFeedback] = useState('');
  const [verifyPendingApproval, setVerifyPendingApproval] = useState(false);
  const processedTokenRef = useRef<string>('');

  // Forgot & Reset Password state
  const [forgotEmail, setForgotEmail] = useState(initialForgotEmail || '');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Email change confirmation state
  const [emailChangeState, setEmailChangeState] = useState<'loading' | 'success' | 'error'>('loading');
  const [emailChangeMsg, setEmailChangeMsg] = useState('');

  // Academy Showcase Gallery state
  const [featuredPhotoId, setFeaturedPhotoId] = useState<string>('campus');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const featuredPhoto = ACADEMY_GALLERY.find((item) => item.id === featuredPhotoId) || ACADEMY_GALLERY[0];

  const roleStyle = ROLE_STYLES[selectedRoleTab];

  useEffect(() => {
    if (initialAuthMode) {
      setAuthMode(initialAuthMode);
    }
  }, [initialAuthMode]);

  useEffect(() => {
    if (initialForgotEmail) {
      setForgotEmail(initialForgotEmail);
    }
  }, [initialForgotEmail]);

  useEffect(() => {
    if (initialRoleTab) {
      setSelectedRoleTab(initialRoleTab);
      setError('');
    }
  }, [initialRoleTab]);

  useEffect(() => {
    if (initialCourseId) {
      setRegCourseId(initialCourseId);
    }
  }, [initialCourseId]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    const unsubscribe = academyService.subscribeCourses({
      includeUnpublished: false,
      onData: (activeCourses) => {
        setCoursesList(activeCourses);
        if (activeCourses.length > 0) {
          setRegCourseId((prev) => {
            if (initialCourseId && activeCourses.some((c) => c.id === initialCourseId)) return initialCourseId;
            if (prev && activeCourses.some((c) => c.id === prev)) return prev;
            return activeCourses[0].id;
          });
        }
      },
    });
    return () => unsubscribe();
  }, [initialCourseId]);

  // Execute token verification automatically when arriving via email link
  useEffect(() => {
    if (!actionToken) return;
    const actionKey = `${authMode}:${actionToken}`;
    if (processedTokenRef.current === actionKey) return;

    if (authMode === 'verify-result') {
      processedTokenRef.current = actionKey;
      setVerifyState('loading');
      setVerifyFeedback('');
      academyService
        .verifyEmailToken(actionToken)
        .then((res) => {
          setVerifyState('success');
          setVerifyPendingApproval(Boolean(res?.pendingApproval));
          setPendingEmail(res?.email || '');
          setVerifyFeedback(res?.message || 'Your email has been successfully verified.');
        })
        .catch((err: any) => {
          if (err?.email) setPendingEmail(err.email);
          if (err?.code === 'TOKEN_EXPIRED') {
            setVerifyState('expired');
          } else {
            setVerifyState('error');
          }
          setVerifyFeedback(err?.message || 'Verification link is invalid or has already been used.');
        });
    } else if (authMode === 'confirm-email-change') {
      processedTokenRef.current = actionKey;
      setEmailChangeState('loading');
      setEmailChangeMsg('');
      academyService
        .confirmEmailChange(actionToken)
        .then((res) => {
          setEmailChangeState('success');
          setEmailChangeMsg(res?.message || 'Email address updated and verified successfully.');
        })
        .catch((err: any) => {
          setEmailChangeState('error');
          setEmailChangeMsg(err?.message || 'Email change link is invalid or expired.');
        });
    }
  }, [authMode, actionToken]);

  const switchToMode = (nextMode: AuthGatewayMode) => {
    setAuthMode(nextMode);
    setError('');
    setInfoBanner('');
    setResendMessage('');
    setResendError('');
    if (nextMode === 'signin' || nextMode === 'register') {
      onClearUrlAction?.();
    }
  };

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setError('');
    setInfoBanner('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const lowerEmail = String(firebaseUser.email || '').trim().toLowerCase();
      const isAdminEmail =
        lowerEmail === 'swanayamediaenterprisesadmins@gmail.com' ||
        lowerEmail === 'swanyamediaenterprisesadmins@gmail.com' ||
        lowerEmail === 'aadithyan@swanayamedia.com' ||
        lowerEmail === 'aadithyan.menon@swanayamedia.com' ||
        lowerEmail === 'aadithyanmmenon@gmail.com';
      const chosenCourseId = initialCourseId || regCourseId || coursesList[0]?.id || '';

      if (!firebaseUser.emailVerified && !isAdminEmail) {
        await signOut(auth).catch(() => {});
        setError('Your Google account email must be verified before signing in.');
        setLoading(false);
        return;
      }

      let userProfile = await academyService.getUserProfile(firebaseUser.uid);
      const activeGrant = !isAdminEmail ? await academyService.findActiveAdminGrantByEmail(lowerEmail) : null;

      if (userProfile?.status === 'INACTIVE' && !isAdminEmail) {
        await signOut(auth).catch(() => {});
        setError('This account has been deactivated. Please contact the Managing Director.');
        setLoading(false);
        return;
      }

      if (selectedRoleTab === 'ADMIN') {
        const existingRole = String(userProfile?.role || '').toUpperCase();
        const isExistingTopAuthority =
          existingRole === 'MD' || existingRole === 'SUPER_ADMIN' || existingRole === 'PRINCIPAL';
        if (!isAdminEmail && !isExistingTopAuthority && !activeGrant) {
          await signOut(auth).catch(() => {});
          setError(
            'Admin access can only be added by the Managing Director (MD). No active admin authorization exists for this email.'
          );
          setLoading(false);
          return;
        }
      }

      if (!userProfile) {
        const resolvedRole: UserRole = isAdminEmail
          ? 'MD'
          : activeGrant
          ? activeGrant.role
          : selectedRoleTab === 'TUTOR'
          ? 'INSTRUCTOR'
          : 'STUDENT';

        userProfile = {
          id: firebaseUser.uid,
          ...(isAdminEmail ? { username: 'aadithyan', designation: 'Managing Director' } : {}),
          name: isAdminEmail
            ? 'AADITHYAN M MENON'
            : activeGrant?.name || firebaseUser.displayName || 'New Scholar',
          email: firebaseUser.email,
          role: resolvedRole,
          status: 'ACTIVE',
          isVerified: true,
          email_verified: true,
          emailVerifiedAt: new Date().toISOString(),
          ...(isAdminEmail ? { adminAcceptanceStatus: 'ACCEPTED', avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=AdithyanMenon' } : {}),
          ...(resolvedRole === 'INSTRUCTOR' ? { tutorApprovalStatus: 'PENDING_APPROVAL' } : {}),
          ...(activeGrant ? { grantId: activeGrant.id } : {}),
          ...(!isAdminEmail && !activeGrant && chosenCourseId
            ? {
                courseId: chosenCourseId,
                preferredCourseId: chosenCourseId,
                enrolledCourseIds: [chosenCourseId],
              }
            : {}),
        };
        await academyService.createUserProfile(firebaseUser.uid, userProfile);
      } else if (isAdminEmail) {
        const currentRole = String(userProfile.role || '').toUpperCase();
        const needsNormalize =
          !['MD', 'SUPER_ADMIN'].includes(currentRole) ||
          userProfile.username !== 'aadithyan' ||
          userProfile.designation !== 'Managing Director' ||
          userProfile.name !== 'AADITHYAN M MENON' ||
          userProfile.status !== 'ACTIVE';
        userProfile = {
          ...userProfile,
          id: firebaseUser.uid,
          username: 'aadithyan',
          name: 'AADITHYAN M MENON',
          designation: 'Managing Director',
          email: userProfile.email || firebaseUser.email,
          role: 'MD',
          status: 'ACTIVE',
          isVerified: true,
          email_verified: true,
          adminAcceptanceStatus: 'ACCEPTED',
        };
        if (needsNormalize) {
          await academyService.updateUserProfile(firebaseUser.uid, userProfile);
        }
      } else if (activeGrant) {
        const currentRole = String(userProfile.role || '').toUpperCase();
        if (currentRole !== activeGrant.role || userProfile.grantId !== activeGrant.id) {
          userProfile = {
            ...userProfile,
            id: firebaseUser.uid,
            role: activeGrant.role,
            grantId: activeGrant.id,
            status: 'ACTIVE',
            email_verified: true,
            isVerified: true,
          };
          await academyService.updateUserProfile(firebaseUser.uid, userProfile);
        }
      }

      if (userProfile.role === 'INSTRUCTOR' && userProfile.tutorApprovalStatus === 'PENDING_APPROVAL') {
        await signOut(auth).catch(() => {});
        setError('Your Tutor account email is verified, and registration is awaiting Administrator approval.');
        setLoading(false);
        return;
      }

      await academyService
        .establishFirebaseBackendSession({
          userId: userProfile.id || firebaseUser.uid,
          email: lowerEmail,
          role: userProfile.role,
          emailVerified: true,
        })
        .catch(() => {});

      onLoginSuccess(userProfile as User);
    } catch (err: any) {
      setError('Google Sign-In failed: ' + (err?.message || 'Unable to authenticate'));
    } finally {
      setLoading(false);
    }
  };

  // Handle Credential Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoBanner('');
    setLoading(true);

    try {
      const result = await academyService.loginWithCredentials({
        identifier: loginInput.trim(),
        password,
        portalTab: selectedRoleTab,
      });
      if (result?.user) {
        onLoginSuccess(result.user);
      }
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_VERIFIED' && err?.email) {
        setPendingEmail(err.email);
        setInfoBanner('Email verification is required before signing in. You can resend your verification link below.');
      }
      setError(err?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Account Registration with Mandatory Email Verification
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoBanner('');

    const cleanName = regName.trim();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPhone = regPhone.trim();

    if (!cleanName || !cleanUsername || !cleanEmail || !regPassword) {
      setError('Please fill in all required fields including full name, username, and email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      return;
    }

    setLoading(true);
    try {
      const finalRole: 'STUDENT' | 'INSTRUCTOR' = regRole === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'STUDENT';
      const res = await academyService.registerAccount({
        name: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        password: regPassword,
        role: finalRole,
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        courseId: regCourseId || coursesList[0]?.id || undefined,
      });

      setPendingEmail(res?.email || cleanEmail);
      setPendingRole(finalRole);
      setVerificationPreviewUrl(res?.previewUrl || '');
      setRegPassword('');
      setRegConfirmPassword('');
      setResendCooldown(45);
      setResendError('');
      setResendMessage(res?.message || `Verification link sent to ${cleanEmail}. Check your inbox to activate your account.`);
      setAuthMode('verify-pending');
    } catch (err: any) {
      setError(err?.message || 'Unable to register account.');
    } finally {
      setLoading(false);
    }
  };

  // Resend Email Verification Link
  const handleResendVerificationEmail = async (targetEmail?: string) => {
    const emailToUse = (targetEmail || pendingEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToUse)) {
      setResendError('Please enter a valid email address to resend the verification link.');
      return;
    }
    setResendError('');
    setResendMessage('');
    setLoading(true);
    try {
      const res = await academyService.resendVerificationEmail(emailToUse);
      setPendingEmail(emailToUse);
      setResendCooldown(45);
      setResendMessage(res?.message || `A fresh verification link has been sent to ${emailToUse}.`);
    } catch (err: any) {
      if (err?.retryAfterSec) setResendCooldown(Number(err.retryAfterSec));
      setResendError(err?.message || 'Unable to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password Request (Backend + Firebase Auth Password Reset)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotSuccessMsg('');
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await academyService.requestPasswordReset(cleanEmail);
      // Trigger Firebase Auth password reset email in parallel for Firebase-managed credentials
      await sendPasswordResetEmail(auth, cleanEmail).catch(() => {});
      setForgotSuccessMsg(res?.message || 'If an account exists for that email address, password reset instructions have been sent.');
    } catch (err: any) {
      setError(err?.message || 'Could not process password reset request.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset Password Completion
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccessMsg('');
    if (resetNewPass.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (resetNewPass !== resetConfirmPass) {
      setError('Passwords do not match.');
      return;
    }
    if (!actionToken) {
      setError('Missing password reset token. Please open the link from your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await academyService.completePasswordReset(actionToken, resetNewPass);
      setResetSuccessMsg(res?.message || 'Password updated successfully.');
      setResetNewPass('');
      setResetConfirmPass('');
    } catch (err: any) {
      setError(err?.message || 'Password reset link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-role={selectedRoleTab}
      className="min-h-screen bg-[var(--sma-active-bg)] text-[var(--sma-active-text)] flex flex-col md:flex-row font-sans relative overflow-x-hidden transition-colors duration-200"
    >
      {/* Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[560px] h-[560px] bg-[var(--sma-primary)]/12 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 -right-40 w-[560px] h-[560px] bg-[var(--sma-secondary)]/12 rounded-full blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 w-[480px] h-[480px] bg-[var(--sma-accent)]/10 rounded-full blur-[120px]" />
      </div>

      {/* LEFT MAIN STAGE: Top Bar + Campus Showcase + Footer */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-between">
        <header className="border-b border-[var(--sma-active-border)] bg-[var(--sma-active-surface)]/95 backdrop-blur-xl">
          <div className="px-5 sm:px-8 lg:px-10 py-3.5 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-xs font-semibold text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)] transition-colors cursor-pointer whitespace-nowrap shrink-0 group"
            >
              <ArrowLeft className="w-4 h-4 text-[var(--sma-primary)] group-hover:-translate-x-1 transition-transform" />
              <span>Back to Website</span>
            </button>

            <div className="flex items-center gap-3 min-w-0">
              <span className="font-serif font-bold text-sm tracking-widest text-[var(--sma-active-text)] truncate">
                SWANAYA MEDIA ACADEMY
              </span>
              <span aria-hidden="true" className="text-[var(--sma-primary)] hidden sm:inline">·</span>
              <span className="hidden xl:inline text-xs text-[var(--sma-active-text-muted)] font-mono whitespace-nowrap">
                ACADEMIC PORTAL ACCESS
              </span>
              <ThemeToggle compact />
            </div>
          </div>
        </header>

        {/* Left Showcase Stage */}
        <main className="flex-1 flex items-center py-8 lg:py-10 px-5 sm:px-8 lg:px-10 xl:px-12">
          <section className="w-full max-w-4xl space-y-7 text-left">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.18em] uppercase font-bold text-[var(--sma-primary)]">
                <Sparkles className="w-3.5 h-3.5 text-[var(--sma-accent)] shrink-0" />
                <span>Swanaya Media Enterprises · Academic Platform</span>
              </p>

              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-serif font-extrabold text-[var(--sma-active-text)] tracking-tight leading-[1.08] text-balance">
                LEARN TODAY. <br />
                <span
                  className="text-transparent bg-clip-text"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, var(--sma-primary), var(--sma-secondary), var(--sma-accent))',
                  }}
                >
                  LEAD TOMORROW.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[var(--sma-active-text-muted)] max-w-xl leading-relaxed font-sans">
                Build Your Future With The Power Of Knowledge. Direct academic portal access across Student, Tutor, and Executive dashboards.
              </p>
            </div>

            {/* Campus Gallery Card */}
            <div className="relative rounded-2xl overflow-hidden border border-[#E5E1EA] dark:border-[#38384B] bg-[#FFFFFF] dark:bg-[#242436] aspect-video shadow-xl group">
              {brokenImages[featuredPhoto.id] ? (
                <div className="w-full h-full bg-gradient-to-br from-[#7652A8]/15 to-[#477DBB]/15 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <Camera className="w-10 h-10 text-[#477DBB] dark:text-[#75A7E0]" />
                  <p className="text-base font-serif font-semibold text-[#25263A] dark:text-[#F5F3FA]">{featuredPhoto.title}</p>
                  <p className="text-xs text-[#555770] dark:text-[#B8B5C5]">{featuredPhoto.subtitle}</p>
                </div>
              ) : (
                <img
                  src={featuredPhoto.src}
                  alt={featuredPhoto.alt}
                  referrerPolicy="no-referrer"
                  onError={() => setBrokenImages((prev) => ({ ...prev, [featuredPhoto.id]: true }))}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#151521]/90 via-[#151521]/30 to-transparent pointer-events-none" />

              <div className="absolute top-4 left-4 flex gap-2">
                {ACADEMY_GALLERY.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setFeaturedPhotoId(photo.id)}
                    className={`h-2.5 rounded-full transition-all cursor-pointer ${
                      featuredPhotoId === photo.id ? 'bg-[#75A7E0] w-8' : 'bg-white/50 hover:bg-white/80 w-2.5'
                    }`}
                    title={photo.title}
                  />
                ))}
              </div>

              <div className="absolute bottom-0 inset-x-0 p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#75A7E0] font-mono font-bold">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{featuredPhoto.location}</span>
                  </div>
                  <h3 className="text-lg font-serif font-bold text-white">{featuredPhoto.title}</h3>
                  <p className="text-xs text-[#B8B5C5]">{featuredPhoto.subtitle}</p>
                </div>
                {onOpenCourseSelection && (
                  <button
                    type="button"
                    onClick={() => onOpenCourseSelection()}
                    className="px-4 py-2 bg-[#477DBB] hover:bg-[#3A6BA3] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer whitespace-nowrap"
                  >
                    Explore Courses ↗
                  </button>
                )}
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-1 shadow-xs">
                <GraduationCap className="w-5 h-5 text-[#477DBB] dark:text-[#75A7E0]" />
                <p className="text-xs font-bold text-[#25263A] dark:text-[#F5F3FA]">Professional Courses</p>
                <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Industry Standard Curricula</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-1 shadow-xs">
                <Sparkles className="w-5 h-5 text-[#7652A8] dark:text-[#A985D6]" />
                <p className="text-xs font-bold text-[#25263A] dark:text-[#F5F3FA]">AI &amp; Digital Skills</p>
                <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Next-Gen Tech Mastery</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-1 shadow-xs">
                <Award className="w-5 h-5 text-[#529B78] dark:text-[#76BD99]" />
                <p className="text-xs font-bold text-[#25263A] dark:text-[#F5F3FA]">Verified Credentials</p>
                <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Secure Digital Certification</p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-1 shadow-xs">
                <Briefcase className="w-5 h-5 text-[#7652A8] dark:text-[#A985D6]" />
                <p className="text-xs font-bold text-[#25263A] dark:text-[#F5F3FA]">Career Support</p>
                <p className="text-[11px] text-[#555770] dark:text-[#B8B5C5]">Placement &amp; Mentorship</p>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--sma-active-border)] bg-[var(--sma-active-surface)]/95 py-4 px-6 sm:px-8 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--sma-active-text-muted)]">
          <div className="flex flex-wrap items-center gap-2 text-center sm:text-left">
            <span className="font-serif font-bold text-[var(--sma-active-text)] tracking-widest">SWANAYA MEDIA ACADEMY</span>
            <span className="hidden sm:inline text-[var(--sma-primary)]">·</span>
            <span className="font-mono text-[11px]">A Division of Swanaya Media Enterprises</span>
          </div>
          <p className="text-[var(--sma-accent)] font-mono font-semibold tracking-wider text-[11px]">
            &ldquo;BUILD SKILLS. BUILD CAREERS.&rdquo;
          </p>
        </footer>
      </div>

      {/* RIGHT EDGE SIDE PANEL: Authentication & Verification Drawer */}
      <aside
        aria-label="Authentication Panel"
        className="relative z-20 w-full md:w-[400px] lg:w-[450px] xl:w-[480px] shrink-0 bg-[var(--sma-active-surface)] border-t md:border-t-0 md:border-l border-[var(--sma-active-border)] md:sticky md:top-0 md:min-h-screen md:max-h-screen md:overflow-y-auto flex flex-col justify-center p-6 sm:p-8 shadow-2xl"
      >
        <div className="w-full max-w-md mx-auto space-y-5">
          {/* Panel Header */}
          <div className="text-center space-y-2 border-b border-[var(--sma-active-border)] pb-4">
            <div className={`inline-flex p-3 rounded-2xl ${roleStyle.accentBgSoft} border ${roleStyle.accentBorder} mb-1`}>
              <Shield className={`w-6 h-6 ${roleStyle.accentText}`} />
            </div>
            <h2 className="text-lg font-serif font-extrabold text-[var(--sma-active-text)] tracking-wider">
              SWANAYA MEDIA ACADEMY
            </h2>
            <p className={`text-xs font-mono tracking-widest uppercase font-bold ${roleStyle.accentText}`}>
              {selectedRoleTab === 'ADMIN'
                ? 'ADMIN PORTAL · GOVERNANCE'
                : selectedRoleTab === 'TUTOR'
                ? 'TUTOR PORTAL · ACADEMIC FACULTY'
                : 'STUDENT PORTAL · LEARNING ACCESS'}
            </p>
          </div>

          {/* Role & Auth Mode Switchers (hidden during token resolution & pending flows) */}
          {(authMode === 'signin' || authMode === 'register') && (
            <div className="space-y-3">
              {/* Role Tabs with Theme-Driven Role Colours */}
              <div className="grid grid-cols-3 gap-1.5 bg-[var(--sma-active-bg)] p-1 border border-[var(--sma-active-border)] rounded-xl">
                {(['ADMIN', 'TUTOR', 'STUDENT'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setSelectedRoleTab(r);
                      setError('');
                      setInfoBanner('');
                      if (r === 'TUTOR') setRegRole('INSTRUCTOR');
                      if (r === 'STUDENT') setRegRole('STUDENT');
                    }}
                    className={`py-2 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer text-center truncate whitespace-nowrap ${
                      selectedRoleTab === r
                        ? `${ROLE_STYLES[r].activeBg} shadow-sm`
                        : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* Sign In vs Register Switcher */}
              <div className="flex bg-[var(--sma-active-bg)] p-1 border border-[var(--sma-active-border)] rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => switchToMode('signin')}
                  className={`flex-1 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    authMode === 'signin'
                      ? `${roleStyle.btnBg} shadow font-bold`
                      : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchToMode('register')}
                  className={`flex-1 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    authMode === 'register'
                      ? `${roleStyle.btnBg} shadow font-bold`
                      : 'text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)]'
                  }`}
                >
                  Register Account
                </button>
              </div>
            </div>
          )}

          {/* ================= SIGN IN ================= */}
          {authMode === 'signin' && (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 font-semibold bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {infoBanner && (
                  <div className="flex items-start gap-2 text-xs text-[#477DBB] dark:text-[#75A7E0] font-semibold bg-[#477DBB]/10 border border-[#477DBB]/30 p-3 rounded-xl">
                    <Phone className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{infoBanner}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-left">
                  <label className="text-[11px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider flex items-center gap-1.5 font-mono">
                    <UserIcon className={`w-3.5 h-3.5 ${roleStyle.accentText}`} />
                    Username or Email
                  </label>
                  <input
                    type="text"
                    required
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="Enter Username or Email"
                    className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-4 py-3 text-xs text-[#25263A] dark:text-[#F5F3FA] placeholder-[#555770]/60 dark:placeholder-[#B8B5C5]/60 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider font-mono">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginInput.includes('@') ? loginInput.trim() : '');
                        setForgotSuccessMsg('');
                        switchToMode('forgot-password');
                      }}
                      className={`text-[11px] font-semibold hover:underline cursor-pointer ${roleStyle.accentText}`}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-4 py-3 pr-10 text-xs text-[#25263A] dark:text-[#F5F3FA] placeholder-[#555770]/60 dark:placeholder-[#B8B5C5]/60 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-3 text-[#555770] dark:text-[#B8B5C5] hover:text-[#25263A] dark:hover:text-[#F5F3FA] transition-colors cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 text-[#555770] dark:text-[#B8B5C5] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded accent-[#7652A8]"
                    />
                    <span>Remember session</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!pendingEmail && loginInput.includes('@')) setPendingEmail(loginInput.trim().toLowerCase());
                      setAuthMode('verify-pending');
                    }}
                    className="text-[11px] text-[#555770] dark:text-[#B8B5C5] hover:underline cursor-pointer"
                  >
                    Need verification email?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3.5 ${roleStyle.btnBg} font-bold uppercase text-xs tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60`}
                >
                  {loading ? (
                    'Authenticating...'
                  ) : (
                    <>
                      <span>Sign In with Username &amp; Password ({selectedRoleTab})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[#E5E1EA] dark:border-[#38384B]" />
                <span className="flex-shrink mx-3 text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-mono tracking-widest">
                  OR CONTINUE WITH GOOGLE
                </span>
                <div className="flex-grow border-t border-[#E5E1EA] dark:border-[#38384B]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 bg-[#FFFFFF] dark:bg-[#242436] text-[#25263A] dark:text-[#F5F3FA] font-bold uppercase text-xs tracking-wider rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-3 border border-[#E5E1EA] dark:border-[#38384B] hover:border-[#7652A8] dark:hover:border-[#A985D6]"
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  className="w-4 h-4"
                />
                {loading ? 'Authenticating...' : `Continue with Google (${selectedRoleTab})`}
              </button>

              <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] text-center">
                <a
                  href={`https://wa.me/${cleanSupportPhone}?text=${encodeURIComponent(
                    'Hello Academy Support! I need assistance accessing my Swanaya Media Academy account.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 bg-[#529B78]/12 hover:bg-[#529B78]/20 dark:bg-[#76BD99]/15 dark:hover:bg-[#76BD99]/25 border border-[#529B78]/35 dark:border-[#76BD99]/35 text-[#2E7051] dark:text-[#76BD99] rounded-xl text-xs font-bold font-mono transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Academy Support Desk ({supportPhone})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* ================= REGISTER ================= */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left">
              {selectedRoleTab === 'ADMIN' && (
                <div className="p-3 rounded-xl bg-[#7652A8]/10 dark:bg-[#A985D6]/15 border border-[#7652A8]/30 dark:border-[#A985D6]/35 text-xs text-[#5E3C8F] dark:text-[#D5BEFA] space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Admin Accounts Restricted
                  </p>
                  <p className="text-[11px]">
                    Public Admin registration is disabled. Administrators are provisioned solely by the Managing Director (MD). Public sign-up creates Student or Tutor accounts requiring email verification.
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 font-semibold bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Ananya Nair"
                    className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3 py-2.5 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider">Username *</label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. ananya"
                    className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3 py-2.5 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3 py-2.5 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider">Account Role *</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'STUDENT')}
                    className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3 py-2.5 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                  >
                    <option value="STUDENT">Student Scholar</option>
                    <option value="INSTRUCTOR">Faculty / Tutor</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3 py-2.5 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                  />
                </div>
              </div>

              {coursesList.length > 0 && regRole === 'STUDENT' && (
                <div className="space-y-1">
                  <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider">Preferred Programme</label>
                  <select
                    value={regCourseId}
                    onChange={(e) => setRegCourseId(e.target.value)}
                    className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3 py-2.5 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                  >
                    {coursesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider">Password *</label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3 py-2.5 pr-9 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((p) => !p)}
                      className="absolute right-2.5 top-2.5 text-[#555770] dark:text-[#B8B5C5] cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#555770] dark:text-[#B8B5C5] uppercase font-bold tracking-wider">Confirm *</label>
                  <div className="relative">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Confirm"
                      className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] focus:border-[#7652A8] dark:focus:border-[#A985D6] rounded-xl px-3 py-2.5 pr-9 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword((p) => !p)}
                      className="absolute right-2.5 top-2.5 text-[#555770] dark:text-[#B8B5C5] cursor-pointer"
                    >
                      {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3.5 ${roleStyle.btnBg} font-bold uppercase text-xs tracking-wider rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60`}
              >
                {loading ? 'Sending Verification Email...' : 'Create Account & Send Verification Link'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => switchToMode('signin')}
                  className={`text-xs font-semibold hover:underline cursor-pointer ${roleStyle.accentText}`}
                >
                  Already registered? Sign In
                </button>
              </div>
            </form>
          )}

          {/* ================= EMAIL VERIFICATION PENDING ================= */}
          {authMode === 'verify-pending' && (
            <div className="space-y-4 text-left">
              <div className="p-5 rounded-2xl bg-[#F4F3F7] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#529B78]/15 text-[#529B78] dark:text-[#76BD99]">
                    <MailCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#529B78] dark:text-[#76BD99]">
                      Verify Your Swanaya Media Academy Account
                    </p>
                    <h3 className="text-base font-serif font-bold text-[#25263A] dark:text-[#F5F3FA]">
                      Check Your Email Inbox
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-[#555770] dark:text-[#B8B5C5] leading-relaxed">
                  {pendingRole === 'INSTRUCTOR'
                    ? 'A verification link has been emailed to your address. Please click the verification button in your email to verify your email address prior to administrator approval.'
                    : 'A time-limited verification link has been emailed to your address. Open your inbox and click the verification link to activate your account.'}
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase font-bold text-[#555770] dark:text-[#B8B5C5]">
                    Registered Email Address
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={pendingEmail}
                      onChange={(e) => setPendingEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="flex-1 bg-[#FFFFFF] dark:bg-[#151521] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#529B78]"
                    />
                    <button
                      type="button"
                      disabled={loading || resendCooldown > 0}
                      onClick={() => void handleResendVerificationEmail(pendingEmail)}
                      className="px-3.5 py-2 bg-[#477DBB] hover:bg-[#3A6BA3] dark:bg-[#75A7E0] text-white dark:text-[#151521] text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap disabled:opacity-55 flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Link'}</span>
                    </button>
                  </div>
                </div>

                {verificationPreviewUrl && (
                  <a
                    href={verificationPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#477DBB] dark:text-[#75A7E0] hover:underline"
                  >
                    <span>Open Email Preview</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {resendMessage && (
                <div className="p-3 rounded-xl bg-[#529B78]/12 border border-[#529B78]/35 text-xs text-[#2E7051] dark:text-[#76BD99] flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resendMessage}</span>
                </div>
              )}

              {resendError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resendError}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => switchToMode('signin')}
                  className="text-[#477DBB] dark:text-[#75A7E0] font-semibold hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchToMode('register')}
                  className="text-[#555770] dark:text-[#B8B5C5] hover:underline cursor-pointer"
                >
                  Register Another Account
                </button>
              </div>
            </div>
          )}

          {/* ================= VERIFICATION LINK RESULT ================= */}
          {authMode === 'verify-result' && (
            <div className="space-y-4 text-left">
              <div className="p-5 rounded-2xl bg-[#F4F3F7] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-3">
                {verifyState === 'loading' && (
                  <div className="py-6 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-[#477DBB] dark:text-[#75A7E0] animate-spin mx-auto" />
                    <p className="text-sm font-bold text-[#25263A] dark:text-[#F5F3FA]">Verifying Security Token...</p>
                    <p className="text-xs text-[#555770] dark:text-[#B8B5C5]">Validating link expiration and activating account.</p>
                  </div>
                )}

                {verifyState === 'success' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 text-[#2E7051] dark:text-[#76BD99]">
                      <CheckCircle2 className="w-6 h-6 shrink-0" />
                      <h3 className="text-base font-serif font-bold">
                        {verifyPendingApproval
                          ? 'Your Account Registration Is Pending Approval'
                          : 'Your Email Has Been Successfully Verified'}
                      </h3>
                    </div>
                    <p className="text-xs text-[#555770] dark:text-[#B8B5C5] leading-relaxed">{verifyFeedback}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (pendingEmail) setLoginInput(pendingEmail);
                        switchToMode('signin');
                      }}
                      className="w-full py-3 bg-[#529B78] hover:bg-[#418262] dark:bg-[#76BD99] text-white dark:text-[#151521] font-bold uppercase text-xs tracking-wider rounded-xl cursor-pointer transition-all"
                    >
                      Proceed to Sign In
                    </button>
                  </div>
                )}

                {(verifyState === 'expired' || verifyState === 'error') && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
                      {verifyState === 'expired' ? <Clock className="w-6 h-6 shrink-0" /> : <AlertCircle className="w-6 h-6 shrink-0" />}
                      <h3 className="text-base font-serif font-bold">
                        {verifyState === 'expired' ? 'Verification Link Expired' : 'Verification Unsuccessful'}
                      </h3>
                    </div>
                    <p className="text-xs text-[#555770] dark:text-[#B8B5C5] leading-relaxed">{verifyFeedback}</p>

                    <div className="pt-2 border-t border-[#E5E1EA] dark:border-[#38384B] space-y-2.5">
                      <label className="text-[10px] font-mono uppercase font-bold text-[#555770] dark:text-[#B8B5C5] block">
                        Request a Fresh Email Verification Link
                      </label>
                      <input
                        type="email"
                        value={pendingEmail}
                        onChange={(e) => setPendingEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-[#FFFFFF] dark:bg-[#151521] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#25263A] dark:text-[#F5F3FA]"
                      />
                      <button
                        type="button"
                        disabled={loading || resendCooldown > 0}
                        onClick={() => void handleResendVerificationEmail(pendingEmail)}
                        className="w-full py-3 bg-[#529B78] hover:bg-[#428363] dark:bg-[#76BD99] text-white dark:text-[#151521] font-bold uppercase text-xs tracking-wider rounded-xl cursor-pointer disabled:opacity-55"
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
                      </button>
                      {resendMessage && (
                        <p className="text-xs text-[#2E7051] dark:text-[#76BD99] font-semibold">{resendMessage}</p>
                      )}
                      {resendError && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{resendError}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => switchToMode('signin')}
                className="text-xs text-[#477DBB] dark:text-[#75A7E0] font-semibold hover:underline cursor-pointer"
              >
                ← Return to Sign In
              </button>
            </div>
          )}

          {/* ================= FORGOT PASSWORD ================= */}
          {authMode === 'forgot-password' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-left">
              <div className="p-4 rounded-xl bg-[#F4F3F7] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-[#25263A] dark:text-[#F5F3FA]">
                  <KeyRound className="w-4 h-4 text-[#7652A8] dark:text-[#A985D6]" />
                  <span>Reset Your Academy Account Password</span>
                </div>
                <p className="text-xs text-[#555770] dark:text-[#B8B5C5]">
                  Enter your verified account email. We will send a single-use password reset link valid for 30 minutes.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              {forgotSuccessMsg && (
                <div className="p-3 rounded-xl bg-[#529B78]/12 border border-[#529B78]/35 text-xs text-[#2E7051] dark:text-[#76BD99]">
                  {forgotSuccessMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-[#555770] dark:text-[#B8B5C5]">
                  Account Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl px-4 py-3 text-xs text-[#25263A] dark:text-[#F5F3FA] focus:outline-none focus:border-[#7652A8]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#7652A8] hover:bg-[#634194] dark:bg-[#A985D6] text-white dark:text-[#151521] font-bold uppercase text-xs tracking-wider rounded-xl cursor-pointer transition-all disabled:opacity-60"
              >
                {loading ? 'Sending Reset Email...' : 'Send Password Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => switchToMode('signin')}
                className="text-xs text-[#477DBB] dark:text-[#75A7E0] font-semibold hover:underline cursor-pointer"
              >
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* ================= RESET PASSWORD COMPLETION ================= */}
          {authMode === 'reset-password' && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-left">
              <div className="p-4 rounded-xl bg-[#F4F3F7] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-1">
                <h3 className="text-sm font-bold text-[#25263A] dark:text-[#F5F3FA] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#7652A8] dark:text-[#A985D6]" />
                  <span>Set New Account Password</span>
                </h3>
                <p className="text-xs text-[#555770] dark:text-[#B8B5C5]">
                  Enter a new secure password (at least 6 characters).
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              {resetSuccessMsg ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-[#529B78]/12 border border-[#529B78]/35 text-xs text-[#2E7051] dark:text-[#76BD99] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetSuccessMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchToMode('signin')}
                    className="w-full py-3 bg-[#529B78] hover:bg-[#418262] dark:bg-[#76BD99] text-white dark:text-[#151521] font-bold uppercase text-xs tracking-wider rounded-xl cursor-pointer"
                  >
                    Sign In With New Password
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-[#555770] dark:text-[#B8B5C5]">
                      New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={resetNewPass}
                        onChange={(e) => setResetNewPass(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl px-4 py-3 pr-10 text-xs text-[#25263A] dark:text-[#F5F3FA]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword((p) => !p)}
                        className="absolute right-3 top-3 text-[#555770] dark:text-[#B8B5C5] cursor-pointer"
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-[#555770] dark:text-[#B8B5C5]">
                      Confirm New Password *
                    </label>
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={resetConfirmPass}
                      onChange={(e) => setResetConfirmPass(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-[#FFFFFF] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] rounded-xl px-4 py-3 text-xs text-[#25263A] dark:text-[#F5F3FA]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#7652A8] hover:bg-[#634194] dark:bg-[#A985D6] text-white dark:text-[#151521] font-bold uppercase text-xs tracking-wider rounded-xl cursor-pointer disabled:opacity-60"
                  >
                    {loading ? 'Updating Password...' : 'Save New Password'}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => switchToMode('forgot-password')}
                className="text-xs text-[#477DBB] dark:text-[#75A7E0] font-semibold hover:underline cursor-pointer"
              >
                Request a fresh reset link
              </button>
            </form>
          )}

          {/* ================= EMAIL CHANGE VERIFICATION ================= */}
          {authMode === 'confirm-email-change' && (
            <div className="space-y-4 text-left">
              <div className="p-5 rounded-2xl bg-[#F4F3F7] dark:bg-[#242436] border border-[#E5E1EA] dark:border-[#38384B] space-y-3">
                {emailChangeState === 'loading' && (
                  <div className="py-6 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-[#477DBB] dark:text-[#75A7E0] animate-spin mx-auto" />
                    <p className="text-sm font-bold text-[#25263A] dark:text-[#F5F3FA]">Confirming Email Change...</p>
                  </div>
                )}
                {emailChangeState === 'success' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[#2E7051] dark:text-[#76BD99]">
                      <CheckCircle2 className="w-6 h-6 shrink-0" />
                      <h3 className="text-base font-serif font-bold">Email Change Verified</h3>
                    </div>
                    <p className="text-xs text-[#555770] dark:text-[#B8B5C5]">{emailChangeMsg}</p>
                    <button
                      type="button"
                      onClick={() => switchToMode('signin')}
                      className="w-full py-3 bg-[#529B78] hover:bg-[#418262] dark:bg-[#76BD99] text-white dark:text-[#151521] font-bold uppercase text-xs tracking-wider rounded-xl cursor-pointer"
                    >
                      Continue to Sign In
                    </button>
                  </div>
                )}
                {emailChangeState === 'error' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <AlertCircle className="w-6 h-6 shrink-0" />
                      <h3 className="text-base font-serif font-bold">Email Change Failed</h3>
                    </div>
                    <p className="text-xs text-[#555770] dark:text-[#B8B5C5]">{emailChangeMsg}</p>
                    <button
                      type="button"
                      onClick={() => switchToMode('signin')}
                      className="w-full py-3 bg-[#7652A8] text-white font-bold uppercase text-xs tracking-wider rounded-xl cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
