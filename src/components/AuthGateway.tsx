/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Shield, User as UserIcon, Lock, ArrowLeft, ArrowRight, 
  Mail, Phone, UserPlus, CheckCircle2, RefreshCw, KeyRound, AlertCircle, Sparkles, Eye, EyeOff,
  MessageCircle, BookOpen, Check, ExternalLink, Camera, MapPin
} from 'lucide-react';
import { User, UserRole, SwanayaDatabase, Student, Instructor, Course } from '../db/mockDb';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { academyService } from '../services/academyService';
import VisualCaptcha from './VisualCaptcha';
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

interface AuthGatewayProps {
  onLoginSuccess: (user: User) => void;
  onBack: () => void;
  initialCourseId?: string;
  initialAuthMode?: 'signin' | 'register';
  onOpenCourseSelection?: (currentCourseId?: string) => void;
}

export default function AuthGateway({
  onLoginSuccess,
  onBack,
  initialCourseId,
  initialAuthMode,
  onOpenCourseSelection
}: AuthGatewayProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'register' | 'verify'>(initialAuthMode || 'signin');
  
  // Show password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  
  // Sign In state
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dynamic Database state (merge local DB + Firestore courses)
  const [coursesList, setCoursesList] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses") || []);
  const academySettings = SwanayaDatabase.get<any>("settings") || {};
  const adminWhatsAppPhone = academySettings.adminWhatsAppPhone || "+91 94460 12345";
  const cleanAdminPhone = adminWhatsAppPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');

  // Registration state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCourseId, setRegCourseId] = useState(initialCourseId || coursesList[0]?.id || '');

  useEffect(() => {
    if (initialAuthMode) {
      setAuthMode(initialAuthMode);
    }
  }, [initialAuthMode]);

  useEffect(() => {
    if (initialCourseId) {
      setRegCourseId(initialCourseId);
    }
  }, [initialCourseId]);

  useEffect(() => {
    let mounted = true;
    const syncCourses = async () => {
      const local = SwanayaDatabase.get<Course[]>('courses') || [];
      let cloud: any[] = [];
      try {
        const fetched = await academyService.getCourses();
        if (Array.isArray(fetched)) cloud = fetched;
      } catch {
        // Keep local store on offline/permission fallback
      }
      if (!mounted) return;
      const mergedMap = new Map<string, Course>();
      local.forEach((c) => c?.id && mergedMap.set(c.id, c));
      cloud.forEach((raw: any) => {
        if (raw?.id && !mergedMap.has(raw.id)) {
          mergedMap.set(raw.id, {
            id: raw.id,
            code: raw.code || raw.id.slice(0, 8).toUpperCase(),
            name: raw.name || raw.title || 'Academy Course',
            description: raw.description || '',
            duration: raw.duration || '6 Months',
            level: raw.level || 'DIPLOMA',
            eligibility: raw.eligibility || '',
            fee: Number(raw.fee ?? raw.fees ?? 0),
            mode: raw.mode || 'HYBRID',
            status: raw.status || 'ACTIVE',
            thumbnailUrl: raw.thumbnailUrl || '',
            coordinator: raw.coordinator || 'Academic Director',
            learningObjectives: Array.isArray(raw.learningObjectives) ? raw.learningObjectives : [],
            careerOutcomes: Array.isArray(raw.careerOutcomes) ? raw.careerOutcomes : [],
          });
        }
      });
      const active = Array.from(mergedMap.values()).filter((c) => c.status !== 'ARCHIVED');
      setCoursesList(active);
      if (active.length > 0) {
        setRegCourseId((prev) => prev || initialCourseId || active[0].id);
      }
    };
    syncCourses();
    return () => {
      mounted = false;
    };
  }, [initialCourseId]);
  const [regWhatsappPhone, setRegWhatsappPhone] = useState('');
  const [regWhatsappOptIn, setRegWhatsappOptIn] = useState(true);
  const [regRole, setRegRole] = useState<UserRole>('STUDENT');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Email OTP Verification state
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [resendNotification, setResendNotification] = useState(false);

  // CAPTCHA Verification state
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  // Academy Showcase Gallery state
  const [featuredPhotoId, setFeaturedPhotoId] = useState<string>('campus');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const featuredPhoto = ACADEMY_GALLERY.find((item) => item.id === featuredPhotoId) || ACADEMY_GALLERY[0];
  const secondaryPhotos = ACADEMY_GALLERY.filter((item) => item.id !== featuredPhoto.id);

  // --- HANDLERS ---

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      let userProfile = await academyService.getUserProfile(firebaseUser.uid);
      if (!userProfile) {
        // New user - default to student
        userProfile = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'New Scholar',
          email: firebaseUser.email,
          role: 'STUDENT',
          status: 'ACTIVE'
        };
        await academyService.createUserProfile(firebaseUser.uid, userProfile);
      }
      
      onLoginSuccess(userProfile as User);
    } catch (err: any) {
      setError('Google Login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const usersList = SwanayaDatabase.get<User[]>("users");
      const cleanInput = loginInput.trim().toLowerCase();
      
      const found = usersList.find(u => 
        (u.username && u.username.toLowerCase() === cleanInput) ||
        u.email.toLowerCase() === cleanInput ||
        u.name.toLowerCase() === cleanInput
      );
      
      if (found) {
        if (found.status === 'INACTIVE') {
          setError('This account has been deactivated. Please contact admin.');
          setLoading(false);
          return;
        }

        onLoginSuccess(found);
      } else {
        setError('Invalid credentials. Please check your username or email address.');
        setLoading(false);
      }
    }, 500);
  };

  // Handle Initial Registration Submit -> Verifies CAPTCHA on backend, generates OTP & transitions to Verification
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regName.trim() || !regUsername.trim() || !regEmail.trim() || !regPassword) {
      setError('Please fill in all required fields including your preferred Username.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    if (regPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanUsername = regUsername.trim().toLowerCase();

    // Check if account with this username or email already exists
    const usersList = SwanayaDatabase.get<User[]>("users");
    const existing = usersList.find(u => 
      (u.username && u.username.toLowerCase() === cleanUsername) ||
      u.email.toLowerCase() === cleanEmail
    );

    if (existing) {
      setError('An account with this username or email address already exists. Please choose a different username or sign in.');
      return;
    }

    if (!captchaToken) {
      setError('Please complete the human verification CAPTCHA before continuing.');
      return;
    }

    setLoading(true);
    try {
      const verifyRes = await fetch('/api/registrations/verify-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaToken, purpose: 'signup' }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.valid) {
        setError(verifyData.error || 'CAPTCHA verification failed. Please complete a fresh challenge.');
        setCaptchaToken(null);
        setCaptchaResetSignal((prev) => prev + 1);
        setLoading(false);
        return;
      }
    } catch {
      setError('Unable to verify CAPTCHA with the server. Please try again.');
      setLoading(false);
      return;
    }

    setCaptchaToken(null);
    setCaptchaResetSignal((prev) => prev + 1);
    setLoading(false);

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setEnteredOtp('');
    setVerificationError('');
    setResendNotification(false);
    setAuthMode('verify');
  };

  // Resend OTP Code
  const handleResendOtp = () => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    setEnteredOtp('');
    setVerificationError('');
    setResendNotification(true);
    setTimeout(() => setResendNotification(false), 4000);
  };

  // Handle OTP Verification & Save User
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');

    if (enteredOtp.trim() !== generatedOtp.trim()) {
      setVerificationError('Invalid verification code. Please check the 6-digit OTP sent to your email.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const usersList = SwanayaDatabase.get<User[]>("users");
      
      const newUserId = `usr-${Date.now()}`;
      const finalWhatsapp = regWhatsappPhone.trim() || regPhone.trim() || '+91 94460 00000';

      const newUser: User = {
        id: newUserId,
        username: regUsername.trim().toLowerCase(),
        email: regEmail.trim().toLowerCase(),
        name: regName.trim(),
        role: regRole,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${regName.trim()}`,
        status: 'ACTIVE',
        createdAt: new Date().toISOString().split('T')[0],
        isVerified: true,
        whatsappPhone: finalWhatsapp,
        whatsappOptIn: regWhatsappOptIn,
        preferredCourseId: regCourseId
      };

      const updatedUsers = [...usersList, newUser];
      SwanayaDatabase.set("users", updatedUsers);

      // Create linked entity if Student or Instructor
      if (regRole === 'STUDENT') {
        const studentsList = SwanayaDatabase.get<Student[]>("students");
        const newStudent: Student = {
          id: `s-${Date.now()}`,
          studentId: `SMA-2026-${Math.floor(100 + Math.random() * 900)}`,
          admissionNumber: `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: newUserId,
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          phone: regPhone.trim() || '+91 98765 43210',
          whatsappPhone: finalWhatsapp,
          whatsappOptIn: regWhatsappOptIn,
          guardianName: 'Self / Guardian',
          guardianPhone: '+91 94460 00000',
          academicBackground: 'Registered Student',
          avatarUrl: newUser.avatarUrl,
          status: 'ACTIVE',
          courseId: regCourseId,
          batchId: 'b-1',
          semesterId: 's-1-1',
          enrollmentDate: new Date().toISOString().split('T')[0],
          skills: ['Enrolled Student'],
          projectsCount: 0,
          certificatesCount: 0,
          attendancePercentage: 100,
          outstandingBalance: 145000,
          careerReadinessScore: 50
        };
        SwanayaDatabase.set("students", [...studentsList, newStudent]);
      } else if (regRole === 'INSTRUCTOR') {
        const instructorsList = SwanayaDatabase.get<Instructor[]>("instructors");
        const newInstructor: Instructor = {
          id: `inst-${Date.now()}`,
          userId: newUserId,
          name: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          phone: regPhone.trim() || '+91 98765 43210',
          qualification: 'M.Tech / Lead Specialist',
          specialization: 'Artificial Intelligence & Engineering',
          experience: '5+ Years',
          bio: 'Verified Faculty Instructor at Swanaya Academy.',
          avatarUrl: newUser.avatarUrl,
          status: 'ACTIVE',
          assignedSubjects: ['sub-101', 'sub-102']
        };
        SwanayaDatabase.set("instructors", [...instructorsList, newInstructor]);
      }

      SwanayaDatabase.log(newUser.email, newUser.name, "USER_REGISTRATION_WHATSAPP", `Registered for Course ${regCourseId} with WhatsApp Integration: ${finalWhatsapp}`);

      setLoading(false);
      onLoginSuccess(newUser);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#07090D] text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation */}
      <div className="border-b border-slate-900 bg-[#0A0D14]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-amber-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Website</span>
          </button>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-serif font-bold tracking-widest text-amber-400">SWANAYA</span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="hidden sm:inline text-slate-400">Media &amp; AI Engineering Academy</span>
          </div>
        </div>
      </div>

      {/* Main Split Showcase & Gateway */}
      <div className="flex-1 flex items-center py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

          {/* Left Column: Swanaya Media Academy Campus & Studio Gallery */}
          <div className="lg:col-span-7 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{academySettings.address || 'Thiruvananthapuram, Kerala'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-white leading-tight text-balance">
                Inside Swanaya Media Academy
              </h1>
              <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
                Explore our production stages, collaborative engineering labs, and mentored studio spaces before entering your workspace.
              </p>
            </div>

            {/* Featured 16:9 Academy Photo */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-video shadow-2xl">
              {brokenImages[featuredPhoto.id] ? (
                <div className="w-full h-full bg-gradient-to-br from-slate-900 via-[#0C1220] to-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <Camera className="w-8 h-8 text-amber-400" />
                  <p className="text-sm font-serif font-semibold text-white">{featuredPhoto.title}</p>
                  <p className="text-xs text-slate-400">{featuredPhoto.subtitle}</p>
                </div>
              ) : (
                <img
                  src={featuredPhoto.src}
                  alt={featuredPhoto.alt}
                  referrerPolicy="no-referrer"
                  onError={() => setBrokenImages((prev) => ({ ...prev, [featuredPhoto.id]: true }))}
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#07090D]/95 via-[#07090D]/30 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                    <span>{featuredPhoto.location}</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-white">
                    {featuredPhoto.title}
                  </h2>
                  <p className="text-xs text-slate-300 max-w-xl">
                    {featuredPhoto.subtitle}
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {ACADEMY_GALLERY.findIndex((g) => g.id === featuredPhoto.id) + 1} / {ACADEMY_GALLERY.length}
                </span>
              </div>
            </div>

            {/* Secondary 4:3 Campus & Lab Thumbnails */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {secondaryPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setFeaturedPhotoId(photo.id)}
                  className="group text-left relative rounded-xl overflow-hidden border border-slate-800 hover:border-amber-500/50 bg-slate-900 aspect-[4/3] transition-colors cursor-pointer"
                >
                  {brokenImages[photo.id] ? (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-1.5">
                      <Camera className="w-6 h-6 text-amber-400" />
                      <p className="text-xs font-serif font-semibold text-white">{photo.title}</p>
                    </div>
                  ) : (
                    <img
                      src={photo.src}
                      alt={photo.alt}
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenImages((prev) => ({ ...prev, [photo.id]: true }))}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07090D]/95 via-[#07090D]/35 to-transparent pointer-events-none" />
                  <div className="absolute bottom-0 inset-x-0 p-4 space-y-0.5">
                    <p className="text-[11px] font-medium text-amber-300">{photo.location}</p>
                    <p className="text-sm font-serif font-bold text-white group-hover:text-amber-200 transition-colors">
                      {photo.title}
                    </p>
                    <p className="text-xs text-slate-300 line-clamp-1">{photo.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Login & Registration Gateway */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto lg:max-w-none space-y-5">
            <div className="space-y-3 text-center lg:text-left">
              <div className="space-y-1">
                <h2 className="text-2xl font-serif font-bold text-white tracking-wide">
                  {authMode === 'signin' && 'Enter Academy Workspace'}
                  {authMode === 'register' && 'Create Swanaya Account'}
                  {authMode === 'verify' && 'Email ID Verification'}
                </h2>
                <p className="text-xs text-slate-400">
                  {authMode === 'signin' && 'Sign in using your Username or registered Email Address.'}
                  {authMode === 'register' && 'Register for Student, Instructor, or Staff portal access.'}
                  {authMode === 'verify' && 'Verify your Email ID with the 6-digit OTP code.'}
                </p>
              </div>

              {/* Tab Toggle for Sign In vs Register (only shown when not in OTP verify mode) */}
              {authMode !== 'verify' && (
                <div className="flex bg-slate-900/80 p-1 border border-slate-800 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setError(''); }}
                    className={`flex-1 py-2 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                      authMode === 'signin'
                        ? 'bg-amber-500 text-black shadow font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setError(''); }}
                    className={`flex-1 py-2 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                      authMode === 'register'
                        ? 'bg-amber-500 text-black shadow font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Register Account
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 sm:p-7 shadow-2xl space-y-6 backdrop-blur-sm">
          
          {/* ================= MODE 1: SIGN IN ================= */}
          {authMode === 'signin' && (
            <div className="space-y-5">
              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 bg-white text-slate-900 font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer shadow-md flex items-center justify-center gap-3 border border-slate-200"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                {loading ? 'Processing...' : 'Continue with Google'}
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase font-bold tracking-widest font-mono">OR</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 p-3 rounded">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-amber-400 inline" />
                    Username or Email ID *
                  </label>
                  <span className="text-[9px] text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-semibold">
                    Username Login Enabled
                  </span>
                </div>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type="text"
                    required
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="Enter Username (e.g. aadithyan, navven) or Email"
                    className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Sign in using your registered <strong className="text-slate-300 font-semibold">Username</strong> (e.g. <code className="text-amber-400 font-mono">aadithyan</code>, <code className="text-amber-400 font-mono">navven</code>) or registered Email ID.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Password</label>
                  <span className="text-[10px] text-amber-500 font-semibold cursor-pointer hover:underline">Forgot?</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-10 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-amber-400 transition-colors cursor-pointer p-0.5"
                    title={showLoginPassword ? "Hide Password" : "Show Password"}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
              >
                {loading ? 'Authenticating Gateway...' : (
                  <>
                    Authenticate <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="text-center pt-2 space-y-3">
                <p className="text-xs text-slate-500">
                  New to Swanaya Academy?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthMode('register'); setError(''); }}
                    className="text-amber-400 font-semibold hover:underline cursor-pointer"
                  >
                    Register for an Account
                  </button>
                </p>

                <div className="pt-2 border-t border-slate-800">
                  <a
                    href={`https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent('Hello Admin! I need assistance with logging in or getting portal access to Swanaya Media Academy.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 rounded text-xs font-bold font-mono transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Admin Access ({adminWhatsAppPhone})</span>
                    <ExternalLink className="w-3 h-3 text-emerald-400" />
                  </a>
                </div>
              </div>
            </form>
          </div>
          )}

          {/* ================= MODE 2: REGISTER ================= */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 p-3 rounded">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Full Name *</label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Adithyan M."
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Username *</label>
                  <div className="relative">
                    <UserPlus className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="e.g. adithyan"
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Email Address *</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="student@swanaya.edu.in"
                    className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type="tel"
                      value={regPhone}
                      onChange={(e) => {
                        setRegPhone(e.target.value);
                        if (!regWhatsappPhone) setRegWhatsappPhone(e.target.value);
                      }}
                      placeholder="+91 9876543210"
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Account Role *</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-semibold cursor-pointer"
                  >
                    <option value="STUDENT">Student</option>
                    <option value="INSTRUCTOR">Instructor / Trainer</option>
                    <option value="COUNSELLOR">Counsellor</option>
                    <option value="PARENT">Parent / Guardian</option>
                    <option value="REVIEWER">Academic Reviewer</option>
                    <option value="ALUMNI">Alumni Graduate</option>
                    <option value="FINANCE">Finance Officer</option>
                    <option value="CAREER">Career Specialist</option>
                  </select>
                </div>
              </div>

              {/* COURSE SELECTION INTEGRATION */}
              <div className="space-y-2.5 bg-slate-950/60 p-3.5 border border-slate-800 rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] text-amber-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    Select Enrolled / Preferred Course *
                  </label>
                  {onOpenCourseSelection && (
                    <button
                      type="button"
                      onClick={() => onOpenCourseSelection(regCourseId)}
                      className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Open Course Selection Page →
                    </button>
                  )}
                </div>
                
                {coursesList.length === 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-xs space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>No Courses Published Yet</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-normal">
                      The admin has not published any courses yet. No preloaded dummy courses are shown. Please contact Admin via WhatsApp to get course access or wait for Admin to update courses.
                    </p>
                    <a
                      href={`https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent(
                        `Hello Admin! I am trying to register for a course at Swanaya Media Academy. My name is ${regName || 'Student'}. Please share available courses.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold font-mono transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Contact Admin on WhatsApp ({adminWhatsAppPhone})</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <>
                    <select
                      value={regCourseId}
                      onChange={(e) => setRegCourseId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-semibold cursor-pointer"
                    >
                      {coursesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code ? `${c.code}: ` : ''}{c.name} ({c.duration || 'Flexible'})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Your student profile will be linked to this active syllabus.
                    </p>
                  </>
                )}
              </div>

              {/* WHATSAPP INTEGRATION SECTION */}
              <div className="space-y-2 bg-emerald-950/20 p-3 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    WhatsApp Direct Integration
                  </label>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded font-bold">
                    Admin Desk: {adminWhatsAppPhone}
                  </span>
                </div>

                <div className="relative">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500 absolute left-3 top-2.5" />
                  <input 
                    type="tel"
                    value={regWhatsappPhone}
                    onChange={(e) => setRegWhatsappPhone(e.target.value)}
                    placeholder={`WhatsApp Number (e.g. ${adminWhatsAppPhone})`}
                    className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>

                <label className="flex items-start gap-2 cursor-pointer pt-1">
                  <input 
                    type="checkbox"
                    checked={regWhatsappOptIn}
                    onChange={(e) => setRegWhatsappOptIn(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-400 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-300 leading-normal">
                    Receive instant class timetables, assignment deadlines, and fee receipts on WhatsApp.
                  </span>
                </label>

                {/* Direct WhatsApp Pre-filled Chat Trigger */}
                <div className="pt-1">
                  <a
                    href={`https://wa.me/${cleanAdminPhone}?text=${encodeURIComponent(
                      `Hello Swanaya Media Academy Admin! I am registering on the portal as ${regName || 'a new user'} (${regRole}). Please assist with account setup.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors font-mono"
                  >
                    <span>💬 WhatsApp Admin Access Desk</span>
                    <ExternalLink className="w-3 h-3 text-emerald-400" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Password *</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type={showRegPassword ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-8 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2 top-2 text-slate-500 hover:text-amber-400 transition-colors cursor-pointer p-0.5"
                      title={showRegPassword ? "Hide Password" : "Show Password"}
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type={showRegConfirmPassword ? "text" : "password"}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-8 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute right-2 top-2 text-slate-500 hover:text-amber-400 transition-colors cursor-pointer p-0.5"
                      title={showRegConfirmPassword ? "Hide Password" : "Show Password"}
                    >
                      {showRegConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <VisualCaptcha
                purpose="signup"
                onTokenChange={setCaptchaToken}
                resetSignal={captchaResetSignal}
              />

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Continue to Email Verification'} <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setAuthMode('signin'); setError(''); }}
                    className="text-amber-400 font-semibold hover:underline cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* ================= MODE 3: EMAIL OTP VERIFICATION ================= */}
          {authMode === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              
              {/* Verification Dispatch Notification Card */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Verification Email Sent to {regEmail}</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  We have dispatched a 6-digit confirmation OTP to your email address for account activation.
                </p>
                <div className="bg-slate-950 border border-amber-500/40 rounded p-2.5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Demonstration OTP Code:</span>
                  <span className="text-base font-mono font-bold text-amber-300 tracking-widest bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                    {generatedOtp}
                  </span>
                </div>
              </div>

              {/* WhatsApp Notification Integration Badge */}
              {regWhatsappOptIn && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>WhatsApp Integration Armed: <strong className="text-white">{regWhatsappPhone || regPhone || '+91 94460 00000'}</strong></span>
                  </div>
                  <a
                    href={`https://wa.me/919446000000?text=${encodeURIComponent(
                      `Hello Swanaya Media Academy! I am verifying my email ${regEmail} for the course enrollment.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1 text-[10px] shrink-0 font-bold"
                  >
                    <span>Test Chat</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {resendNotification && (
                <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>New verification code generated and sent to email!</span>
                </div>
              )}

              {verificationError && (
                <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 p-3 rounded">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{verificationError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between">
                  <span>Enter 6-Digit OTP Code *</span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-amber-400 hover:underline flex items-center gap-1 text-[10px] cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Resend Code
                  </button>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type="text"
                    required
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="w-full bg-slate-950 border border-slate-800 rounded pl-9 pr-4 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-amber-300 focus:outline-none focus:border-amber-400 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded cursor-pointer transition-colors"
                >
                  Back
                </button>
                
                <button 
                  type="submit"
                  disabled={loading || enteredOtp.length !== 6}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-black font-bold uppercase text-xs tracking-wider rounded transition-all cursor-pointer shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    'Verifying & Activating...'
                  ) : (
                    <>
                      Verify Email & Sign In <CheckCircle2 className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>
          </div>

        </div>
      </div>

    </div>
  );
}
