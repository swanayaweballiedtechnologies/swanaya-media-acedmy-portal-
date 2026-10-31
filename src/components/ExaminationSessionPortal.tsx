import React, { useState, useEffect } from 'react';
import { 
  SwanayaDatabase, ExamSession, ExamStudentSubmission, User, Student, Course, Batch, ExamAnnouncement 
} from '../db/mockDb';
import { 
  FileText, Presentation, Video, Clock, Award, CheckCircle2, 
  Send, AlertTriangle, Play, ExternalLink, UserCheck, Plus, RefreshCw, X, Mail, Sparkles 
} from 'lucide-react';
import { googleSignIn, getAccessToken } from '../services/googleAuth';
import { sendGmailMessage } from '../services/gmailService';

interface ExaminationSessionPortalProps {
  currentUser: User | null;
  onRefreshAllData?: () => void;
}

export default function ExaminationSessionPortal({ 
  currentUser, 
  onRefreshAllData 
}: ExaminationSessionPortalProps) {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  
  // Student answer state
  const [studentAnswerText, setStudentAnswerText] = useState('');
  const [studentFileUrl, setStudentFileUrl] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Active multimedia tab in session conduct view: 'pdf' | 'slides' | 'youtube' | 'instructions'
  const [mediaTab, setMediaTab] = useState<'pdf' | 'slides' | 'youtube' | 'instructions'>('pdf');

  // Instructor/Admin Create New Exam Session Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('WD-101');
  const [newSubjectName, setNewSubjectName] = useState('Advanced Web Architecture');
  const [newCourseId, setNewCourseId] = useState('c-1');
  const [newBatchId, setNewBatchId] = useState('b-1');
  const [newScheduledDate, setNewScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStartTime, setNewStartTime] = useState('10:00 AM');
  const [newEndTime, setNewEndTime] = useState('01:00 PM');
  const [newDuration, setNewDuration] = useState(180);
  const [newTotalMarks, setNewTotalMarks] = useState(100);
  const [newPassMarks, setNewPassMarks] = useState(50);
  const [newPdfUrl, setNewPdfUrl] = useState('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
  const [newSlidesUrl, setNewSlidesUrl] = useState('https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/embed?start=false&loop=false&delayms=3000');
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('https://www.youtube.com/embed/gB1F9G0J48A');
  const [newInstructions, setNewInstructions] = useState('1. Read the attached PDF paper.\n2. Complete the answer text or paste repo link.\n3. Submit before deadline.');

  // Grading Modal for Instructors
  const [gradingSubmission, setGradingSubmission] = useState<{
    sessionId: string;
    sub: ExamStudentSubmission;
  } | null>(null);
  const [givenMarks, setGivenMarks] = useState<number>(0);
  const [givenFeedback, setGivenFeedback] = useState<string>('');
  const [sendResultViaGmail, setSendResultViaGmail] = useState<boolean>(true);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradeSuccess, setGradeSuccess] = useState<boolean>(false);

  // Load sessions from DB
  const loadSessions = () => {
    const list = SwanayaDatabase.get<ExamSession[]>("examSessions");
    setSessions(list);
    if (!selectedSession && list.length > 0) {
      setSelectedSession(list[0]);
    } else if (selectedSession) {
      const updated = list.find(s => s.id === selectedSession.id);
      if (updated) setSelectedSession(updated);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const activeStudentProfile = currentUser?.role === 'STUDENT'
    ? SwanayaDatabase.get<Student[]>("students").find(s => s.userId === currentUser.id)
    : null;

  // Handle student submitting answers
  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !currentUser) return;

    const newSub: ExamStudentSubmission = {
      studentId: activeStudentProfile?.id || currentUser.id,
      studentName: currentUser.name,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      answerText: studentAnswerText,
      answerFileUrl: studentFileUrl || undefined,
      graded: false
    };

    const updatedSessions = sessions.map(s => {
      if (s.id === selectedSession.id) {
        const existingSubs = s.studentSubmissions || [];
        // replace or add
        const filtered = existingSubs.filter(sub => sub.studentId !== newSub.studentId);
        return {
          ...s,
          studentSubmissions: [...filtered, newSub]
        };
      }
      return s;
    });

    SwanayaDatabase.set("examSessions", updatedSessions);
    SwanayaDatabase.log(currentUser.email, currentUser.name, "SUBMIT_EXAM_ANSWER", `Submitted answer for Exam Session ${selectedSession.title}`);
    
    setSubmissionSuccess(true);
    setTimeout(() => {
      setSubmissionSuccess(false);
      loadSessions();
      if (onRefreshAllData) onRefreshAllData();
    }, 1500);
  };

  // Handle creating new exam session
  const handleCreateExamSession = (e: React.FormEvent) => {
    e.preventDefault();
    const newSession: ExamSession = {
      id: `session-${Date.now()}`,
      title: newExamTitle || 'New Technical Exam Session',
      subjectCode: newSubjectCode,
      subjectName: newSubjectName,
      courseId: newCourseId,
      batchId: newBatchId,
      scheduledDate: newScheduledDate,
      startTime: newStartTime,
      endTime: newEndTime,
      durationMinutes: newDuration,
      totalMarks: newTotalMarks,
      passMarks: newPassMarks,
      status: 'LIVE',
      pdfQuestionPaperUrl: newPdfUrl || undefined,
      pdfQuestionPaperName: `${newSubjectCode}_Question_Paper.pdf`,
      slidesEmbedUrl: newSlidesUrl || undefined,
      youtubeVideoUrl: newYoutubeUrl || undefined,
      instructions: newInstructions.split('\n').filter(Boolean),
      studentSubmissions: []
    };

    const updated = [newSession, ...sessions];
    SwanayaDatabase.set("examSessions", updated);

    // Also push a live Exam Announcement
    const announcements = SwanayaDatabase.get<ExamAnnouncement[]>("examAnnouncements");
    const newAnn: ExamAnnouncement = {
      id: `ann-${Date.now()}`,
      title: `🚨 Live Exam: ${newSession.title}`,
      message: `The official examination for ${newSession.subjectName} (${newSession.subjectCode}) is now active. Log in to complete questions.`,
      urgent: true,
      date: newSession.scheduledDate,
      examId: newSession.id,
      pdfUrl: newSession.pdfQuestionPaperUrl,
      slidesUrl: newSession.slidesEmbedUrl,
      youtubeUrl: newSession.youtubeVideoUrl,
      active: true
    };
    SwanayaDatabase.set("examAnnouncements", [newAnn, ...announcements]);

    SwanayaDatabase.log(currentUser?.email || 'admin@swanayamedia.com', currentUser?.name || 'Administrator', "CREATE_EXAM_SESSION", `Created Exam Session: ${newSession.title}`);

    setIsCreateModalOpen(false);
    loadSessions();
    setSelectedSession(newSession);
    if (onRefreshAllData) onRefreshAllData();
  };

  // Handle Instructor grading submission
  const handleSaveGrading = async () => {
    if (!gradingSubmission) return;
    setIsGrading(true);

    const { sessionId, sub } = gradingSubmission;
    const updatedSessions = sessions.map(s => {
      if (s.id === sessionId) {
        const subs = (s.studentSubmissions || []).map(existing => {
          if (existing.studentId === sub.studentId) {
            return {
              ...existing,
              marksObtained: givenMarks,
              graded: true,
              feedback: givenFeedback
            };
          }
          return existing;
        });
        return { ...s, studentSubmissions: subs };
      }
      return s;
    });

    SwanayaDatabase.set("examSessions", updatedSessions);

    // Send Gmail alert if enabled
    if (sendResultViaGmail) {
      try {
        let token = getAccessToken();
        if (!token) {
          const res = await googleSignIn();
          if (res) token = res.accessToken;
        }
        if (token) {
          await sendGmailMessage({
            to: sub.studentName ? `${sub.studentName.toLowerCase().replace(/\s+/g, '.')}@gmail.com` : 'student@swanayamedia.com',
            subject: `[EXAM GRADE RELEASED] ${selectedSession?.title}`,
            body: `Dear ${sub.studentName},\n\nYour evaluation results for "${selectedSession?.title}" have been officially published.\n\nScore: ${givenMarks} / ${selectedSession?.totalMarks}\nFeedback: ${givenFeedback || 'Satisfactory performance.'}\n\nLog in to the portal to review your scorecard.\n\nSwanaya Media Academy Examination Board`,
            accessToken: token
          });
        }
      } catch (err) {
        console.warn('Gmail result dispatch skipped or failed:', err);
      }
    }

    SwanayaDatabase.log(currentUser?.email || 'admin@swanayamedia.com', currentUser?.name || 'Administrator', "GRADE_EXAM_SUBMISSION", `Graded student ${sub.studentName} with ${givenMarks} marks`);

    setIsGrading(false);
    setGradeSuccess(true);
    setTimeout(() => {
      setGradeSuccess(false);
      setGradingSubmission(null);
      loadSessions();
      if (onRefreshAllData) onRefreshAllData();
    }, 1500);
  };

  const isStudent = currentUser?.role === 'STUDENT' || currentUser?.role === 'ALUMNI';
  const isManagement = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'MD' || currentUser?.role === 'ADMIN' || currentUser?.role === 'INSTRUCTOR' || currentUser?.role === 'REVIEWER';

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Academic Examination & Evaluation Hub</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-white">
            Examination Sessions & Multimedia Portal
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Conduct proctored exams, view PDF question papers, analyze Google Slides presentations, stream YouTube briefing lectures, and submit evaluations.
          </p>
        </div>

        {isManagement && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Create Exam Session</span>
          </button>
        )}
      </div>

      {/* Main Grid: Left Sessions List, Right Session Conduct Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left List of Sessions (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
              Active Exam Timetable
            </span>
            <button 
              onClick={loadSessions} 
              className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 font-mono"
            >
              <RefreshCw className="w-3 h-3" />
              Sync
            </button>
          </div>

          <div className="space-y-2.5">
            {sessions.map((sess) => {
              const isSelected = selectedSession?.id === sess.id;
              const hasSubmitted = sess.studentSubmissions?.some(sub => sub.studentId === (activeStudentProfile?.id || currentUser?.id));

              return (
                <div
                  key={sess.id}
                  onClick={() => setSelectedSession(sess)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/5' 
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {sess.subjectCode}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      sess.status === 'LIVE' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {sess.status}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-100 line-clamp-1 mb-1">
                    {sess.title}
                  </h4>
                  
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span>{sess.scheduledDate}</span>
                    </div>
                    <span>{sess.startTime}</span>
                  </div>

                  {isStudent && hasSubmitted && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Answer Submitted</span>
                    </div>
                  )}

                  {isManagement && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex justify-between items-center text-[11px] text-slate-400 font-mono">
                      <span>Submissions:</span>
                      <strong className="text-amber-400 font-bold">{sess.studentSubmissions?.length || 0} scholars</strong>
                    </div>
                  )}
                </div>
              );
            })}

            {sessions.length === 0 && (
              <div className="p-8 text-center bg-slate-900/30 border border-slate-850 rounded-xl text-slate-500 text-xs">
                No active examination sessions scheduled.
              </div>
            )}
          </div>
        </div>

        {/* Right Session Conduct Detail Panel (8 cols) */}
        {selectedSession ? (
          <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-6">
            
            {/* Session Title Header */}
            <div className="border-b border-slate-850 pb-4 flex flex-wrap justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    {selectedSession.subjectCode} • {selectedSession.subjectName}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Max Marks: <strong className="text-slate-200">{selectedSession.totalMarks}</strong> | Pass: <strong className="text-slate-200">{selectedSession.passMarks}</strong>
                  </span>
                </div>
                <h3 className="text-lg font-serif font-bold text-white">
                  {selectedSession.title}
                </h3>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-right font-mono text-xs">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Window Schedule</div>
                <div className="text-slate-200 font-bold">{selectedSession.scheduledDate}</div>
                <div className="text-amber-400">{selectedSession.startTime} - {selectedSession.endTime}</div>
              </div>
            </div>

            {/* Multimedia View Tabs: PDF Question Paper | Google Slides | YouTube Proctoring | Instructions */}
            <div className="space-y-3">
              <div className="flex border-b border-slate-800 gap-1 font-mono text-xs overflow-x-auto pb-1">
                <button
                  onClick={() => setMediaTab('pdf')}
                  className={`px-3 py-2 rounded-t-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    mediaTab === 'pdf' ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>PDF Paper</span>
                </button>

                <button
                  onClick={() => setMediaTab('slides')}
                  className={`px-3 py-2 rounded-t-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    mediaTab === 'slides' ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Presentation className="w-3.5 h-3.5 text-amber-400" />
                  <span>Google Slides</span>
                </button>

                <button
                  onClick={() => setMediaTab('youtube')}
                  className={`px-3 py-2 rounded-t-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    mediaTab === 'youtube' ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  <span>YouTube Stream</span>
                </button>

                <button
                  onClick={() => setMediaTab('instructions')}
                  className={`px-3 py-2 rounded-t-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    mediaTab === 'instructions' ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-500' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exam Guidelines</span>
                </button>
              </div>

              {/* Media Container Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl h-[420px] overflow-hidden relative">
                
                {mediaTab === 'pdf' && (
                  selectedSession.pdfQuestionPaperUrl ? (
                    <iframe
                      src={selectedSession.pdfQuestionPaperUrl}
                      className="w-full h-full bg-white"
                      title="Question Paper PDF"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                      No PDF question paper attached to this session.
                    </div>
                  )
                )}

                {mediaTab === 'slides' && (
                  selectedSession.slidesEmbedUrl ? (
                    <iframe
                      src={selectedSession.slidesEmbedUrl}
                      className="w-full h-full"
                      allowFullScreen
                      title="Google Slides Presentation"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                      No Google Slides deck linked to this session.
                    </div>
                  )
                )}

                {mediaTab === 'youtube' && (
                  selectedSession.youtubeVideoUrl ? (
                    <iframe
                      src={selectedSession.youtubeVideoUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="YouTube Proctoring Stream"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                      No YouTube video stream configured for this session.
                    </div>
                  )
                )}

                {mediaTab === 'instructions' && (
                  <div className="p-6 space-y-4 overflow-y-auto h-full text-slate-300 text-xs">
                    <h4 className="font-bold text-amber-400 uppercase font-mono tracking-wider">
                      Official Conduct Instructions & Rules
                    </h4>
                    <ul className="space-y-2 font-mono">
                      {selectedSession.instructions?.map((inst, idx) => (
                        <li key={idx} className="p-3 bg-slate-950/60 border border-slate-800 rounded">
                          {inst}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            </div>

            {/* Student Submission Form Section */}
            {isStudent && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    <span>Answer Submission Desk</span>
                  </h4>
                  {selectedSession.studentSubmissions?.some(s => s.studentId === (activeStudentProfile?.id || currentUser.id)) && (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      ✓ Submitted
                    </span>
                  )}
                </div>

                <form onSubmit={handleSubmitAnswer} className="space-y-3">
                  {submissionSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded text-xs text-center font-mono font-bold animate-pulse">
                      ✓ Exam Answer Submitted Successfully to Academy Board!
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-slate-500">
                      Written Answer / Explanation
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Write your comprehensive exam answers, pseudocode, code logic, or detailed explanations..."
                      value={studentAnswerText}
                      onChange={(e) => setStudentAnswerText(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase font-bold text-slate-500">
                      Project Repo / Answer Document File URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://github.com/... or https://drive.google.com/..."
                      value={studentFileUrl}
                      onChange={(e) => setStudentFileUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs uppercase rounded cursor-pointer transition-colors shadow-md shadow-amber-500/10 flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Examination Script</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Instructor / Admin Review Submissions & Grading Ledger */}
            {isManagement && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Submitted Answers & Evaluation Ledger</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Total: <strong className="text-amber-400">{selectedSession.studentSubmissions?.length || 0}</strong>
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {selectedSession.studentSubmissions?.map((sub, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-slate-950 border border-slate-850 rounded-lg flex flex-wrap justify-between items-center gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-200">{sub.studentName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Submitted: {sub.submittedAt}</div>
                        <p className="text-[11px] text-slate-300 line-clamp-1 italic mt-1 font-mono">
                          "{sub.answerText}"
                        </p>
                      </div>

                      <div className="flex items-center gap-3 font-mono">
                        {sub.graded ? (
                          <div className="text-right">
                            <span className="text-xs font-bold text-amber-400">{sub.marksObtained} / {selectedSession.totalMarks} Marks</span>
                            <div className="text-[9px] text-emerald-400 font-bold uppercase">Graded</div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 uppercase font-bold">
                            Ungraded
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setGradingSubmission({ sessionId: selectedSession.id, sub });
                            setGivenMarks(sub.marksObtained || 0);
                            setGivenFeedback(sub.feedback || '');
                          }}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 text-[11px] font-bold uppercase transition-colors"
                        >
                          {sub.graded ? 'Edit Grade' : 'Grade Answer'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {(!selectedSession.studentSubmissions || selectedSession.studentSubmissions.length === 0) && (
                    <p className="text-xs text-slate-500 italic text-center py-4">
                      No student submissions received for this examination session yet.
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
            Select an examination session from the timetable list to begin.
          </div>
        )}

      </div>

      {/* CREATE EXAM SESSION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-xl w-full p-6 space-y-4 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-slate-850 pb-3">
              <span className="text-[10px] font-mono text-amber-500 uppercase font-bold">ACADEMIC BOARD</span>
              <h3 className="text-base font-serif font-bold text-white">Create New Examination Session</h3>
              <p className="text-[11px] text-slate-400">Configure multimedia question papers, slide deck guidelines, and YouTube proctoring feeds.</p>
            </div>

            <form onSubmit={handleCreateExamSession} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Examination Title</label>
                <input
                  type="text"
                  required
                  value={newExamTitle}
                  onChange={(e) => setNewExamTitle(e.target.value)}
                  placeholder="e.g. End-Semester Full-Stack Technical Exam"
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Subject Code</label>
                  <input
                    type="text"
                    required
                    value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Date</label>
                  <input
                    type="date"
                    required
                    value={newScheduledDate}
                    onChange={(e) => setNewScheduledDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Start Time</label>
                  <input
                    type="text"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">End Time</label>
                  <input
                    type="text"
                    required
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-500">PDF Question Paper URL</label>
                <input
                  type="url"
                  value={newPdfUrl}
                  onChange={(e) => setNewPdfUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Google Slides Embed URL</label>
                <input
                  type="url"
                  value={newSlidesUrl}
                  onChange={(e) => setNewSlidesUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-500">YouTube Stream Video Embed URL</label>
                <input
                  type="url"
                  value={newYoutubeUrl}
                  onChange={(e) => setNewYoutubeUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Exam Rules & Guidelines</label>
                <textarea
                  rows={3}
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 font-mono text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-850 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono uppercase rounded cursor-pointer transition-colors"
                >
                  Publish Exam Session & Alert
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* INSTRUCTOR EVALUATION & GRADING MODAL */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 relative shadow-2xl">
            <button 
              onClick={() => setGradingSubmission(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-slate-850 pb-3">
              <span className="text-[10px] font-mono text-amber-500 uppercase font-bold">EXAM EVALUATOR</span>
              <h3 className="text-base font-serif font-bold text-white">
                Grade Scholar Submission
              </h3>
              <p className="text-[11px] text-slate-400">
                Evaluating answer for <strong>{gradingSubmission.sub.studentName}</strong>
              </p>
            </div>

            {gradeSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-center space-y-2 animate-pulse">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold uppercase tracking-wider">Grade Recorded & Dispatched!</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-900 border border-slate-850 rounded font-mono space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Student Answer Script:</div>
                  <p className="text-slate-200">{gradingSubmission.sub.answerText}</p>
                  {gradingSubmission.sub.answerFileUrl && (
                    <a 
                      href={gradingSubmission.sub.answerFileUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-amber-400 hover:underline text-[11px] flex items-center gap-1 pt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Project File / Repository Link
                    </a>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Marks Awarded</label>
                  <input
                    type="number"
                    min={0}
                    max={selectedSession?.totalMarks || 100}
                    value={givenMarks}
                    onChange={(e) => setGivenMarks(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Evaluator Feedback</label>
                  <textarea
                    rows={3}
                    value={givenFeedback}
                    onChange={(e) => setGivenFeedback(e.target.value)}
                    placeholder="Provide constructive feedback on technical accuracy, structure, and execution..."
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    id="sendGmailCheck"
                    checked={sendResultViaGmail}
                    onChange={(e) => setSendResultViaGmail(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-500 cursor-pointer rounded"
                  />
                  <label htmlFor="sendGmailCheck" className="cursor-pointer">
                    Send scorecard notification via Gmail API
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-850 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGradingSubmission(null)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 font-bold uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isGrading}
                    onClick={handleSaveGrading}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono uppercase rounded cursor-pointer transition-colors"
                  >
                    {isGrading ? 'Saving Grade...' : 'Confirm Grade & Save'}
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
