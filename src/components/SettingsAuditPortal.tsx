/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Settings,
  ShieldAlert,
  Check,
  Save,
  Trash2,
  Database,
  Globe,
  Eye,
  RotateCcw,
  Plus,
  Layout,
  Sparkles,
  MessageSquareQuote,
  FileText,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Film,
  Lock,
  Unlock,
  MessageCircle,
  Palette
} from 'lucide-react';
import {
  SwanayaDatabase,
  AcademySettings,
  AuditLog,
  FrontPageConfig,
  FrontPagePosterItem,
  INITIAL_FRONT_PAGE_CONFIG
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';
import { applyDocumentFavicon, processLogoUploadFile } from '../utils/favicon';
import {
  parseFrontPageVideoUrl,
  processPosterUploadFile,
  readSmallVideoFileAsDataUrl
} from '../utils/mediaHelpers';
import AdminThemeConsole from './AdminThemeConsole';

interface SettingsAuditPortalProps {
  currentUser: any;
  onRefreshAllData: () => void;
  initialTab?: 'front-page' | 'theme' | 'academy' | 'audits';
  onPreviewLanding?: () => void;
}

function mergeFrontPageConfig(partial?: Partial<FrontPageConfig> | null): FrontPageConfig {
  const safe = partial && typeof partial === 'object' ? partial : {};
  return {
    ...INITIAL_FRONT_PAGE_CONFIG,
    ...safe,
    cohortItems:
      Array.isArray(safe.cohortItems) && safe.cohortItems.length > 0
        ? safe.cohortItems.slice(0, 4)
        : INITIAL_FRONT_PAGE_CONFIG.cohortItems,
    philosophyPillars:
      Array.isArray(safe.philosophyPillars) && safe.philosophyPillars.length > 0
        ? safe.philosophyPillars.slice(0, 4)
        : INITIAL_FRONT_PAGE_CONFIG.philosophyPillars,
    posters:
      Array.isArray(safe.posters)
        ? safe.posters.slice(0, 6)
        : INITIAL_FRONT_PAGE_CONFIG.posters,
    showReviewsSection:
      typeof safe.showReviewsSection === 'boolean'
        ? safe.showReviewsSection
        : INITIAL_FRONT_PAGE_CONFIG.showReviewsSection,
    showBlogSection:
      typeof safe.showBlogSection === 'boolean'
        ? safe.showBlogSection
        : INITIAL_FRONT_PAGE_CONFIG.showBlogSection,
    showAdmissionsSection:
      typeof safe.showAdmissionsSection === 'boolean'
        ? safe.showAdmissionsSection
        : INITIAL_FRONT_PAGE_CONFIG.showAdmissionsSection,
    showMediaShowcaseSection:
      typeof safe.showMediaShowcaseSection === 'boolean'
        ? safe.showMediaShowcaseSection
        : INITIAL_FRONT_PAGE_CONFIG.showMediaShowcaseSection,
    editingEnabled:
      typeof safe.editingEnabled === 'boolean'
        ? safe.editingEnabled
        : INITIAL_FRONT_PAGE_CONFIG.editingEnabled ?? true,
  };
}

export default function SettingsAuditPortal({
  currentUser,
  onRefreshAllData,
  initialTab = 'front-page',
  onPreviewLanding,
}: SettingsAuditPortalProps) {
  const [activeTab, setActiveTab] = useState<'front-page' | 'theme' | 'academy' | 'audits'>(initialTab);
  const [settings, setSettings] = useState<AcademySettings>(() => SwanayaDatabase.get<AcademySettings>('settings'));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => SwanayaDatabase.get<AuditLog[]>('auditLogs'));
  const [saved, setSaved] = useState(false);
  const [confirmDbReset, setConfirmDbReset] = useState(false);

  // Academy Settings form state
  const [form, setForm] = useState<AcademySettings>({ ...settings });

  // Front Page Editor state
  const [frontPageForm, setFrontPageForm] = useState<FrontPageConfig>(() =>
    mergeFrontPageConfig(SwanayaDatabase.get<FrontPageConfig>('frontPageConfig'))
  );
  const [savingFrontPage, setSavingFrontPage] = useState(false);
  const [frontPageNotice, setFrontPageNotice] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [confirmFrontReset, setConfirmFrontReset] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [uploadingMediaItem, setUploadingMediaItem] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    let mounted = true;
    const loadCloudFrontPage = async () => {
      try {
        const cloud = await academyService.getFrontPageConfig();
        if (mounted && cloud) {
          const merged = mergeFrontPageConfig(cloud as Partial<FrontPageConfig>);
          setFrontPageForm(merged);
          SwanayaDatabase.set('frontPageConfig', merged);
        }
      } catch {
        // Keep local configuration on offline/uninitialized document
      }
    };
    loadCloudFrontPage();
    return () => {
      mounted = false;
    };
  }, []);

  const isFrontPageEditable = frontPageForm.editingEnabled !== false;
  const isAcademyConfigEditable = form.configEditingEnabled !== false;

  const handleToggleFrontPageEditMode = async () => {
    const nextEnabled = !isFrontPageEditable;
    const nextConfig: FrontPageConfig = {
      ...frontPageForm,
      id: 'front_page',
      editingEnabled: nextEnabled,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.email || 'MD / Admin',
    };

    setFrontPageForm(nextConfig);
    SwanayaDatabase.set('frontPageConfig', nextConfig);
    setConfirmFrontReset(false);

    let syncedCloud = false;
    if (auth.currentUser) {
      try {
        await academyService.saveFrontPageConfig(nextConfig);
        syncedCloud = true;
      } catch {
        // Keep local toggle state if cloud write requires Firebase Admin token
      }
    }

    SwanayaDatabase.log(
      currentUser?.email || 'md@swanayamedia.com',
      currentUser?.name || 'Managing Director',
      'FRONT_PAGE_EDIT_MODE',
      `Turned ${nextEnabled ? 'ON' : 'OFF'} Front Page Edit Mode (${syncedCloud ? 'Local + Cloud' : 'Local'})`
    );
    setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));
    onRefreshAllData();

    setFrontPageNotice({
      type: nextEnabled ? 'success' : 'info',
      text: nextEnabled
        ? 'Edit Mode is now ON. Front Page sections are unlocked and editable.'
        : 'Edit Mode has been turned OFF. Front Page Editor is now locked in Read-Only mode.',
    });
  };

  const handleToggleAcademyConfigEditMode = () => {
    const nextEnabled = !isAcademyConfigEditable;
    const nextSettings: AcademySettings = {
      ...form,
      configEditingEnabled: nextEnabled,
    };

    setForm(nextSettings);
    setSettings(nextSettings);
    SwanayaDatabase.set('settings', nextSettings);

    SwanayaDatabase.log(
      currentUser?.email || 'md@swanayamedia.com',
      currentUser?.name || 'Managing Director',
      'SETTINGS_EDIT_MODE',
      `Turned ${nextEnabled ? 'ON' : 'OFF'} Academy Configuration Edit Mode`
    );
    setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));
    onRefreshAllData();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAcademyConfigEditable) return;
    const syncedContactPhone = (form.phone || form.adminWhatsAppPhone || '+91 94460 55555').trim();
    const updatedSettings: AcademySettings = {
      ...form,
      phone: syncedContactPhone,
      adminWhatsAppPhone: form.adminWhatsAppPhone?.trim() || syncedContactPhone,
    };
    SwanayaDatabase.set('settings', updatedSettings);
    setSettings(updatedSettings);
    setForm(updatedSettings);

    SwanayaDatabase.log(
      currentUser?.email || 'md@swanayamedia.com',
      currentUser?.name || 'Managing Director',
      'SETTINGS_SAVED',
      `Modified Academy Configuration (${syncedContactPhone})`
    );
    setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));

    setSaved(true);
    onRefreshAllData();
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetDatabase = () => {
    localStorage.clear();
    SwanayaDatabase.init();

    const freshSettings = SwanayaDatabase.get<AcademySettings>('settings');
    setSettings(freshSettings);
    setForm(freshSettings);
    setFrontPageForm(mergeFrontPageConfig(SwanayaDatabase.get<FrontPageConfig>('frontPageConfig')));
    setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));
    setConfirmDbReset(false);

    onRefreshAllData();
    window.location.reload();
  };

  const handleSaveFrontPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFrontPageEditable) {
      setFrontPageNotice({
        type: 'info',
        text: 'Edit Mode is turned OFF. Enable Edit Mode first to save or publish changes.',
      });
      return;
    }
    setFrontPageNotice(null);
    setSavingFrontPage(true);

    const payload: FrontPageConfig = {
      ...frontPageForm,
      id: 'front_page',
      brandWordmark: frontPageForm.brandWordmark.trim() || INITIAL_FRONT_PAGE_CONFIG.brandWordmark,
      heroHeadlinePrefix: frontPageForm.heroHeadlinePrefix.trim() || INITIAL_FRONT_PAGE_CONFIG.heroHeadlinePrefix,
      heroDescription: frontPageForm.heroDescription.trim() || INITIAL_FRONT_PAGE_CONFIG.heroDescription,
      cohortItems: frontPageForm.cohortItems
        .filter((item) => item.title.trim().length > 0)
        .slice(0, 4),
      philosophyPillars: frontPageForm.philosophyPillars.slice(0, 4),
      posters: (frontPageForm.posters || [])
        .filter((p) => p.imageUrl.trim().length > 0 || p.title.trim().length > 0)
        .slice(0, 6),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.email || 'MD / Admin',
    };

    try {
      SwanayaDatabase.set('frontPageConfig', payload);
      setFrontPageForm(payload);
      applyDocumentFavicon(payload.faviconUrl);

      let syncedCloud = false;
      if (auth.currentUser) {
        await academyService.saveFrontPageConfig(payload);
        syncedCloud = true;
      }

      SwanayaDatabase.log(
        currentUser?.email || 'md@swanayamedia.com',
        currentUser?.name || 'Managing Director',
        'FRONT_PAGE_UPDATED',
        `Published Public Landing Page Updates (${syncedCloud ? 'Local + Cloud' : 'Local Session'})`
      );
      setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));
      onRefreshAllData();

      setFrontPageNotice({
        type: syncedCloud ? 'success' : 'info',
        text: syncedCloud
          ? 'Front page updated and published globally to Firestore and local cache.'
          : 'Front page saved for this portal session. Sign in via Firebase Admin email to publish across all public visitors.',
      });
    } catch {
      setFrontPageNotice({
        type: 'error',
        text: 'Saved locally, but cloud sync failed. Ensure your account has MD/Admin permissions in Firestore.',
      });
    } finally {
      setSavingFrontPage(false);
    }
  };

  const handleResetFrontPageDefaults = async () => {
    const resetPayload: FrontPageConfig = {
      ...INITIAL_FRONT_PAGE_CONFIG,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || currentUser?.email || 'MD Reset',
    };
    setFrontPageForm(resetPayload);
    SwanayaDatabase.set('frontPageConfig', resetPayload);
    applyDocumentFavicon(resetPayload.faviconUrl);
    setConfirmFrontReset(false);

    if (auth.currentUser) {
      try {
        await academyService.saveFrontPageConfig(resetPayload);
      } catch {
        // Ignore cloud sync error on reset if session lacks Firebase admin token
      }
    }

    SwanayaDatabase.log(
      currentUser?.email || 'md@swanayamedia.com',
      currentUser?.name || 'Managing Director',
      'FRONT_PAGE_RESET',
      'Restored Public Front Page to default editorial copy'
    );
    setAuditLogs(SwanayaDatabase.get<AuditLog[]>('auditLogs'));
    onRefreshAllData();
    setFrontPageNotice({
      type: 'success',
      text: 'Front page copy restored to academy defaults.',
    });
  };

  const updateCohortItem = (index: number, field: 'title' | 'subtitle' | 'badgeText', value: string) => {
    const next = [...frontPageForm.cohortItems];
    next[index] = { ...next[index], [field]: value };
    setFrontPageForm({ ...frontPageForm, cohortItems: next });
  };

  const addCohortItem = () => {
    if (frontPageForm.cohortItems.length >= 4) return;
    setFrontPageForm({
      ...frontPageForm,
      cohortItems: [
        ...frontPageForm.cohortItems,
        { title: 'New Executive Program', subtitle: 'Duration: 6 Months · Hybrid', badgeText: 'Open' },
      ],
    });
  };

  const removeCohortItem = (index: number) => {
    if (frontPageForm.cohortItems.length <= 1) return;
    setFrontPageForm({
      ...frontPageForm,
      cohortItems: frontPageForm.cohortItems.filter((_, idx) => idx !== index),
    });
  };

  const updatePillar = (index: number, field: 'title' | 'description', value: string) => {
    const next = [...frontPageForm.philosophyPillars];
    next[index] = { ...next[index], [field]: value };
    setFrontPageForm({ ...frontPageForm, philosophyPillars: next });
  };

  const addPosterItem = () => {
    const current = frontPageForm.posters || [];
    if (current.length >= 6) return;
    const newPoster: FrontPagePosterItem = {
      id: `poster-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'New Academy Poster',
      caption: 'Upcoming admissions & studio masterclass details.',
      imageUrl: '',
      ctaLabel: 'Apply Now',
      ctaUrl: '#admissions',
    };
    setFrontPageForm({ ...frontPageForm, posters: [...current, newPoster] });
  };

  const updatePosterItem = (index: number, patch: Partial<FrontPagePosterItem>) => {
    const next = [...(frontPageForm.posters || [])];
    next[index] = { ...next[index], ...patch };
    setFrontPageForm({ ...frontPageForm, posters: next });
  };

  const removePosterItem = (index: number) => {
    setFrontPageForm({
      ...frontPageForm,
      posters: (frontPageForm.posters || []).filter((_, idx) => idx !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Bar + Console Switcher */}
      <div className="bg-[#0A0D14] border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
            MD & System Control Panel
          </span>
          <h2 className="text-xl font-serif font-bold text-white mt-0.5">
            Front Page Editor & System Configurations
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Customize public landing page messaging, section visibility, academy metadata, and review audit trails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('front-page')}
            className={`px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeTab === 'front-page'
                ? 'bg-amber-500 text-black'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Front Page Editor
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('theme')}
            className={`px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeTab === 'theme'
                ? 'bg-[var(--sma-primary)] text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Theme &amp; Colours
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('academy')}
            className={`px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeTab === 'academy'
                ? 'bg-amber-500 text-black'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Academy Rules
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audits')}
            className={`px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeTab === 'audits'
                ? 'bg-amber-500 text-black'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Security Audits
          </button>

          {onPreviewLanding && (
            <button
              type="button"
              onClick={onPreviewLanding}
              className="px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview Front Page
            </button>
          )}
        </div>
      </div>

      {/* TAB: THEME & COLOUR MANAGEMENT */}
      {activeTab === 'theme' && (
        <AdminThemeConsole currentUser={currentUser} onThemeSaved={onRefreshAllData} />
      )}

      {/* TAB 1: FRONT PAGE EDITOR */}
      {activeTab === 'front-page' && (
        <form onSubmit={handleSaveFrontPage} className="space-y-6">
          {/* Sticky Action Strip */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-amber-400" />
                  Live Public Website Copy &amp; Layout Controls
                </p>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                    isFrontPageEditable
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {isFrontPageEditable ? (
                    <>
                      <Unlock className="w-3 h-3" />
                      Edit Mode: ON (Editable)
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" />
                      Edit Mode: OFF (Read-Only)
                    </>
                  )}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500">
                Last updated: {String(frontPageForm.updatedAt || '').slice(0, 19).replace('T', ' ')} · By {frontPageForm.updatedBy || 'System Default'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleFrontPageEditMode}
                className={`px-3.5 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                  isFrontPageEditable
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-200 hover:bg-rose-500/25'
                    : 'bg-emerald-500 border-emerald-400 text-black hover:bg-emerald-400'
                }`}
              >
                {isFrontPageEditable ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    Turn Off Edit Mode
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    Turn On Edit Mode
                  </>
                )}
              </button>

              {!confirmFrontReset ? (
                <button
                  type="button"
                  disabled={!isFrontPageEditable}
                  onClick={() => setConfirmFrontReset(true)}
                  className="px-3.5 py-2 bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-semibold uppercase tracking-wider rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
              ) : (
                <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 rounded px-2.5 py-1">
                  <span className="text-[11px] text-rose-300 font-medium">Restore default copy?</span>
                  <button
                    type="button"
                    onClick={handleResetFrontPageDefaults}
                    className="px-2 py-1 bg-rose-500 text-white text-[10px] font-bold uppercase rounded cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmFrontReset(false)}
                    className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold uppercase rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={savingFrontPage || !isFrontPageEditable}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {savingFrontPage ? 'Publishing...' : 'Save & Publish Front Page'}
              </button>
            </div>
          </div>

          {!isFrontPageEditable && (
            <div className="p-3.5 rounded-lg border bg-rose-500/10 border-rose-500/30 text-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  Front Page Edit Mode is currently <strong>OFF (Read-Only Lock)</strong>. Fields below are protected from accidental edits.
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleFrontPageEditMode}
                className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer"
              >
                Turn On Edit Mode
              </button>
            </div>
          )}

          {frontPageNotice && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-center gap-2 ${
                frontPageNotice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : frontPageNotice.type === 'info'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {frontPageNotice.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <Check className="w-4 h-4 shrink-0" />
              )}
              <span>{frontPageNotice.text}</span>
            </div>
          )}

          <fieldset
            disabled={!isFrontPageEditable}
            className={!isFrontPageEditable ? 'space-y-6 opacity-60 pointer-events-none select-none' : 'space-y-6'}
          >
          {/* Section Visibility Toggles */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
              Section Visibility Controls
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <label className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3.5 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Posters &amp; Video</p>
                  <p className="text-[11px] text-slate-500">Show front page posters &amp; video showcase</p>
                </div>
                <input
                  type="checkbox"
                  checked={frontPageForm.showMediaShowcaseSection}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, showMediaShowcaseSection: e.target.checked })}
                  className="h-4 w-4 accent-amber-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3.5 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Reviews & Ratings</p>
                  <p className="text-[11px] text-slate-500">Show student reviews section & public form</p>
                </div>
                <input
                  type="checkbox"
                  checked={frontPageForm.showReviewsSection}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, showReviewsSection: e.target.checked })}
                  className="h-4 w-4 accent-amber-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3.5 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Academy Blog & Insights</p>
                  <p className="text-[11px] text-slate-500">Show published Media Hub articles</p>
                </div>
                <input
                  type="checkbox"
                  checked={frontPageForm.showBlogSection}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, showBlogSection: e.target.checked })}
                  className="h-4 w-4 accent-amber-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3.5 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Online Admissions Form</p>
                  <p className="text-[11px] text-slate-500">Show CAPTCHA-verified enrollment form</p>
                </div>
                <input
                  type="checkbox"
                  checked={frontPageForm.showAdmissionsSection}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, showAdmissionsSection: e.target.checked })}
                  className="h-4 w-4 accent-amber-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 1. Header & Hero Copy + 2. Cohort Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Hero & Navigation */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                1. Header Branding & Hero Section
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Brand Wordmark</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={frontPageForm.brandWordmark}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, brandWordmark: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-serif"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Brand Subtitle</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={frontPageForm.brandSubtitle}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, brandSubtitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Portal Button Text</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={frontPageForm.portalButtonLabel}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, portalButtonLabel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              {/* Favicon & Front Page Brand Logo Controls */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                    <ImageIcon className="w-4 h-4 shrink-0" />
                    <span>Browser Favicon &amp; Front Page Brand Logo</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">PNG, SVG, JPG, WebP or URL</span>
                </div>

                {logoUploadError && (
                  <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{logoUploadError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Browser Tab Favicon */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-400 uppercase font-bold">Browser Tab Favicon</label>
                      <button
                        type="button"
                        onClick={() => {
                          setFrontPageForm({ ...frontPageForm, faviconUrl: '/favicon.svg' });
                          applyDocumentFavicon('/favicon.svg');
                          setLogoUploadError(null);
                        }}
                        className="text-[10px] text-slate-400 hover:text-amber-300 cursor-pointer"
                      >
                        Reset Default
                      </button>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden p-1">
                        <img
                          src={frontPageForm.faviconUrl || '/favicon.svg'}
                          alt="Favicon preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <input
                        type="text"
                        maxLength={250000}
                        value={frontPageForm.faviconUrl || ''}
                        onChange={(e) => {
                          setFrontPageForm({ ...frontPageForm, faviconUrl: e.target.value });
                          setLogoUploadError(null);
                        }}
                        placeholder="/favicon.svg or https://..."
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200 font-mono"
                      />
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-semibold text-slate-200 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Favicon Image</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          try {
                            setLogoUploadError(null);
                            const dataUrl = await processLogoUploadFile(file, 128);
                            setFrontPageForm((prev) => ({ ...prev, faviconUrl: dataUrl }));
                            applyDocumentFavicon(dataUrl);
                          } catch (err: any) {
                            setLogoUploadError(err?.message || 'Unable to process favicon file.');
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Header & Footer Logo */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10px] text-slate-400 uppercase font-bold">Front Page Header Logo</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFrontPageForm((prev) => ({ ...prev, brandLogoUrl: prev.faviconUrl || '/favicon.svg' }));
                            setLogoUploadError(null);
                          }}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          Use Favicon
                        </button>
                        {frontPageForm.brandLogoUrl && (
                          <button
                            type="button"
                            onClick={() => setFrontPageForm((prev) => ({ ...prev, brandLogoUrl: '' }))}
                            className="text-[10px] text-slate-400 hover:text-rose-300 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden p-1">
                        {frontPageForm.brandLogoUrl ? (
                          <img
                            src={frontPageForm.brandLogoUrl}
                            alt="Brand logo preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={250000}
                        value={frontPageForm.brandLogoUrl || ''}
                        onChange={(e) => {
                          setFrontPageForm({ ...frontPageForm, brandLogoUrl: e.target.value });
                          setLogoUploadError(null);
                        }}
                        placeholder="Optional header/footer logo URL"
                        className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-slate-200 font-mono"
                      />
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-semibold text-slate-200 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Brand Logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          try {
                            setLogoUploadError(null);
                            const dataUrl = await processLogoUploadFile(file, 256);
                            setFrontPageForm((prev) => ({ ...prev, brandLogoUrl: dataUrl }));
                          } catch (err: any) {
                            setLogoUploadError(err?.message || 'Unable to process brand logo file.');
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Hero Eyebrow Label</label>
                <input
                  type="text"
                  maxLength={160}
                  value={frontPageForm.heroEyebrow}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, heroEyebrow: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-amber-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Headline Line 1</label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={frontPageForm.heroHeadlinePrefix}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, heroHeadlinePrefix: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-amber-400 uppercase font-bold">Gold Highlight Phrase</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={frontPageForm.heroHeadlineHighlight}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, heroHeadlineHighlight: e.target.value })}
                    className="w-full bg-slate-950 border border-amber-500/30 rounded px-3 py-2 text-xs text-amber-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Headline Line 3</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={frontPageForm.heroHeadlineSuffix}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, heroHeadlineSuffix: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Hero Subheadline Description</label>
                <textarea
                  rows={3}
                  required
                  maxLength={2000}
                  value={frontPageForm.heroDescription}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, heroDescription: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Primary Hero Button</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={frontPageForm.heroPrimaryCta}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, heroPrimaryCta: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Secondary Hero Button</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={frontPageForm.heroSecondaryCta}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, heroSecondaryCta: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Cohort Highlights Card */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  2. Hero Cohort Highlights Card
                </h3>
                {frontPageForm.cohortItems.length < 4 && (
                  <button
                    type="button"
                    onClick={addCohortItem}
                    className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Row
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Card Header Title</label>
                  <input
                    type="text"
                    maxLength={160}
                    value={frontPageForm.cohortCardTitle}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, cohortCardTitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-amber-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Campus Location Label</label>
                  <input
                    type="text"
                    maxLength={160}
                    value={frontPageForm.cohortLocationLabel}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, cohortLocationLabel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {frontPageForm.cohortItems.map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">Cohort Row #{idx + 1}</span>
                      {frontPageForm.cohortItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCohortItem(idx)}
                          className="text-[10px] text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Program Title"
                      value={item.title}
                      onChange={(e) => updateCohortItem(idx, 'title', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Duration & Level"
                        value={item.subtitle}
                        onChange={(e) => updateCohortItem(idx, 'subtitle', e.target.value)}
                        className="col-span-2 bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300"
                      />
                      <input
                        type="text"
                        placeholder="Status"
                        value={item.badgeText}
                        onChange={(e) => updateCohortItem(idx, 'badgeText', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-400 font-medium"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Promotional Posters & Featured Video Editor */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-amber-400" />
                  Posters &amp; Featured Video Showcase
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Upload promotional event posters and link or upload a featured academy video for the public front page.
                </p>
              </div>
              {(frontPageForm.posters || []).length < 6 && (
                <button
                  type="button"
                  onClick={addPosterItem}
                  className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Poster ({(frontPageForm.posters || []).length}/6)
                </button>
              )}
            </div>

            {mediaUploadError && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{mediaUploadError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Showcase Eyebrow</label>
                <input
                  type="text"
                  maxLength={120}
                  value={frontPageForm.mediaSectionEyebrow || ''}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, mediaSectionEyebrow: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-amber-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Showcase Title</label>
                <input
                  type="text"
                  maxLength={200}
                  value={frontPageForm.mediaSectionTitle || ''}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, mediaSectionTitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-serif"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Showcase Subtitle</label>
                <input
                  type="text"
                  maxLength={600}
                  value={frontPageForm.mediaSectionSubtitle || ''}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, mediaSectionSubtitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300"
                />
              </div>
            </div>

            {/* Featured Video Block */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Featured Front Page Video</p>
                  {frontPageForm.featuredVideoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setFrontPageForm({
                          ...frontPageForm,
                          featuredVideoUrl: '',
                          featuredVideoPosterUrl: '',
                        })
                      }
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                    >
                      Remove Video
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Video Title</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={frontPageForm.featuredVideoTitle || ''}
                      onChange={(e) => setFrontPageForm({ ...frontPageForm, featuredVideoTitle: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Video Link (YouTube, Vimeo or MP4)</label>
                    <input
                      type="text"
                      maxLength={600000}
                      value={frontPageForm.featuredVideoUrl || ''}
                      onChange={(e) => {
                        setFrontPageForm({ ...frontPageForm, featuredVideoUrl: e.target.value });
                        setMediaUploadError(null);
                      }}
                      placeholder="https://youtube.com/watch?v=... or MP4 URL"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Video Caption / Description</label>
                  <input
                    type="text"
                    maxLength={600}
                    value={frontPageForm.featuredVideoCaption || ''}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, featuredVideoCaption: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-semibold text-slate-200 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>{uploadingMediaItem ? 'Processing...' : 'Upload Video File'}</span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="sr-only"
                      disabled={uploadingMediaItem}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setMediaUploadError(null);
                        setUploadingMediaItem(true);
                        try {
                          if (file.size > 420 * 1024 && auth.currentUser) {
                            const uploaded = await academyService.uploadMedia(
                              file,
                              'VIDEO',
                              currentUser?.id || auth.currentUser.uid
                            );
                            if (uploaded?.url) {
                              setFrontPageForm((prev) => ({ ...prev, featuredVideoUrl: uploaded.url }));
                              return;
                            }
                          }
                          const dataUrl = await readSmallVideoFileAsDataUrl(file);
                          setFrontPageForm((prev) => ({ ...prev, featuredVideoUrl: dataUrl }));
                        } catch (err: any) {
                          setMediaUploadError(err?.message || 'Unable to load video file.');
                        } finally {
                          setUploadingMediaItem(false);
                        }
                      }}
                    />
                  </label>

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-semibold text-slate-200 cursor-pointer transition-colors">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload Video Thumbnail</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="sr-only"
                      disabled={uploadingMediaItem}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setMediaUploadError(null);
                        try {
                          const dataUrl = await processPosterUploadFile(file);
                          setFrontPageForm((prev) => ({ ...prev, featuredVideoPosterUrl: dataUrl }));
                        } catch (err: any) {
                          setMediaUploadError(err?.message || 'Unable to process thumbnail.');
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Live Video Preview */}
              <div className="lg:col-span-5">
                <div className="aspect-video rounded-lg border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center">
                  {(() => {
                    const parsedVideo = parseFrontPageVideoUrl(frontPageForm.featuredVideoUrl);
                    if (!parsedVideo) {
                      return (
                        <div className="text-center p-4 space-y-1.5">
                          <Film className="w-7 h-7 text-slate-600 mx-auto" />
                          <p className="text-xs text-slate-400 font-medium">No featured video linked yet</p>
                          <p className="text-[11px] text-slate-600">Paste a YouTube / Vimeo link or upload a clip</p>
                        </div>
                      );
                    }
                    if (parsedVideo.kind === 'youtube' || parsedVideo.kind === 'vimeo') {
                      return (
                        <iframe
                          src={parsedVideo.src}
                          title={frontPageForm.featuredVideoTitle || 'Featured Academy Video'}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      );
                    }
                    return (
                      <video
                        src={parsedVideo.src}
                        poster={frontPageForm.featuredVideoPosterUrl || undefined}
                        controls
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Posters Grid Editor */}
            {(frontPageForm.posters || []).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(frontPageForm.posters || []).map((poster, idx) => (
                  <div key={poster.id || idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                        Poster #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePosterItem(idx)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>

                    <div className="aspect-[4/3] rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
                      {poster.imageUrl ? (
                        <img
                          src={poster.imageUrl}
                          alt={poster.title || `Poster ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-4 space-y-1">
                          <ImageIcon className="w-6 h-6 text-slate-600 mx-auto" />
                          <p className="text-[11px] text-slate-500">Upload image or paste URL below</p>
                        </div>
                      )}
                    </div>

                    <label className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-semibold text-slate-200 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Poster Image</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="sr-only"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          setMediaUploadError(null);
                          try {
                            const dataUrl = await processPosterUploadFile(file);
                            updatePosterItem(idx, { imageUrl: dataUrl });
                          } catch (err: any) {
                            setMediaUploadError(err?.message || 'Unable to process poster image.');
                          }
                        }}
                      />
                    </label>

                    <input
                      type="text"
                      placeholder="Or paste poster image URL"
                      maxLength={250000}
                      value={poster.imageUrl}
                      onChange={(e) => updatePosterItem(idx, { imageUrl: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                    />

                    <input
                      type="text"
                      placeholder="Poster Headline"
                      maxLength={140}
                      value={poster.title}
                      onChange={(e) => updatePosterItem(idx, { title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-semibold"
                    />

                    <textarea
                      rows={2}
                      placeholder="Short caption or event date..."
                      maxLength={300}
                      value={poster.caption}
                      onChange={(e) => updatePosterItem(idx, { caption: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Button text (optional)"
                        maxLength={40}
                        value={poster.ctaLabel || ''}
                        onChange={(e) => updatePosterItem(idx, { ctaLabel: e.target.value })}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-300"
                      />
                      <input
                        type="text"
                        placeholder="#admissions or URL"
                        maxLength={300}
                        value={poster.ctaUrl || ''}
                        onChange={(e) => updatePosterItem(idx, { ctaUrl: e.target.value })}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-950/60 border border-dashed border-slate-800 rounded-lg space-y-2">
                <p className="text-xs text-slate-400">No promotional posters added yet.</p>
                <button
                  type="button"
                  onClick={addPosterItem}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add First Poster
                </button>
              </div>
            )}
          </div>

          {/* 3. Section Headings (Programs, Reviews, Blog, Admissions) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              3. Section Headings & Intros
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Programs */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Programs Section</p>
                <input
                  type="text"
                  placeholder="Eyebrow"
                  maxLength={120}
                  value={frontPageForm.programsEyebrow}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, programsEyebrow: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-amber-300"
                />
                <input
                  type="text"
                  placeholder="Title"
                  maxLength={200}
                  value={frontPageForm.programsTitle}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, programsTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white font-serif"
                />
                <textarea
                  rows={2}
                  placeholder="Subtitle"
                  maxLength={600}
                  value={frontPageForm.programsSubtitle}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, programsSubtitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
                />
              </div>

              {/* Reviews */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Reviews Section</p>
                <input
                  type="text"
                  placeholder="Eyebrow"
                  maxLength={120}
                  value={frontPageForm.reviewsEyebrow}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, reviewsEyebrow: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-amber-300"
                />
                <input
                  type="text"
                  placeholder="Title"
                  maxLength={200}
                  value={frontPageForm.reviewsTitle}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, reviewsTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white font-serif"
                />
                <textarea
                  rows={2}
                  placeholder="Subtitle"
                  maxLength={600}
                  value={frontPageForm.reviewsSubtitle}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, reviewsSubtitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
                />
              </div>

              {/* Blog */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Blog & Insights Section</p>
                <input
                  type="text"
                  placeholder="Eyebrow"
                  maxLength={120}
                  value={frontPageForm.blogEyebrow}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, blogEyebrow: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-amber-300"
                />
                <input
                  type="text"
                  placeholder="Title"
                  maxLength={200}
                  value={frontPageForm.blogTitle}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, blogTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white font-serif"
                />
                <textarea
                  rows={2}
                  placeholder="Subtitle"
                  maxLength={600}
                  value={frontPageForm.blogSubtitle}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, blogSubtitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
                />
              </div>

              {/* Admissions */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Online Admissions Section</p>
                <input
                  type="text"
                  placeholder="Eyebrow"
                  maxLength={120}
                  value={frontPageForm.admissionsEyebrow}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, admissionsEyebrow: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-amber-300"
                />
                <input
                  type="text"
                  placeholder="Title"
                  maxLength={200}
                  value={frontPageForm.admissionsTitle}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, admissionsTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white font-serif"
                />
                <textarea
                  rows={2}
                  placeholder="Subtitle"
                  maxLength={600}
                  value={frontPageForm.admissionsSubtitle}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, admissionsSubtitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* 4. Philosophy & Featured Testimonial */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
                4. Philosophy & Key Pillars
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Philosophy Eyebrow</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={frontPageForm.philosophyEyebrow}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, philosophyEyebrow: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-amber-300"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Philosophy Title</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={frontPageForm.philosophyTitle}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, philosophyTitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white font-serif"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Philosophy Narrative</label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={frontPageForm.philosophyDescription}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, philosophyDescription: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {frontPageForm.philosophyPillars.map((pillar, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Pillar #{idx + 1}</span>
                    <input
                      type="text"
                      value={pillar.title}
                      onChange={(e) => updatePillar(idx, 'title', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 font-semibold"
                    />
                    <input
                      type="text"
                      value={pillar.description}
                      onChange={(e) => updatePillar(idx, 'description', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-400"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <MessageSquareQuote className="w-4 h-4 text-amber-400" />
                5. Featured Alumni Testimonial & Footer
              </h3>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Testimonial Quote</label>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={frontPageForm.testimonialQuote}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, testimonialQuote: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-serif italic"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Author Name</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={frontPageForm.testimonialAuthor}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, testimonialAuthor: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Author Role / Cohort</label>
                  <input
                    type="text"
                    maxLength={150}
                    value={frontPageForm.testimonialRole}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, testimonialRole: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Author Avatar URL</label>
                <input
                  type="url"
                  maxLength={1024}
                  value={frontPageForm.testimonialAvatarUrl}
                  onChange={(e) => setFrontPageForm({ ...frontPageForm, testimonialAvatarUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-400 font-mono"
                />
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Footer & Contact Info</p>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Footer Brand Title</label>
                  <input
                    type="text"
                    maxLength={160}
                    value={frontPageForm.footerBrandTitle}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, footerBrandTitle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-serif"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Footer Brand Summary</label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={frontPageForm.footerDescription}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, footerDescription: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Public Contact Email</label>
                    <input
                      type="email"
                      maxLength={200}
                      value={frontPageForm.contactEmail}
                      onChange={(e) => setFrontPageForm({ ...frontPageForm, contactEmail: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Public Contact Phone</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={frontPageForm.contactPhone}
                      onChange={(e) => setFrontPageForm({ ...frontPageForm, contactPhone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Campus Location</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={frontPageForm.contactLocation}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, contactLocation: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase font-bold">Copyright Footer Text</label>
                  <input
                    type="text"
                    maxLength={300}
                    value={frontPageForm.copyrightText}
                    onChange={(e) => setFrontPageForm({ ...frontPageForm, copyrightText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>
          </fieldset>
        </form>
      )}

      {/* TAB 2: ACADEMY SETTINGS & RESET */}
      {activeTab === 'academy' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Settings className="w-4 h-4 text-amber-500" />
                  Syllabus &amp; Academy Rules
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                    isAcademyConfigEditable
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {isAcademyConfigEditable ? 'Edit Mode: ON' : 'Edit Mode: OFF'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {saved && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                    <Check className="w-4 h-4" /> Config Saved
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleToggleAcademyConfigEditMode}
                  className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border transition-colors ${
                    isAcademyConfigEditable
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-200 hover:bg-rose-500/25'
                      : 'bg-emerald-500 border-emerald-400 text-black hover:bg-emerald-400'
                  }`}
                >
                  {isAcademyConfigEditable ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Turn Off Edit Mode
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Turn On Edit Mode
                    </>
                  )}
                </button>
              </div>
            </div>

            {!isAcademyConfigEditable && (
              <div className="p-3 rounded-lg border bg-rose-500/10 border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-rose-400" />
                <span>
                  Academy Configuration Edit Mode is <strong>OFF</strong>. Click &ldquo;Turn On Edit Mode&rdquo; to update institution or UPI settings.
                </span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <fieldset
                disabled={!isAcademyConfigEditable}
                className={!isAcademyConfigEditable ? 'space-y-4 opacity-60 pointer-events-none select-none' : 'space-y-4'}
              >
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
                <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Support WhatsApp Number</span>
                </label>
                <input
                  type="text"
                  value={form.adminWhatsAppPhone || form.phone || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      adminWhatsAppPhone: e.target.value,
                    })
                  }
                  placeholder="+91 94460 55555"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono"
                />
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

              <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    Verified Academy UPI Fee Collection Account
                  </span>
                  <span className="text-[9px] font-mono text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded">
                    GPay / UPI Ready
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Academy UPI ID (VPA)</label>
                    <input
                      type="text"
                      required
                      value={form.upiId || 'swanayamedia@okaxis'}
                      onChange={(e) => setForm({ ...form, upiId: e.target.value.trim() })}
                      placeholder="swanayamedia@okaxis"
                      className="w-full bg-slate-950 border border-emerald-500/30 rounded px-3 py-2 text-xs text-emerald-300 font-mono focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase font-bold">Verified Payee Name</label>
                    <input
                      type="text"
                      required
                      value={form.upiPayeeName || 'Swanaya Media Academy'}
                      onChange={(e) => setForm({ ...form, upiPayeeName: e.target.value })}
                      placeholder="Swanaya Media Academy"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 font-mono">
                  Only this academy-owned UPI account is used for student Google Pay &amp; UPI QR fee payments. No UPI PINs are ever collected.
                </p>
              </div>

              </fieldset>

              <button
                type="submit"
                disabled={!isAcademyConfigEditable}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase rounded cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Commit Configurations
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-6">
            {/* Danger zone local storage wipe */}
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <Database className="w-4 h-4 text-rose-400" />
                Administrative Storage Reset
              </h4>
              <p className="text-xs text-slate-400 leading-normal">
                Clear all HTML5 localStorage entries and re-bootstrap default database seeds for this browser session.
              </p>

              {!confirmDbReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmDbReset(true)}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold uppercase rounded cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Wipe & Reset Local DB
                </button>
              ) : (
                <div className="p-3 bg-slate-950 border border-rose-500/40 rounded-lg space-y-2.5">
                  <p className="text-xs text-rose-300 font-semibold">
                    Confirm resetting local browser data? Unsynced local changes will be cleared.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetDatabase}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold uppercase rounded cursor-pointer"
                    >
                      Yes, Reset Local DB
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDbReset(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPERATIONAL SECURITY AUDITS */}
      {activeTab === 'audits' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Operational Security Audits
            </h3>
            <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded">
              SSL SECURE CHANNEL
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-950 text-slate-500 text-[10px] font-mono border-b border-slate-800 uppercase font-bold tracking-wider grid grid-cols-12">
              <span className="col-span-3">Timestamp / IP</span>
              <span className="col-span-3">User Operator</span>
              <span className="col-span-3">Operational Action</span>
              <span className="col-span-3">Target Entity</span>
            </div>

            <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-slate-950/20 transition-colors grid grid-cols-12 text-[10px] font-mono leading-normal text-slate-400 items-start"
                  >
                    <div className="col-span-3 space-y-0.5">
                      <p className="text-slate-300">{log.timestamp}</p>
                      <span className="text-[8px] text-slate-600 block">{log.ipAddress}</span>
                    </div>
                    <div className="col-span-3">
                      <p className="text-slate-200 font-bold">{log.userName}</p>
                      <span className="text-[8px] text-slate-500 block truncate">{log.userEmail}</span>
                    </div>
                    <div className="col-span-3 text-amber-500 font-bold">{log.action}</div>
                    <div className="col-span-3 text-slate-300 truncate font-sans">{log.entity}</div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  No audit events recorded yet in this session.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
