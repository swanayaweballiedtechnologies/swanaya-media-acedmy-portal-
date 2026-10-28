/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles, RefreshCw, ChevronDown, Minimize2, Maximize2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface StudentAiAssistantProps {
  studentName?: string;
  courseName?: string;
}

export default function StudentAiAssistant({ studentName = 'Student', courseName }: StudentAiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `Hello ${studentName}! 👋 I am your **DeepSeek V4.1 Flash AI Learning Assistant** at Swanaya Media Academy.\n\nHow can I help you today with your **${courseName || 'media & tech studies'}**? Feel free to ask about syllabus topics, assignment ideas, exam prep, or career advice!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputMessage('');
    setLoading(true);

    try {
      // Prepare message context for server
      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: apiMessages,
          userRole: 'student',
          courseContext: courseName
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${response.status}`);
      }

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'I received your message! How else can I assist your learning journey today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ *Sorry, I encountered an issue connecting to the DeepSeek V4.1 Flash AI engine.* \n\n${err?.message || 'Please check your connection and try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Chat history cleared! How can I assist you with your studies at Swanaya Media Academy today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const suggestedPrompts = [
    '💡 Help me brainstorm assignment ideas',
    '📘 Summarize core concepts in my course',
    '📝 How can I improve my study schedule?',
    '🚀 Career guidance for media & tech graduates'
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 p-3.5 rounded-full shadow-xl shadow-amber-500/20 border border-amber-400/40 flex items-center gap-3 font-bold transition-all transform hover:scale-105 group cursor-pointer"
          title="Open DeepSeek V4.1 Flash Student AI Assistant"
        >
          <div className="relative w-8 h-8 rounded-full bg-slate-950/80 p-1 flex items-center justify-center shrink-0 border border-amber-400/30">
            <img 
              src="/assets/aistudio/icon_squared_371f6cba.svg" 
              alt="AI Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                // Fallback icon if image fails
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="text-left hidden sm:block pr-1">
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-950 font-extrabold leading-none">DeepSeek V4.1</p>
            <p className="text-xs font-bold text-slate-950 leading-tight">AI Student Assistant</p>
          </div>
          <Sparkles className="w-4 h-4 text-slate-950 animate-spin-slow shrink-0" />
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className={`fixed z-50 transition-all duration-300 ${
          isMinimized 
            ? 'bottom-6 right-6 w-80 h-14' 
            : 'bottom-6 right-6 w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh]'
        } bg-slate-950 border border-amber-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden`}>
          
          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-800 p-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 p-1 flex items-center justify-center shrink-0">
                <img 
                  src="/assets/aistudio/icon_squared_371f6cba.svg" 
                  alt="AI Avatar" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-slate-100 font-mono">DeepSeek V4.1 Flash</h3>
                  <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono px-1.5 py-0.2 rounded font-semibold">
                    AI TUTOR
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Swanaya Learning Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => clearChat()}
                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
                title="Reset Chat"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Body */}
              <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-slate-950/90 text-xs">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-amber-500 text-slate-950 font-bold text-xs'
                        : 'bg-slate-900 border border-amber-500/30 p-1'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="w-3.5 h-3.5" />
                      ) : (
                        <img 
                          src="/assets/aistudio/icon_squared_371f6cba.svg" 
                          alt="AI" 
                          className="w-full h-full object-contain" 
                        />
                      )}
                    </div>

                    <div className={`max-w-[80%] rounded-xl p-3 space-y-1 ${
                      msg.role === 'user'
                        ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none leading-relaxed'
                    }`}>
                      <div className="whitespace-pre-wrap font-sans text-xs">
                        {msg.content}
                      </div>
                      <span className={`text-[9px] font-mono block text-right ${
                        msg.role === 'user' ? 'text-slate-900/70' : 'text-slate-500'
                      }`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 max-w-fit">
                    <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0"></div>
                    <span>DeepSeek V4.1 Flash is thinking...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts Chips */}
              <div className="px-3 py-2 bg-slate-900/40 border-t border-slate-850 overflow-x-auto flex gap-1.5 scrollbar-none shrink-0">
                {suggestedPrompts.map((promptText, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(promptText)}
                    disabled={loading}
                    className="whitespace-nowrap text-[10px] bg-slate-900 hover:bg-slate-850 text-amber-400 border border-slate-800 px-2.5 py-1 rounded-full transition-all shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {promptText}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about syllabus, assignments, exams..."
                    disabled={loading}
                    className="flex-grow bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-sans"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || loading}
                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 p-2 rounded-lg font-bold transition-all cursor-pointer shrink-0"
                    title="Send Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 font-mono text-center mt-1">
                  Powered by Gemini 3.8 Flash · Swanaya AI System
                </p>
              </div>
            </>
          )}

        </div>
      )}
    </>
  );
}
