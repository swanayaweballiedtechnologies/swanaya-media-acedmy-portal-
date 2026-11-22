/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { AdminGrant, SwanayaDatabase, User } from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';

interface MdAdminManagementPanelProps {
  currentUser: User;
  onRefreshAllData: () => void;
}

export default function MdAdminManagementPanel({
  currentUser,
  onRefreshAllData,
}: MdAdminManagementPanelProps) {
  const isMd = currentUser?.role === 'MD' || currentUser?.role === 'SUPER_ADMIN';

  const [grants, setGrants] = useState<AdminGrant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [busyGrantId, setBusyGrantId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    phone: '',
    role: 'ADMIN' as 'ADMIN' | 'ACADEMIC_ADMIN',
  });

  useEffect(() => {
    if (!isMd) return;
    setLoadingGrants(true);
    const unsub = academyService.subscribeAdminGrants({
      onData: (list) => {
        setGrants(list);
        setLoadingGrants(false);
      },
      onError: () => {
        setLoadingGrants(false);
      },
    });
    return () => unsub();
  }, [isMd]);

  if (!isMd) {
    return (
      <div className="rounded-xl bg-slate-900 border border-rose-500/30 p-8 text-center space-y-3">
        <Lock className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-lg font-serif font-bold text-white">Managing Director (MD) Access Required</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Only the Managing Director can authorize, suspend, or remove Administrator accounts. Self-service and peer admin creation are disabled.
        </p>
      </div>
    );
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    if (!cleanName || !cleanEmail || !cleanEmail.includes('@')) {
      setNotice({ type: 'error', text: 'Please enter a valid full name and official email address.' });
      return;
    }

    if (cleanEmail === String(currentUser.email || '').trim().toLowerCase()) {
      setNotice({ type: 'error', text: 'You are already signed in with Managing Director authority.' });
      return;
    }

    if (grants.some((g) => g.email.toLowerCase() === cleanEmail)) {
      setNotice({ type: 'error', text: 'An administrator authorization for this email already exists.' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await academyService.createAdminFromMd({
        name: cleanName,
        email: cleanEmail,
        username: formData.username.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        role: formData.role,
        grantedByUser: currentUser,
      });

      setGrants((prev) => [result.grant, ...prev.filter((g) => g.id !== result.grant.id)]);
      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        'MD_ADDED_ADMIN',
        `Authorized ${result.grant.role} access for ${result.grant.email}`
      );
      onRefreshAllData();

      setFormData({ name: '', email: '', username: '', phone: '', role: 'ADMIN' });
      setNotice({
        type: 'success',
        text: `Authorized ${result.grant.name} (${result.grant.email}) as ${result.grant.role.replace('_', ' ')}. ${
          result.syncedCloud ? 'Synced to Firestore & backend.' : 'Saved locally & synced to backend.'
        }`,
      });
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Could not create administrator grant. Verify your MD Google session and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (grant: AdminGrant) => {
    const nextStatus = grant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setBusyGrantId(grant.id);
    setNotice(null);
    try {
      await academyService.toggleAdminGrantStatus(grant, nextStatus);
      setGrants((prev) =>
        prev.map((g) => (g.id === grant.id ? { ...g, status: nextStatus } : g))
      );
      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        'MD_ADMIN_STATUS',
        `Set ${grant.email} admin status to ${nextStatus}`
      );
      onRefreshAllData();
      setNotice({
        type: 'success',
        text: `${grant.name} admin access is now ${nextStatus}.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to update administrator status.' });
    } finally {
      setBusyGrantId(null);
    }
  };

  const handleRemoveAdmin = async (grant: AdminGrant) => {
    setBusyGrantId(grant.id);
    setNotice(null);
    try {
      await academyService.removeAdminGrantAndUser(grant);
      setGrants((prev) => prev.filter((g) => g.id !== grant.id));
      setConfirmRemoveId(null);
      SwanayaDatabase.log(
        currentUser.email,
        currentUser.name,
        'MD_REMOVED_ADMIN',
        `Removed administrator privileges for ${grant.email}`
      );
      onRefreshAllData();
      setNotice({
        type: 'success',
        text: `Removed administrator authorization for ${grant.name} (${grant.email}).`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to remove administrator.' });
    } finally {
      setBusyGrantId(null);
    }
  };

  const activeCount = grants.filter((g) => g.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Managing Director (MD) Governance</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-white">Admin Access Control</h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Pre-seeded duplicate admins and self-signup admin roles are disabled. Only administrators explicitly authorized here by the MD can sign in to the Admin Portal.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Authorized Admins</span>
            <span className="text-lg font-bold font-mono text-amber-400">{activeCount} Active</span>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Cloud Auth</span>
            <span className={`text-xs font-bold font-mono ${auth.currentUser ? 'text-emerald-400' : 'text-amber-400'}`}>
              {auth.currentUser ? 'MD Connected' : 'Local Sync'}
            </span>
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Add Admin From MD Form */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <UserPlus className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-serif font-bold text-white">Add Administrator (MD Only)</h3>
          </div>

          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase font-bold text-slate-400">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Priya Nair"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase font-bold text-slate-400">
                Official Google / Login Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="admin@swanayamedia.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400">
                  Admin Tier *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: e.target.value as 'ADMIN' | 'ACADEMIC_ADMIN',
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="ADMIN">Administrator (ADMIN)</option>
                  <option value="ACADEMIC_ADMIN">Academic Admin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase font-bold text-slate-400">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="auto from email"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase font-bold text-slate-400">
                Contact Phone (Optional)
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 94460 00000"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{submitting ? 'Authorizing Admin...' : 'Authorize & Add Admin'}</span>
            </button>
          </form>
        </div>

        {/* Right: Active MD Authority + MD-Provisioned Admins List */}
        <div className="lg:col-span-7 space-y-4">
          {/* Primary MD Identity Card */}
          <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                <p className="text-[11px] font-mono text-slate-400 truncate">{currentUser.email}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[10px] font-mono font-bold uppercase shrink-0">
              {currentUser.role} · Root Authority
            </span>
          </div>

          {/* Authorized Admins List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                MD-Provisioned Administrators ({grants.length})
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Single Source of Authority</span>
            </div>

            {loadingGrants ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                Loading administrator authorizations...
              </div>
            ) : grants.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No Secondary Admins Added Yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  All preloaded duplicate admin accounts have been removed. Use the form on the left whenever you want the MD to grant admin access.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {grants.map((grant) => {
                  const isBusy = busyGrantId === grant.id;
                  const isConfirming = confirmRemoveId === grant.id;
                  return (
                    <div key={grant.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">{grant.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                            {grant.role.replace('_', ' ')}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              grant.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {grant.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" />
                            {grant.email}
                          </span>
                          {grant.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {grant.phone}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Authorized by {grant.grantedByName || 'Managing Director'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleStatus(grant)}
                          className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1.5 transition-colors ${
                            grant.status === 'ACTIVE'
                              ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                              : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                          }`}
                        >
                          {grant.status === 'ACTIVE' ? (
                            <>
                              <UserX className="w-3.5 h-3.5 text-amber-400" />
                              Suspend
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              Activate
                            </>
                          )}
                        </button>

                        {!isConfirming ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmRemoveId(grant.id)}
                            className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/15 text-[11px] font-bold cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleRemoveAdmin(grant)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                            >
                              {isBusy ? 'Removing...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmRemoveId(null)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
