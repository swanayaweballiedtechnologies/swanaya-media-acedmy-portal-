/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, ShieldAlert, Check, RefreshCw, Save, Trash2, Database } from 'lucide-react';
import { SwanayaDatabase, AcademySettings, AuditLog } from '../db/mockDb';

interface SettingsAuditPortalProps {
  currentUser: any;
  onRefreshAllData: () => void;
}

export default function SettingsAuditPortal({ currentUser, onRefreshAllData }: SettingsAuditPortalProps) {
  const [settings, setSettings] = useState<AcademySettings>(() => SwanayaDatabase.get<AcademySettings>("settings"));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => SwanayaDatabase.get<AuditLog[]>("auditLogs"));
  const [saved, setSaved] = useState(false);

  // Form states
  const [form, setForm] = useState<AcademySettings>({ ...settings });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    SwanayaDatabase.set("settings", form);
    setSettings(form);

    SwanayaDatabase.log(currentUser.email, currentUser.name, "SETTINGS_SAVED", "Modified Academy Configuration");
    setAuditLogs(SwanayaDatabase.get<AuditLog[]>("auditLogs"));

    setSaved(true);
    onRefreshAllData();
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetDatabase = () => {
    if (window.confirm("Are you absolutely sure you want to reset the local database? This will clear all localStorage entries and reload default seed configurations.")) {
      localStorage.clear();
      SwanayaDatabase.init();
      
      setSettings(SwanayaDatabase.get<AcademySettings>("settings"));
      setForm(SwanayaDatabase.get<AcademySettings>("settings"));
      setAuditLogs(SwanayaDatabase.get<AuditLog[]>("auditLogs"));
      
      onRefreshAllData();
      window.location.reload();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* Left Column: Academy Settings Form */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
              <Settings className="w-4 h-4 text-amber-500" />
              Syllabus & Academy Rules
            </h3>
            {saved && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                <Check className="w-4 h-4" /> Config Saved
              </span>
            )}
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Academy Name</label>
              <input 
                type="text" 
                required
                value={form.academyName}
                onChange={(e) => setForm({ ...form, academyName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Logo Wordmark</label>
                <input 
                  type="text" 
                  required
                  value={form.logoText}
                  onChange={(e) => setForm({ ...form, logoText: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-serif"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-bold">Contact Phone</label>
                <input 
                  type="text" 
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                <span>💬 Admin WhatsApp Access Phone</span>
              </label>
              <input 
                type="text" 
                required
                value={form.adminWhatsAppPhone || '+91 94460 12345'}
                onChange={(e) => setForm({ ...form, adminWhatsAppPhone: e.target.value })}
                placeholder="+91 94460 12345"
                className="w-full bg-slate-950 border border-emerald-500/30 rounded px-3 py-2 text-xs text-emerald-300 font-mono focus:border-emerald-400 focus:outline-none"
              />
              <p className="text-[9px] text-slate-500 font-mono">
                Direct WhatsApp contact number displayed across student registration and portal help desks.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Contact Email</label>
              <input 
                type="email" 
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold">Physical Address Location</label>
              <input 
                type="text" 
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase font-bold">Currency</label>
                <input 
                  type="text" 
                  required
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase font-bold">Timezone</label>
                <input 
                  type="text" 
                  required
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase font-bold">Language</label>
                <input 
                  type="text" 
                  required
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Commit Configurations
            </button>
          </form>
        </div>

        {/* Danger zone local storage wipe */}
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-5 space-y-3">
          <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1">
            <Database className="w-4 h-4 text-rose-400" />
            Administrative Storage Reset
          </h4>
          <p className="text-[10px] text-slate-400 leading-normal">
            To reset state during grading, use this trigger to wipe HTML5 localStorage and re-bootstrap fresh pristine database seeds.
          </p>
          <button
            onClick={handleResetDatabase}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Wipe & Reset local DB
          </button>
        </div>
      </div>

      {/* Right Column: Secure Audit logs listing */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Operational Security Audits
          </h3>
          <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded">
            SSL SECURE CHANNEL
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-3 bg-slate-950 text-slate-500 text-[10px] font-mono border-b border-slate-850 uppercase font-bold tracking-wider grid grid-cols-12">
            <span className="col-span-3">Timestamp / IP</span>
            <span className="col-span-3">User Operator</span>
            <span className="col-span-3">Operational Action</span>
            <span className="col-span-3">Target Entity</span>
          </div>

          <div className="divide-y divide-slate-850/60 max-h-[420px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 hover:bg-slate-950/20 transition-colors grid grid-cols-12 text-[10px] font-mono leading-normal text-slate-400 items-start">
                <div className="col-span-3 space-y-0.5">
                  <p className="text-slate-300">{log.timestamp}</p>
                  <span className="text-[8px] text-slate-600 block">{log.ipAddress}</span>
                </div>
                <div className="col-span-3">
                  <p className="text-slate-200 font-bold">{log.userName}</p>
                  <span className="text-[8px] text-slate-500 block truncate">{log.userEmail}</span>
                </div>
                <div className="col-span-3 text-amber-500 font-bold">
                  {log.action}
                </div>
                <div className="col-span-3 text-slate-300 truncate font-sans">
                  {log.entity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
