/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Shield, ChevronDown, Check, RefreshCw } from 'lucide-react';
import { User, UserRole } from '../db/mockDb';

interface RoleSwitcherProps {
  users: User[];
  activeUser: User;
  onSelectUser: (user: User) => void;
}

export default function RoleSwitcher({ users, activeUser, onSelectUser }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
      case 'ADMIN': return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'ACADEMIC_ADMIN': return 'text-sky-400 border-sky-500/20 bg-sky-500/5';
      case 'INSTRUCTOR': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'STUDENT': return 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5';
      case 'FINANCE': return 'text-teal-400 border-teal-500/20 bg-teal-500/5';
      case 'COUNSELLOR': return 'text-purple-400 border-purple-500/20 bg-purple-500/5';
      case 'CAREER': return 'text-pink-400 border-pink-500/20 bg-pink-500/5';
      default: return 'text-slate-400 border-slate-500/20 bg-slate-500/5';
    }
  };

  const getRoleExplanation = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'System-wide configurations, audit log viewer, raw local database storage reset.';
      case 'ADMIN': return 'Manage students, configure batches, courses registry, handle admissions.';
      case 'ACADEMIC_ADMIN': return 'Curriculum builder (subjects/semesters), timetables scheduler, grades mapper.';
      case 'INSTRUCTOR': return 'Mark class attendance, post homework/exams, review uploads, grade projects.';
      case 'STUDENT': return 'Track classes, interactive LMS reader, check syllabus progress, submit assignments.';
      case 'FINANCE': return 'Outstanding fees ledger, payments, invoices, receipt generation.';
      case 'COUNSELLOR': return 'Admissions CRM stage pipelines (Leads -> Enrolled, drag-&-drop simulated flow).';
      case 'CAREER': return 'Skills tracker, career readiness calculator, public student portfolio generator.';
    }
  };

  return (
    <div className="relative">
      {/* Dropdown Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 hover:border-amber-500/30 transition-all cursor-pointer"
      >
        <Shield className="w-3.5 h-3.5 text-amber-500" />
        <div className="text-left">
          <p className="font-semibold text-slate-200 text-[11px] leading-tight flex items-center gap-1.5">
            {activeUser.name} 
            <span className={`text-[9px] font-mono border px-1.5 py-0.2 rounded font-bold uppercase ${getRoleBadgeColor(activeUser.role)}`}>
              {activeUser.role.replace('_', ' ')}
            </span>
          </p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl z-50 p-3 max-h-[480px] overflow-y-auto">
            <div className="pb-2 mb-2 border-b border-slate-800/80">
              <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1">
                <RefreshCw className="w-3 h-3 text-amber-500 animate-spin-slow" />
                Select Review Role / User Profile
              </p>
              <p className="text-[9px] text-slate-600 mt-0.5">Swap roles below to verify permission gates & specialized portals.</p>
            </div>
            
            <div className="space-y-1">
              {users.map((usr) => (
                <button
                  key={usr.id}
                  onClick={() => {
                    onSelectUser(usr);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded hover:bg-slate-900 transition-colors flex items-start gap-2 border ${
                    usr.id === activeUser.id 
                      ? 'bg-slate-900/60 border-amber-500/20' 
                      : 'border-transparent'
                  }`}
                >
                  <img 
                    src={usr.avatarUrl} 
                    alt={usr.name} 
                    className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 shrink-0" 
                  />
                  <div className="flex-grow space-y-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-200">{usr.name}</p>
                      {usr.id === activeUser.id && (
                        <Check className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[8px] font-mono px-1 rounded font-bold ${getRoleBadgeColor(usr.role)}`}>
                        {usr.role.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal pt-1 border-t border-slate-900 mt-1">
                      {getRoleExplanation(usr.role)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
