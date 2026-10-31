import React, { useState, useEffect } from 'react';
import { SwanayaDatabase, ExamAnnouncement, User } from '../db/mockDb';
import { 
  AlertTriangle, Bell, FileText, Presentation, Video, 
  Send, X, CheckCircle2, ChevronRight, Mail, Sparkles, AlertCircle 
} from 'lucide-react';
import { googleSignIn, getAccessToken } from '../services/googleAuth';
import { sendGmailMessage } from '../services/gmailService';

interface ExaminationAnnouncementBarProps {
  currentUser: User | null;
  onOpenExamSession?: (sessionId?: string) => void;
  onRefresh?: () => void;
}

export default function ExaminationAnnouncementBar({ 
  currentUser, 
  onOpenExamSession,
  onRefresh 
}: ExaminationAnnouncementBarProps) {
  const [announcements, setAnnouncements] = useState<ExamAnnouncement[]>([]);
  const [activeAnn, setActiveAnn] = useState<ExamAnnouncement | null>(null);
  
  // Media Modal state
  const [activeMediaModal, setActiveMediaModal] = useState<'pdf' | 'slides' | 'youtube' | null>(null);

  // Gmail Broadcast Confirmation Modal state
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [needGoogleAuth, setNeedGoogleAuth] = useState(false);

  useEffect(() => {
    const list = SwanayaDatabase.get<ExamAnnouncement[]>("examAnnouncements");
    setAnnouncements(list);
    const active = list.find(a => a.active);
    if (active) {
      setActiveAnn(active);
    } else if (list.length > 0) {
      setActiveAnn(list[0]);
    }
  }, []);

  if (!activeAnn) return null;

  // Open Gmail modal with prefilled data
  const handleOpenGmailBroadcast = () => {
    setEmailRecipient('students@swanayamedia.com');
    setEmailSubject(`[EXAM ANNOUNCEMENT] ${activeAnn.title}`);
    setEmailBody(`Dear Student / Parent,\n\nPlease take note of the following examination announcement:\n\n${activeAnn.title}\n\n${activeAnn.message}\n\nDate: ${activeAnn.date}\n\nPlease log in to the Swanaya Media Academy Portal to view attached PDF question papers, slide deck guides, and live video instructions.\n\nRegards,\nSwanaya Media Academy Examination Board`);
    setEmailError(null);
    setEmailSuccess(false);
    setIsGmailModalOpen(true);
  };

  // Perform Gmail dispatch with user confirmation
  const handleConfirmSendGmail = async () => {
    setIsSendingEmail(true);
    setEmailError(null);

    let token = getAccessToken();

    if (!token) {
      try {
        const authRes = await googleSignIn();
        if (authRes) {
          token = authRes.accessToken;
        }
      } catch (err: any) {
        setIsSendingEmail(false);
        setEmailError('Google authentication failed: ' + (err.message || 'Access token denied'));
        return;
      }
    }

    if (!token) {
      setIsSendingEmail(false);
      setEmailError('Google OAuth token unavailable. Please sign in with Google to send Gmail.');
      return;
    }

    const res = await sendGmailMessage({
      to: emailRecipient,
      subject: emailSubject,
      body: emailBody,
      accessToken: token
    });

    setIsSendingEmail(false);

    if (res.success) {
      setEmailSuccess(true);
      SwanayaDatabase.log(
        currentUser?.email || 'admin@swanayamedia.com',
        currentUser?.name || 'Administrator',
        'GMAIL_EXAM_BROADCAST',
        `Dispatched exam notification email to ${emailRecipient}`
      );
      setTimeout(() => {
        setIsGmailModalOpen(false);
        setEmailSuccess(false);
      }, 2000);
    } else {
      setEmailError(res.error || 'Failed to dispatch email via Gmail API.');
    }
  };

  return (
    <>
      {/* Top Banner Ticker */}
      <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/30 text-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
        
        <div className="flex items-center gap-2.5 min-w-[280px]">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span className="bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/30 uppercase tracking-wider">
            {activeAnn.urgent ? 'URGENT EXAM ALERT' : 'EXAM ANNOUNCEMENT'}
          </span>
          <p className="font-semibold text-slate-100 truncate max-w-xl">
            {activeAnn.title}
          </p>
        </div>

        {/* Quick Action Media Embed Buttons */}
        <div className="flex items-center gap-2">
          {activeAnn.pdfUrl && (
            <button
              onClick={() => setActiveMediaModal('pdf')}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Question PDF</span>
            </button>
          )}

          {activeAnn.slidesUrl && (
            <button
              onClick={() => setActiveMediaModal('slides')}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Presentation className="w-3.5 h-3.5 text-amber-400" />
              <span>Slides Deck</span>
            </button>
          )}

          {activeAnn.youtubeUrl && (
            <button
              onClick={() => setActiveMediaModal('youtube')}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Video className="w-3.5 h-3.5 text-rose-400" />
              <span>Video Briefing</span>
            </button>
          )}

          {/* Conduct / Portal Access Button */}
          {onOpenExamSession && (
            <button
              onClick={() => onOpenExamSession(activeAnn.examId || 'session-101')}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] uppercase tracking-wider rounded flex items-center gap-1 transition-colors cursor-pointer shadow-md shadow-amber-500/10"
            >
              <span>Enter Exam Session</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Gmail Broadcast Button for Admins/Instructors */}
          {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'MD' || currentUser?.role === 'ADMIN' || currentUser?.role === 'INSTRUCTOR') && (
            <button
              onClick={handleOpenGmailBroadcast}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Broadcast announcement via Gmail API"
            >
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              <span>Gmail Alert</span>
            </button>
          )}
        </div>

      </div>

      {/* MULTIMEDIA VIEW MODAL OVERLAY */}
      {activeMediaModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-4xl w-full h-[80vh] flex flex-col relative shadow-2xl overflow-hidden">
            
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-amber-400 font-mono font-bold uppercase">
                {activeMediaModal === 'pdf' && <FileText className="w-4 h-4 text-amber-400" />}
                {activeMediaModal === 'slides' && <Presentation className="w-4 h-4 text-amber-400" />}
                {activeMediaModal === 'youtube' && <Video className="w-4 h-4 text-rose-400" />}
                <span>
                  {activeMediaModal === 'pdf' && 'Examination Question Paper PDF Viewer'}
                  {activeMediaModal === 'slides' && 'Google Slides Exam Revision Presentation'}
                  {activeMediaModal === 'youtube' && 'YouTube Proctoring Stream / Video Briefing'}
                </span>
              </div>
              <button 
                onClick={() => setActiveMediaModal(null)}
                className="p-1 bg-slate-800 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-grow bg-slate-900/50 p-2 relative flex items-center justify-center">
              {activeMediaModal === 'pdf' && (
                <iframe
                  src={activeAnn.pdfUrl}
                  className="w-full h-full rounded border border-slate-800 bg-white"
                  title="PDF Viewer"
                />
              )}

              {activeMediaModal === 'slides' && (
                <iframe
                  src={activeAnn.slidesUrl}
                  className="w-full h-full rounded border border-slate-800"
                  allowFullScreen
                  title="Google Slides Embed"
                />
              )}

              {activeMediaModal === 'youtube' && (
                <iframe
                  src={activeAnn.youtubeUrl}
                  className="w-full h-full rounded border border-slate-800"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube Video Stream"
                />
              )}
            </div>

          </div>
        </div>
      )}

      {/* GMAIL DISPATCH USER CONFIRMATION MODAL */}
      {isGmailModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setIsGmailModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2 text-sky-400 font-mono text-[10px] font-bold uppercase">
                <Mail className="w-4 h-4" />
                <span>Google Workspace Gmail Integration</span>
              </div>
              <h3 className="text-base font-serif font-bold text-white">
                Confirm Gmail Announcement Broadcast
              </h3>
              <p className="text-[11px] text-slate-400">
                You are about to dispatch an official email to scholars & guardians using your authenticated Google Workspace account.
              </p>
            </div>

            {emailSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg text-center space-y-2 animate-pulse">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold uppercase tracking-wider">Email Dispatched Successfully!</p>
                <p className="text-[11px] text-slate-400">Message sent via Gmail API endpoint `users/me/messages/send`.</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {emailError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{emailError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Recipient Email / Group</label>
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-400 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase font-bold text-slate-500">Message Content</label>
                  <textarea
                    rows={5}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-sky-400 text-xs font-mono"
                  />
                </div>

                {/* Explicit User Action Warning Box */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-300">
                  ⚠️ <strong>Explicit Confirmation Required:</strong> Clicking "Send Email via Gmail" will initiate a Google OAuth popup (if not already cached in memory) and permanently send this email to {emailRecipient}.
                </div>

                <div className="pt-2 border-t border-slate-850 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsGmailModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 font-bold uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSendingEmail}
                    onClick={handleConfirmSendGmail}
                    className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs font-mono uppercase rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-sky-500/10"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingEmail ? 'Sending via Gmail...' : 'Send Email via Gmail'}</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </>
  );
}
