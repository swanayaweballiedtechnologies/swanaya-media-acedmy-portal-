import React, { useState, useEffect } from 'react';
import { BookOpen, X, ClipboardList, Send, AlertCircle } from 'lucide-react';
import { Student } from '../db/mockDb';
import { academyService } from '../services/academyService';
import VisualCaptcha from './VisualCaptcha';

interface CourseRegistrationPortalProps {
  studentUser: Student;
  onRefreshAllData: () => void;
}

export default function CourseRegistrationPortal({ studentUser, onRefreshAllData }: CourseRegistrationPortalProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedSubject] = useState<any | null>(null);
  const [questionnaire, setQuestionnaire] = useState({
    reason: '',
    priorExperience: '',
    careerGoals: '',
    preferredSchedule: 'WEEKDAY'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      const fetchedCourses = await academyService.getCourses();
      if (fetchedCourses && fetchedCourses.length > 0) {
        setCourses(fetchedCourses);
      } else {
        // Fallback or seed initial courses if needed
      }
      setLoading(false);
    };
    loadCourses();
  }, []);
  
  const handleOpenQuestionnaire = (course: any) => {
    setSelectedSubject(course);
    setSuccess(false);
    setSubmitError(null);
    setCaptchaToken(null);
    setCaptchaResetSignal((prev) => prev + 1);
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setSubmitError(null);

    if (!captchaToken) {
      setSubmitError('Please complete the human verification CAPTCHA before submitting.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await academyService.registerForCourse(
        {
          studentId: studentUser.id,
          studentName: studentUser.name,
          studentEmail: studentUser.email,
          courseId: selectedCourse.id,
          courseTitle: selectedCourse.title || selectedCourse.name,
          courseCategory: selectedCourse.category || 'Media Science',
          answers: questionnaire,
          timestamp: new Date().toISOString()
        },
        captchaToken
      );
      
      setIsSubmitting(false);
      setSuccess(true);
      setCaptchaToken(null);
      setCaptchaResetSignal((prev) => prev + 1);
      setTimeout(() => {
        setSelectedSubject(null);
        setQuestionnaire({
          reason: '',
          priorExperience: '',
          careerGoals: '',
          preferredSchedule: 'WEEKDAY'
        });
        onRefreshAllData();
      }, 2000);
    } catch (err: any) {
      setIsSubmitting(false);
      setCaptchaToken(null);
      setCaptchaResetSignal((prev) => prev + 1);
      setSubmitError(err?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-amber-500" />
          Course Registration
        </h2>
        <p className="text-sm text-slate-400 mt-2">Browse and register for new academy courses through our selective enrollment process.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
          FETCHING ACADEMIC CATALOG...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.filter(c => c.id !== studentUser.courseId).map(course => (
            <div key={course.id} className="p-4 bg-slate-900 border border-slate-800 rounded flex justify-between items-center group hover:border-amber-500/30 transition-colors">
              <div>
                <p className="font-bold text-white group-hover:text-amber-400 transition-colors">{course.title || course.name}</p>
                <p className="text-xs text-slate-400 font-mono">{course.duration} · {course.category || 'Professional'}</p>
              </div>
              <button
                onClick={() => handleOpenQuestionnaire(course)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold uppercase rounded cursor-pointer shadow-lg shadow-amber-500/10 transition-all active:scale-95"
              >
                Apply
              </button>
            </div>
          ))}
          {courses.length === 0 && (
            <div className="col-span-full p-8 text-center bg-slate-900/40 border border-slate-800 rounded text-slate-500 text-xs">
              No additional courses available for registration at this time.
            </div>
          )}
        </div>
      )}

      {/* Registration Questionnaire Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F17] border border-slate-800 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold font-serif text-white tracking-wide">
                  Enrollment Questionnaire
                </h3>
              </div>
              <button 
                onClick={() => setSelectedSubject(null)}
                className="p-1.5 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              {success ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <Send className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-serif text-white font-bold">Application Dispatched!</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    Your detailed questionnaire for <span className="text-amber-400 font-bold">{selectedCourse.name}</span> has been logged. Our admissions board will review your profile.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitRegistration} className="space-y-5">
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <p className="text-[11px] text-amber-300/80 leading-relaxed italic">
                      "Please provide detailed responses to help our Academic Board evaluate your candidacy for the {selectedCourse.name} program."
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Why do you want to join this program?</label>
                    <textarea 
                      required
                      value={questionnaire.reason}
                      onChange={(e) => setQuestionnaire({...questionnaire, reason: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[60px]"
                      placeholder="Describe your motivation and expectations..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Prior technical experience or background?</label>
                    <textarea 
                      required
                      value={questionnaire.priorExperience}
                      onChange={(e) => setQuestionnaire({...questionnaire, priorExperience: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[60px]"
                      placeholder="Mention any related projects, courses, or work experience..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">What are your immediate career objectives after completion?</label>
                    <textarea 
                      required
                      value={questionnaire.careerGoals}
                      onChange={(e) => setQuestionnaire({...questionnaire, careerGoals: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[60px]"
                      placeholder="e.g. Seeking placement as a UI/UX Designer in a tier-1 agency..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Preferred Batch Schedule</label>
                      <select 
                        value={questionnaire.preferredSchedule}
                        onChange={(e) => setQuestionnaire({...questionnaire, preferredSchedule: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="WEEKDAY">Weekday Intensive</option>
                        <option value="WEEKEND">Weekend Specialist</option>
                        <option value="EVENING">Evening Cohort</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-500 uppercase font-bold font-mono">Your Career Goal after this course?</label>
                      <input 
                        required
                        type="text"
                        value={questionnaire.careerGoals}
                        onChange={(e) => setQuestionnaire({...questionnaire, careerGoals: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                        placeholder="e.g. Senior Frontend Engineer"
                      />
                    </div>
                  </div>

                  <VisualCaptcha
                    purpose="course_registration"
                    compact
                    onTokenChange={(tok) => {
                      setCaptchaToken(tok);
                      if (tok) setSubmitError(null);
                    }}
                    resetSignal={captchaResetSignal}
                  />

                  {submitError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedSubject(null)}
                      className="px-5 py-2.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-400 font-bold uppercase hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold uppercase rounded cursor-pointer shadow-lg shadow-amber-500/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Submit Application
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
