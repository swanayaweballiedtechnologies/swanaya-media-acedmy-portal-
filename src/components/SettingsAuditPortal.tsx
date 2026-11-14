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
  Image as ImageIcon
} from 'lucide-react';
import {
  SwanayaDatabase,
  AcademySettings,
  AuditLog,
  FrontPageConfig,
  INITIAL_FRONT_PAGE_CONFIG
} from '../db/mockDb';
import { academyService } from '../services/academyService';
import { auth } from '../firebase';
import { applyDocumentFavicon, processLogoUploadFile } from '../utils/favicon';

interface SettingsAuditPortalProps {
  currentUser: any;
  onRefreshAllData: () => void;
  initialTab?: 'front-page' | 'academy' | 'audits';
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
  };
}

export default function SettingsAuditPortal({
  currentUser,
  onRefreshAllData,
  initialTab = 'front-page',
  onPreviewLanding,
}: SettingsAuditPortalProps) {
  const [activeTab, setActiveTab] = useState<'front-page' | 'academy' | 'audits'>(initialTab);
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

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    SwanayaDatabase.set('settings', form);
    setSettings(form);

    SwanayaDatabase.log(
      currentUser?.email || 'md@swanayamedia.com',
      currentUser?.name || 'Managing Director',
      'SETTINGS_SAVED',
      'Modified Academy Configuration'
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

      {/* TAB 1: FRONT PAGE EDITOR */}
      {activeTab === 'front-page' && (
        <form onSubmit={handleSaveFrontPage} className="space-y-6">
          {/* Sticky Action Strip */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                <Layout className="w-4 h-4 text-amber-400" />
                Live Public Website Copy & Layout Controls
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                Last updated: {String(frontPageForm.updatedAt || '').slice(0, 19).replace('T', ' ')} · By {frontPageForm.updatedBy || 'System Default'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!confirmFrontReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmFrontReset(true)}
                  className="px-3.5 py-2 bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-semibold uppercase tracking-wider rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
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
                disabled={savingFrontPage}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingFrontPage ? 'Publishing...' : 'Save & Publish Front Page'}
              </button>
            </div>
          </div>

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

          {/* Section Visibility Toggles */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
              Section Visibility Controls
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </form>
      )}

      {/* TAB 2: ACADEMY SETTINGS & RESET */}
      {activeTab === 'academy' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
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
                  <span>Admin WhatsApp Access Phone</span>
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
