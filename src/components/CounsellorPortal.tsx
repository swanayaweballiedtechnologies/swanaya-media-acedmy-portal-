/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KanbanSquare, ArrowRight, X, PhoneCall, Mail, MessageSquare, Plus, PlusCircle, Sparkles, UserPlus } from 'lucide-react';
import { SwanayaDatabase, Lead, Course } from '../db/mockDb';
import InstructorAllocation from './InstructorAllocation';

interface CounsellorPortalProps {
  currentUser: any;
  onRefreshAllData: () => void;
}

export default function CounsellorPortal({ currentUser, onRefreshAllData }: CounsellorPortalProps) {
  const [leads, setLeads] = useState<Lead[]>(() => SwanayaDatabase.get<Lead[]>("leads"));
  const [courses] = useState<Course[]>(() => SwanayaDatabase.get<Course[]>("courses"));
  const [activeTab, setActiveTab] = useState<'leads' | 'instructors'>('leads');

  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState('');
  
  // New Lead States
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    courseId: courses[0]?.id || 'c-1',
    source: 'Website Contact Form',
    notes: ''
  });

  const stages: Array<Lead['status']> = ['NEW', 'CONTACTED', 'INTERESTED', 'COUNSELLING', 'APPLICATION', 'CONVERTED', 'LOST'];

  const getLeadsByStage = (stage: Lead['status']) => {
    return leads.filter(l => l.status === stage);
  };

  const handleAdvanceStage = (leadId: string, currentStage: Lead['status']) => {
    const idx = stages.indexOf(currentStage);
    if (idx === -1 || idx === stages.length - 1) return;
    const nextStage = stages[idx + 1];

    const updated = leads.map(l => l.id === leadId ? { ...l, status: nextStage } : l);
    SwanayaDatabase.set("leads", updated);
    setLeads(updated);

    SwanayaDatabase.log(currentUser.email, currentUser.name, "LEAD_STAGE_ADVANCED", `Lead ID: ${leadId} shifted to ${nextStage}`);
    onRefreshAllData();
  };

  const handleDropLead = (leadId: string) => {
    const updated = leads.map(l => l.id === leadId ? { ...l, status: 'LOST' as const } : l);
    SwanayaDatabase.set("leads", updated);
    setLeads(updated);

    SwanayaDatabase.log(currentUser.email, currentUser.name, "LEAD_STAGE_LOST", `Lead ID: ${leadId} dropped (Lost)`);
    onRefreshAllData();
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead || !noteText.trim()) return;

    const updated = leads.map(l => l.id === activeLead.id ? {
      ...l,
      notes: `${l.notes}\n[Note - ${new Date().toISOString().split('T')[0]}]: ${noteText}`
    } : l);

    SwanayaDatabase.set("leads", updated);
    setLeads(updated);
    setActiveLead(null);
    setNoteText('');
    
    SwanayaDatabase.log(currentUser.email, currentUser.name, "LEAD_NOTE_ADDED", `Counselor note posted for Lead ID: ${activeLead.id}`);
    onRefreshAllData();
  };

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email || !leadForm.phone) return;

    const newLead: Lead = {
      id: `ld-${Date.now()}`,
      name: leadForm.name,
      email: leadForm.email,
      phone: leadForm.phone,
      courseId: leadForm.courseId,
      source: leadForm.source,
      status: 'NEW',
      notes: leadForm.notes,
      assignedTo: currentUser.id,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updated = [...leads, newLead];
    SwanayaDatabase.set("leads", updated);
    setLeads(updated);
    setIsAddLeadOpen(false);
    setLeadForm({
      name: '',
      email: '',
      phone: '',
      courseId: courses[0]?.id || 'c-1',
      source: 'Website Contact Form',
      notes: ''
    });

    SwanayaDatabase.log(currentUser.email, currentUser.name, "LEAD_CREATE", `Manual lead created: ${newLead.name}`);
    onRefreshAllData();
  };

  return (
    <div className="space-y-6">
      
      {/* Sub tabs navigation */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-900/60 border border-slate-800 p-1 rounded-md max-w-fit">
        <button 
          onClick={() => setActiveTab('leads')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'leads' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Leads CRM Pipeline
        </button>
        <button 
          onClick={() => setActiveTab('instructors')}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded transition-all cursor-pointer ${
            activeTab === 'instructors' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-white'
          }`}
        >
          Instructor & Paper Allocation
        </button>
      </div>

      {activeTab === 'leads' ? (
        <>
          {/* Header Info */}
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200 font-serif">Academy Admissions CRM & Follow-Ups</h3>
              <p className="text-[10px] text-slate-500">Track incoming lead streams, schedule advisory calls, and manage counselor conversations.</p>
            </div>

            <button
              onClick={() => setIsAddLeadOpen(true)}
              className="flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Add Manual Prospect
            </button>
          </div>

          {/* CRM Pipeline Kanban Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const stageLeads = getLeadsByStage(stage);
              return (
                <div key={stage} className="bg-slate-950/60 border border-slate-900 rounded p-3 min-w-[200px] flex flex-col justify-between space-y-3">
                  <div className="border-b border-slate-850 pb-2 mb-2 flex justify-between items-center text-[10px] font-mono tracking-wider text-slate-400 font-bold uppercase">
                    <span>{stage.replace('_', ' ')}</span>
                    <span className="text-amber-500 font-extrabold">({stageLeads.length})</span>
                  </div>

                  <div className="space-y-3 flex-grow overflow-y-auto max-h-[400px]">
                    {stageLeads.map((lead) => (
                      <div key={lead.id} className="bg-slate-900 border border-slate-800/80 p-3 rounded space-y-3 hover:border-amber-500/20 transition-all text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-200">{lead.name}</p>
                          <p className="text-[9px] text-slate-500 font-mono">Source: {lead.source}</p>
                          <p className="text-[9px] text-slate-400 font-semibold">{courses.find(c=>c.id===lead.courseId)?.code}</p>
                        </div>

                        <div className="text-[10px] text-slate-500 space-y-1 border-t border-slate-850 pt-2 font-mono">
                          <p className="flex items-center gap-1"><PhoneCall className="w-3 h-3 text-amber-500" /> {lead.phone}</p>
                          <p className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 text-amber-500" /> {lead.email}</p>
                        </div>

                        {lead.notes && (
                          <p className="text-[10px] text-slate-400 leading-normal italic line-clamp-2 bg-slate-950/40 p-1.5 border border-slate-850 rounded">
                            "{lead.notes.substring(lead.notes.lastIndexOf(']:') + 2 || 0)}"
                          </p>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-slate-850/60">
                          <button
                            onClick={() => setActiveLead(lead)}
                            className="text-[9px] text-amber-500 hover:text-amber-400 font-mono font-bold flex items-center gap-0.5"
                          >
                            <MessageSquare className="w-3 h-3" /> Note
                          </button>

                          {stage !== 'CONVERTED' && stage !== 'LOST' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleDropLead(lead.id)}
                                className="p-1 bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded text-rose-400"
                                title="Drop lead"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleAdvanceStage(lead.id, lead.status)}
                                className="p-1 bg-slate-950 hover:bg-slate-850 border border-slate-850 rounded text-emerald-400 flex items-center justify-center"
                                title="Advance stage"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {stageLeads.length === 0 && (
                      <p className="text-[10px] text-slate-600 italic text-center py-6">Empty stage</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <InstructorAllocation currentUser={currentUser} onRefreshAllData={onRefreshAllData} />
      )}

      {/* Write Notes Dialogue */}
      {activeLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif">
              Post Counsel Conversation Note
            </h3>
            <p className="text-[11px] text-slate-500">Add notes for {activeLead.name} to track progress of conversion.</p>

            <form onSubmit={handleAddNote} className="space-y-4">
              <textarea 
                rows={4}
                required
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Candidate scheduled a counselling session. Specifically interested in high-frequency web layouts..."
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setActiveLead(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Manual Lead Modal */}
      {isAddLeadOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-850 pb-2 font-serif flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Manual Admissions Lead Entry
            </h3>

            <form onSubmit={handleAddLead} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Candidate Name</label>
                <input 
                  type="text" 
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({...leadForm, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Email</label>
                  <input 
                    type="email" 
                    required
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({...leadForm, email: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Phone</label>
                  <input 
                    type="tel" 
                    required
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({...leadForm, phone: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Target Course</label>
                  <select
                    value={leadForm.courseId}
                    onChange={(e) => setLeadForm({...leadForm, courseId: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold">Inquiry Source</label>
                  <select
                    value={leadForm.source}
                    onChange={(e) => setLeadForm({...leadForm, source: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="Instagram Campaign">Instagram Campaign</option>
                    <option value="Website Contact Form">Website Contact Form</option>
                    <option value="Direct Walk-in Inquiry">Direct Walk-in Inquiry</option>
                    <option value="WhatsApp Direct Chat">WhatsApp Direct Chat</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Initial Narrative notes</label>
                <textarea 
                  rows={2}
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({...leadForm, notes: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-sans"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setIsAddLeadOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded text-xs text-slate-400 uppercase font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer"
                >
                  Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
