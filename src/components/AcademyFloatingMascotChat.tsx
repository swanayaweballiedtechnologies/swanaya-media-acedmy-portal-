/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Send,
  RefreshCw,
  ChevronDown,
  KeyRound,
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  User as UserIcon,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { academyService } from '../services/academyService';
import womanMascotImg from '../assets/images/academy_woman_mascot_1795322272911.jpg';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AcademyFloatingMascotChatProps {
  mode: 'landing' | 'login' | 'portal' | 'course-selection' | 'portfolio';
  userName?: string;
  userEmail?: string;
  userRole?: string;
  courseContext?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  recoveryTrigger?: { nonce: number; email?: string } | null;
  onRedirectToPasswordReset?: (email?: string) => void;
}

function generateSampleVerificationCode(): string {
  const bytes = new Uint32Array(1);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
    return `SMA-${String((bytes[0] % 900000) + 100000)}`;
  }
  return `SMA-${Math.floor(100000 + Math.random() * 900000)}`;
}

export default function AcademyFloatingMascotChat({
  mode,
  userName,
  userEmail,
  userRole,
  courseContext,
  externalOpen,
  onExternalOpenChange,
  recoveryTrigger,
  onRedirectToPasswordReset,
}: AcademyFloatingMascotChatProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;

  const setOpenState = (next: boolean) => {
    setInternalOpen(next);
    onExternalOpenChange?.(next);
  };

  const [isMinimized, setIsMinimized] = useState(false);
  const [showCallout, setShowCallout] = useState(true);
  const [mascotImgFailed, setMascotImgFailed] = useState(false);

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Interactive Password Recovery flow inside the chatbot
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(userEmail || '');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const buildWelcomeMessage = (): ChatMessage => ({
    id: 'welcome-mascot',
    role: 'assistant',
    content:
      mode === 'login'
        ? `Hello! I'm Maya, your Swanaya Academy Guide.\n\nNeed help signing in with your username, requesting a sample verification code, or resetting a forgotten password? Ask me here anytime.`
        : mode === 'portal'
        ? `Welcome back${userName ? `, ${userName}` : ''}! I'm Maya, your Swanaya Academy Guide.\n\nI can help with your courses, study tips, verification status, or instant password recovery.`
        : `Hello! I'm Maya, your Swanaya Media Academy Advisor.\n\nAsk me about our diploma programmes, admissions, verification links, or portal access.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage()]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userEmail && !recoveryEmail) {
      setRecoveryEmail(userEmail);
    }
  }, [userEmail]);

  useEffect(() => {
    if (!recoveryTrigger) return;
    setOpenState(true);
    setIsMinimized(false);
    setIsRecoveryOpen(true);
    setRecoveryResult(null);
    if (recoveryTrigger.email) {
      setRecoveryEmail(recoveryTrigger.email);
    }
    const targetHint = recoveryTrigger.email ? ` for **${recoveryTrigger.email}**` : '';
    setMessages((prev) => [
      ...prev,
      {
        id: `recovery-prompt-${recoveryTrigger.nonce}`,
        role: 'assistant',
        content: `I've opened **Account Password Recovery**${targetHint}. Enter or confirm your registered email below to send an official password reset link using our authentication service, or jump straight to the Reset Password page.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [recoveryTrigger?.nonce]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isRecoveryOpen, recoveryResult]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || loading) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: nowTime,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!customPrompt) setInputMessage('');

    const lower = textToSend.toLowerCase();
    if (lower.includes('forgot') || lower.includes('reset password') || lower.includes('recover')) {
      setIsRecoveryOpen(true);
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
          userRole: userRole || (mode === 'login' ? 'Sign-In Visitor' : 'Student'),
          courseContext: courseContext || `Swanaya Media Academy (${mode})`,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Service unavailable (${response.status})`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content:
            data.reply ||
            'How else can I assist with your Swanaya Media Academy account or coursework?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `I couldn't reach the AI assistant right now (${err?.message || 'connection error'}). You can still use the **Reset Password** recovery panel below directly.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerVerificationCode = () => {
    const code = generateSampleVerificationCode();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: `user-code-${Date.now()}`,
        role: 'user',
        content: 'Generate a unique sample verification code',
        timestamp: nowTime,
      },
      {
        id: `ai-code-${Date.now() + 1}`,
        role: 'assistant',
        content: `Here is your unique sample verification reference:\n\n**Code:** \`${code}\`\n\nFor live account activation or password resets, official single-use verification links are emailed securely to your registered academy address.`,
        timestamp: nowTime,
      },
    ]);
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setRecoveryResult({
        type: 'error',
        text: 'Please enter a valid registered email address.',
      });
      return;
    }

    setRecoveryLoading(true);
    setRecoveryResult(null);
    try {
      const res = await academyService.requestPasswordReset(cleanEmail);
      await sendPasswordResetEmail(auth, cleanEmail).catch(() => {});
      const successText =
        res?.message ||
        `Password reset instructions have been sent to ${cleanEmail} via Swanaya Auth & Firebase.`;
      setRecoveryResult({ type: 'success', text: successText });
      setMessages((prev) => [
        ...prev,
        {
          id: `rec-ok-${Date.now()}`,
          role: 'assistant',
          content: `Password reset initiated for **${cleanEmail}**. Check your inbox for the single-use recovery link.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setRecoveryResult({
        type: 'error',
        text: err?.message || 'Unable to process password recovery request right now.',
      });
    } finally {
      setRecoveryLoading(false);
    }
  };

  const renderMascotPortrait = (sizeClass: string) =>
    !mascotImgFailed ? (
      <img
        src={womanMascotImg}
        alt="Maya — Swanaya Media Academy Advisor Mascot"
        referrerPolicy="no-referrer"
        onError={() => setMascotImgFailed(true)}
        className={`${sizeClass} object-cover object-top`}
      />
    ) : (
      <div
        className={`${sizeClass} bg-gradient-to-br from-[var(--sma-primary)] to-[var(--sma-secondary)] flex items-center justify-center text-white font-bold text-xs`}
        aria-label="Maya Mascot"
      >
        MY
      </div>
    );

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[70] flex flex-col items-end gap-2.5 pointer-events-none">
      {/* Floating Launcher Row: optional horizontal login callout + Woman Mascot Button */}
      {!isOpen && (
        <div className="flex items-end justify-end gap-2.5">
          {showCallout && mode === 'login' && (
            <div className="pointer-events-auto hidden md:flex items-center gap-2.5 max-w-[260px] bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] rounded-xl px-3.5 py-2.5 shadow-lg text-left">
              <div className="space-y-0.5 flex-1">
                <p className="text-[11px] font-bold text-[var(--sma-active-text)]">
                  Hi, I&apos;m Maya
                </p>
                <p className="text-[11px] text-[var(--sma-active-text-muted)] leading-snug">
                  Need login help, a sample code, or password recovery?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCallout(false)}
                aria-label="Dismiss greeting"
                className="p-1 rounded-md text-[var(--sma-active-text-muted)] hover:bg-[var(--sma-active-bg)] cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpenState(true);
              setIsMinimized(false);
            }}
            aria-label="Open Swanaya Academy Advisor Chatbot"
            className="pointer-events-auto group flex items-center gap-3 bg-[var(--sma-active-surface)] hover:opacity-95 border border-[var(--sma-active-border)] rounded-2xl p-1.5 sm:pr-4 shadow-xl transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-[var(--sma-primary)]/40 shrink-0 bg-[var(--sma-active-bg)]">
              {renderMascotPortrait('w-full h-full')}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-[var(--sma-active-text)] whitespace-nowrap leading-tight">
                Ask Maya
              </p>
              <p className="text-[11px] text-[var(--sma-active-text-muted)] whitespace-nowrap leading-tight mt-0.5">
                {mode === 'login' ? 'Sign-In & Recovery Help' : 'Academy Guide'}
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Floating Expanded Chat & Recovery Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Swanaya Academy Floating Assistant"
          className={`pointer-events-auto transition-all duration-200 bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
            isMinimized
              ? 'w-72 sm:w-80 h-[62px]'
              : 'w-[calc(100vw-2rem)] sm:w-[400px] h-[540px] max-h-[82vh]'
          }`}
        >
          {/* Header featuring Woman Mascot */}
          <div className="bg-[var(--sma-active-bg)] border-b border-[var(--sma-active-border)] px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--sma-primary)]/40 shrink-0">
                {renderMascotPortrait('w-full h-full')}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[var(--sma-active-text)] truncate">
                  Maya · Swanaya Guide
                </h3>
                <p className="text-[11px] text-[var(--sma-active-text-muted)] truncate">
                  Verification · Recovery · Academy Help
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMessages([buildWelcomeMessage()]);
                  setIsRecoveryOpen(false);
                  setRecoveryResult(null);
                }}
                title="Reset Conversation"
                aria-label="Reset Conversation"
                className="p-2 text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)] hover:bg-[var(--sma-active-surface)] rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                aria-label={isMinimized ? 'Expand assistant' : 'Minimize assistant'}
                className="p-2 text-[var(--sma-active-text-muted)] hover:text-[var(--sma-active-text)] hover:bg-[var(--sma-active-surface)] rounded-lg transition-colors cursor-pointer"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={() => setOpenState(false)}
                title="Close Assistant"
                aria-label="Close assistant"
                className="p-2 text-[var(--sma-active-text-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[var(--sma-active-surface)] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Transcript Area */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[var(--sma-active-bg)]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg overflow-hidden shrink-0 flex items-center justify-center ${
                        msg.role === 'user'
                          ? 'bg-[var(--sma-primary)] text-white'
                          : 'border border-[var(--sma-active-border)]'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <UserIcon className="w-3.5 h-3.5" />
                      ) : (
                        renderMascotPortrait('w-full h-full')
                      )}
                    </div>

                    <div
                      className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[var(--sma-primary)] text-white rounded-tr-none'
                          : 'bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] text-[var(--sma-active-text)] rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <span
                        className={`block text-[10px] font-mono tabular-nums text-right mt-1 ${
                          msg.role === 'user'
                            ? 'text-white/80'
                            : 'text-[var(--sma-active-text-muted)]'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Interactive In-Chat Password Recovery Panel */}
                {isRecoveryOpen && (
                  <div className="bg-[var(--sma-active-surface)] border border-[var(--sma-primary)]/40 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--sma-primary)] flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Password Recovery Service</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsRecoveryOpen(false)}
                        className="text-[11px] text-[var(--sma-active-text-muted)] hover:underline cursor-pointer"
                      >
                        Hide
                      </button>
                    </div>

                    <form onSubmit={handleRecoverySubmit} className="space-y-2">
                      <label className="block text-[11px] font-medium text-[var(--sma-active-text-muted)]">
                        Registered Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-[var(--sma-active-text-muted)] absolute left-3 top-2.5" />
                        <input
                          type="email"
                          required
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          placeholder="name@swanayamedia.com"
                          className="w-full bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] focus:border-[var(--sma-primary)] rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--sma-active-text)] focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={recoveryLoading}
                          className="flex-1 py-2 px-3 bg-[var(--sma-primary)] hover:bg-[var(--sma-primary-hover)] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                        >
                          {recoveryLoading ? 'Sending Reset Link...' : 'Send Reset Link'}
                        </button>

                        {onRedirectToPasswordReset && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenState(false);
                              onRedirectToPasswordReset(recoveryEmail.trim() || undefined);
                            }}
                            className="py-2 px-3 bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] text-[var(--sma-active-text)] text-xs font-semibold rounded-lg hover:border-[var(--sma-primary)] transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>Reset Page</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </form>

                    {recoveryResult && (
                      <div
                        className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                          recoveryResult.type === 'success'
                            ? 'bg-[#529B78]/12 border-[#529B78]/35 text-[#2E7051] dark:text-[#76BD99]'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {recoveryResult.type === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        )}
                        <span>{recoveryResult.text}</span>
                      </div>
                    )}
                  </div>
                )}

                {loading && (
                  <div className="inline-flex items-center gap-2 text-[var(--sma-active-text-muted)] text-xs bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] px-3 py-2 rounded-xl">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--sma-primary)]" />
                    <span>Maya is typing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions Bar */}
              <div className="px-3 py-2 bg-[var(--sma-active-bg)] border-t border-[var(--sma-active-border)] flex items-center gap-1.5 overflow-x-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(true)}
                  className="px-2.5 py-1.5 bg-[var(--sma-primary)]/12 hover:bg-[var(--sma-primary)]/20 text-[var(--sma-primary)] rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  Reset Password
                </button>
                <button
                  type="button"
                  onClick={handleTriggerVerificationCode}
                  className="px-2.5 py-1.5 bg-[var(--sma-accent)]/12 hover:bg-[var(--sma-accent)]/20 text-[var(--sma-accent)] rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  Sample Code
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendMessage('How do I verify my email and sign in with my username?')}
                  disabled={loading}
                  className="px-2.5 py-1.5 bg-[var(--sma-secondary)]/12 hover:bg-[var(--sma-secondary)]/20 text-[var(--sma-secondary)] dark:text-[#75A7E0] rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors disabled:opacity-50"
                >
                  Sign-In Help
                </button>
              </div>

              {/* Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendMessage();
                }}
                className="p-3 bg-[var(--sma-active-surface)] border-t border-[var(--sma-active-border)] flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask Maya about login, recovery, or courses..."
                  disabled={loading}
                  className="flex-1 bg-[var(--sma-active-bg)] border border-[var(--sma-active-border)] focus:border-[var(--sma-primary)] rounded-xl px-3 py-2 text-xs text-[var(--sma-active-text)] placeholder-[var(--sma-active-text-muted)]/70 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || loading}
                  aria-label="Send message"
                  className="px-3 py-2 bg-[var(--sma-primary)] hover:bg-[var(--sma-primary-hover)] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-45 shrink-0 flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
