/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Palette,
  Save,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Layers,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  AcademyThemeConfig,
  DEFAULT_THEME_CONFIG,
  DEFAULT_THEME_PALETTE,
  OverrideSectionKey,
  getContrastRatio,
  mergeThemeConfig,
  normalizeHexColor,
} from '../types/theme';

interface AdminThemeConsoleProps {
  currentUser?: { name?: string; email?: string; role?: string } | null;
  onThemeSaved?: () => void;
}

const SECTION_LABELS: Array<{ key: OverrideSectionKey; title: string; subtitle: string }> = [
  { key: 'landing', title: 'Public Landing Page', subtitle: 'Independent homepage banner, catalogue & footer' },
  { key: 'login', title: 'Authentication Gateway', subtitle: 'Standalone /login workspace & recovery screen' },
  { key: 'student', title: 'Student Portal', subtitle: 'Student learning dashboard, course selection & charts' },
  { key: 'tutor', title: 'Tutor Portal', subtitle: 'Faculty attendance, assigned courses & grading hub' },
];

export default function AdminThemeConsole({ currentUser, onThemeSaved }: AdminThemeConsoleProps) {
  const { savedThemeConfig, previewThemeConfig, saveThemeConfig, resetThemeConfig, isDark } = useTheme();

  const [draft, setDraft] = useState<AcademyThemeConfig>(() => mergeThemeConfig(savedThemeConfig));
  const [livePreviewInApp, setLivePreviewInApp] = useState<boolean>(true);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>(() => (isDark ? 'dark' : 'light'));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [activeOverrideTab, setActiveOverrideTab] = useState<OverrideSectionKey>('landing');

  useEffect(() => {
    const mergedSaved = mergeThemeConfig(savedThemeConfig);
    const nextStr = JSON.stringify(mergedSaved);
    setDraft((prev) => (JSON.stringify(prev) === nextStr ? prev : mergedSaved));
  }, [savedThemeConfig]);

  useEffect(() => {
    if (livePreviewInApp) {
      previewThemeConfig(draft);
    } else {
      previewThemeConfig(null);
    }
  }, [draft, livePreviewInApp, previewThemeConfig]);

  // Clear temporary draft preview on unmount without triggering feedback loop
  useEffect(() => {
    return () => {
      previewThemeConfig(null);
    };
  }, [previewThemeConfig]);

  const updatePaletteField = (key: keyof typeof DEFAULT_THEME_PALETTE, rawValue: string) => {
    const clean = rawValue.startsWith('#') ? rawValue : `#${rawValue}`;
    setDraft((prev) => ({
      ...prev,
      palette: {
        ...prev.palette,
        [key]: clean.length === 7 ? normalizeHexColor(clean, prev.palette[key]) : (clean as any),
      },
    }));
  };

  const commitPaletteBlur = (key: keyof typeof DEFAULT_THEME_PALETTE) => {
    setDraft((prev) => ({
      ...prev,
      palette: {
        ...prev.palette,
        [key]: normalizeHexColor(prev.palette[key], DEFAULT_THEME_PALETTE[key]),
      },
    }));
  };

  const contrastStats = useMemo(() => {
    const lightTextContrast = getContrastRatio(draft.palette.textPrimary, draft.palette.surface);
    const primaryOnLight = getContrastRatio('#FFFFFF', draft.palette.primary);
    const accentOnLight = getContrastRatio('#FFFFFF', draft.palette.accent);
    const darkSurfaceContrast = getContrastRatio('#F5F4FA', draft.palette.darkSurface);
    return {
      lightTextContrast,
      primaryOnLight,
      accentOnLight,
      darkSurfaceContrast,
    };
  }, [draft.palette]);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const normalized = mergeThemeConfig({
        ...draft,
        updatedBy: currentUser?.email || currentUser?.name || 'Administrator',
      });
      await saveThemeConfig(normalized);
      setDraft(normalized);
      setNotice({
        type: 'success',
        text: 'Global colour theme saved and applied to Public Landing, Login, Student Portal, and Tutor Portal.',
      });
      onThemeSaved?.();
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: err?.message || 'Unable to save theme settings. Ensure you are signed in with Administrator authorization.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setNotice(null);
    try {
      const resetRes = await resetThemeConfig();
      setDraft(mergeThemeConfig(resetRes));
      setNotice({
        type: 'info',
        text: 'Academy colours reset to canonical Royal Purple (#6941C6), Midnight Blue (#243B70), and Emerald Green (#269B78).',
      });
      onThemeSaved?.();
    } catch {
      const localReset = mergeThemeConfig(DEFAULT_THEME_CONFIG);
      setDraft(localReset);
      previewThemeConfig(localReset);
      setNotice({
        type: 'info',
        text: 'Preview reset to default Royal Purple (#6941C6) system palette. Click Save Theme to persist server-side.',
      });
    } finally {
      setResetting(false);
    }
  };

  const currentSectionOverride = draft.sectionOverrides?.[activeOverrideTab] || { enabled: false };

  const updateSectionOverride = (patch: Record<string, any>) => {
    setDraft((prev) => ({
      ...prev,
      sectionOverrides: {
        ...prev.sectionOverrides,
        [activeOverrideTab]: {
          ...prev.sectionOverrides?.[activeOverrideTab],
          ...patch,
        },
      },
    }));
  };

  const previewBg = previewMode === 'dark' ? draft.palette.darkBackground : draft.palette.background;
  const previewSurface = previewMode === 'dark' ? draft.palette.darkSurface : draft.palette.surface;
  const previewText = previewMode === 'dark' ? '#F5F4FA' : draft.palette.textPrimary;
  const previewMuted = previewMode === 'dark' ? '#B9B8CE' : draft.palette.textSecondary;
  const previewBorder = previewMode === 'dark' ? '#323254' : draft.palette.border;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div
        className="rounded-2xl border p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        style={{
          backgroundColor: 'var(--sma-active-surface)',
          borderColor: 'var(--sma-active-border)',
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--sma-primary)' }}>
            <Palette className="w-4 h-4" />
            <span>Global UI Colour &amp; Theme Governance</span>
          </div>
          <h2 className="text-xl font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
            Swanaya Brand &amp; Theme Management Console
          </h2>
          <p className="text-xs max-w-2xl" style={{ color: 'var(--sma-active-text-muted)' }}>
            Edit global colours once and propagate changes live across Public Landing (/), Login (/login), Student Portal (/student), and Tutor Portal (/tutor).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <label
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer select-none whitespace-nowrap"
            style={{
              backgroundColor: 'var(--sma-active-bg)',
              borderColor: 'var(--sma-active-border)',
              color: 'var(--sma-active-text)',
            }}
          >
            <input
              type="checkbox"
              checked={livePreviewInApp}
              onChange={(e) => {
                const enabled = e.target.checked;
                setLivePreviewInApp(enabled);
                if (!enabled) previewThemeConfig(null);
                else previewThemeConfig(draft);
              }}
              className="w-3.5 h-3.5 accent-[#6941C6]"
            />
            <span>Live Workspace Preview</span>
          </label>

          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--sma-active-bg)',
              borderColor: 'var(--sma-active-border)',
              color: 'var(--sma-active-text)',
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{resetting ? 'Resetting...' : 'Reset to Default'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || resetting}
            className="px-5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-90 shadow-sm whitespace-nowrap shrink-0 disabled:opacity-50"
            style={{ backgroundColor: 'var(--sma-primary)' }}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Theme...' : 'Save Theme'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-4 text-xs flex items-center justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : notice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-[11px] font-semibold underline cursor-pointer shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Editor + Live Preview Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Colour Pickers & Mode Settings */}
        <div className="xl:col-span-7 space-y-6">
          {/* Default Display Mode */}
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{
              backgroundColor: 'var(--sma-active-surface)',
              borderColor: 'var(--sma-active-border)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4" style={{ color: 'var(--sma-primary)' }} />
                <h3 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                  Light / Dark Mode Configuration
                </h3>
              </div>
              <span className="text-[11px] font-mono" style={{ color: 'var(--sma-active-text-muted)' }}>
                Default Appearance Policy
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'light' as const, label: 'Light Mode', icon: Sun, desc: 'Off-White #F7F7FA' },
                { id: 'dark' as const, label: 'Dark Mode', icon: Moon, desc: 'Deep Obsidian #151525' },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = draft.defaultMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, defaultMode: opt.id }))}
                    className="p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1"
                    style={{
                      backgroundColor: active ? 'var(--sma-role-accent-soft)' : 'var(--sma-active-bg)',
                      borderColor: active ? 'var(--sma-primary)' : 'var(--sma-active-border)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color: active ? 'var(--sma-primary)' : 'var(--sma-active-text-muted)' }} />
                      <span className="text-xs font-bold" style={{ color: 'var(--sma-active-text)' }}>
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--sma-active-text-muted)' }}>
                      {opt.desc}
                    </p>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, allowUserModeToggle: !prev.allowUserModeToggle }))}
                className="p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1"
                style={{
                  backgroundColor: draft.allowUserModeToggle ? 'var(--sma-role-accent-soft)' : 'var(--sma-active-bg)',
                  borderColor: draft.allowUserModeToggle ? 'var(--sma-accent)' : 'var(--sma-active-border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4" style={{ color: draft.allowUserModeToggle ? 'var(--sma-accent)' : 'var(--sma-active-text-muted)' }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--sma-active-text)' }}>
                    {draft.allowUserModeToggle ? 'User Toggle Enabled' : 'Default Locked'}
                  </span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--sma-active-text-muted)' }}>
                  Allow learners &amp; tutors to switch light/dark
                </p>
              </button>
            </div>
          </div>

          {/* Core Brand & Surface Swatches */}
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{
              backgroundColor: 'var(--sma-active-surface)',
              borderColor: 'var(--sma-active-border)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
              <h3 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                Global Colour Palette Tokens
              </h3>
              <span className="text-[11px] font-mono" style={{ color: 'var(--sma-active-text-muted)' }}>
                Editable Hex Tokens
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  { key: 'primary', label: 'Primary (Royal Purple)', hint: 'Buttons, focus rings & active tabs' },
                  { key: 'secondary', label: 'Secondary (Midnight Blue)', hint: 'Academic authority headers & badges' },
                  { key: 'accent', label: 'Accent (Emerald Green)', hint: 'Verified actions, success & charts' },
                  { key: 'background', label: 'Light Background', hint: 'Main page canvas in light mode' },
                  { key: 'surface', label: 'Light Surface', hint: 'Cards, modals & navigation bars' },
                  { key: 'textPrimary', label: 'Text Primary', hint: 'Headlines & primary body copy' },
                  { key: 'textSecondary', label: 'Text Secondary', hint: 'Captions, labels & muted hints' },
                  { key: 'border', label: 'Border Token', hint: 'Dividers, table grids & inputs' },
                  { key: 'darkBackground', label: 'Dark Mode Background', hint: 'Main page canvas in dark mode' },
                  { key: 'darkSurface', label: 'Dark Mode Surface', hint: 'Cards & panels in dark mode' },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className="p-3 rounded-xl border flex items-center justify-between gap-3"
                  style={{
                    backgroundColor: 'var(--sma-active-bg)',
                    borderColor: 'var(--sma-active-border)',
                  }}
                >
                  <div className="min-w-0 space-y-0.5">
                    <label className="text-xs font-bold block truncate" style={{ color: 'var(--sma-active-text)' }}>
                      {item.label}
                    </label>
                    <p className="text-[11px] truncate" style={{ color: 'var(--sma-active-text-muted)' }}>
                      {item.hint}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="color"
                      aria-label={item.label}
                      value={normalizeHexColor(draft.palette[item.key], DEFAULT_THEME_PALETTE[item.key])}
                      onChange={(e) => updatePaletteField(item.key, e.target.value)}
                      className="w-9 h-9 rounded-lg border cursor-pointer bg-transparent p-0.5"
                      style={{ borderColor: 'var(--sma-active-border)' }}
                    />
                    <input
                      type="text"
                      value={draft.palette[item.key]}
                      onChange={(e) => updatePaletteField(item.key, e.target.value)}
                      onBlur={() => commitPaletteBlur(item.key)}
                      maxLength={7}
                      className="w-20 px-2 py-1.5 rounded-lg border text-xs font-mono uppercase focus:outline-none"
                      style={{
                        backgroundColor: 'var(--sma-active-surface)',
                        borderColor: 'var(--sma-active-border)',
                        color: 'var(--sma-active-text)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* WCAG Contrast Health Readout */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t" style={{ borderColor: 'var(--sma-active-border)' }}>
              {[
                { label: 'Body Text Ratio', ratio: contrastStats.lightTextContrast, target: 4.5 },
                { label: 'Primary Button', ratio: contrastStats.primaryOnLight, target: 4.5 },
                { label: 'Accent Contrast', ratio: contrastStats.accentOnLight, target: 3.0 },
                { label: 'Dark Surface Ratio', ratio: contrastStats.darkSurfaceContrast, target: 4.5 },
              ].map((stat) => {
                const passes = stat.ratio >= stat.target;
                return (
                  <div
                    key={stat.label}
                    className="p-2.5 rounded-xl border text-xs"
                    style={{
                      backgroundColor: 'var(--sma-active-bg)',
                      borderColor: 'var(--sma-active-border)',
                    }}
                  >
                    <span className="text-[10px] font-mono block" style={{ color: 'var(--sma-active-text-muted)' }}>
                      {stat.label}
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--sma-active-text)' }}>
                        {stat.ratio.toFixed(1)}:1
                      </span>
                      <span className={`text-[10px] font-mono font-bold ${passes ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {passes ? 'AA OK' : 'LOW'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section-Specific Overrides (Optional per-section customization) */}
          <div
            className="rounded-2xl border p-5 space-y-4"
            style={{
              backgroundColor: 'var(--sma-active-surface)',
              borderColor: 'var(--sma-active-border)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: 'var(--sma-secondary)' }} />
                <h3 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                  Section-Specific Overrides (Optional)
                </h3>
              </div>
              <span className="text-[11px] font-mono" style={{ color: 'var(--sma-active-text-muted)' }}>
                Landing · Login · Student · Tutor
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SECTION_LABELS.map((sec) => {
                const isSelected = activeOverrideTab === sec.key;
                const isEnabled = Boolean(draft.sectionOverrides?.[sec.key]?.enabled);
                return (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => setActiveOverrideTab(sec.key)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                    style={{
                      backgroundColor: isSelected ? 'var(--sma-primary)' : 'var(--sma-active-bg)',
                      borderColor: isSelected ? 'var(--sma-primary)' : 'var(--sma-active-border)',
                      color: isSelected ? '#FFFFFF' : 'var(--sma-active-text)',
                    }}
                  >
                    <span>{sec.title}</span>
                    {isEnabled && <span className="text-[10px] font-mono opacity-85">· Custom</span>}
                  </button>
                );
              })}
            </div>

            <div
              className="p-4 rounded-xl border space-y-3"
              style={{
                backgroundColor: 'var(--sma-active-bg)',
                borderColor: 'var(--sma-active-border)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--sma-active-text)' }}>
                    {SECTION_LABELS.find((s) => s.key === activeOverrideTab)?.title}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--sma-active-text-muted)' }}>
                    {SECTION_LABELS.find((s) => s.key === activeOverrideTab)?.subtitle}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer shrink-0" style={{ color: 'var(--sma-active-text)' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(currentSectionOverride.enabled)}
                    onChange={(e) => updateSectionOverride({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-[#6941C6]"
                  />
                  <span>Enable Override</span>
                </label>
              </div>

              {currentSectionOverride.enabled ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {(
                    [
                      { key: 'primary', label: 'Primary Accent' },
                      { key: 'secondary', label: 'Secondary Tone' },
                      { key: 'accent', label: 'Highlight Accent' },
                    ] as const
                  ).map((ovField) => {
                    const currentVal = (currentSectionOverride as any)[ovField.key] || draft.palette[ovField.key];
                    return (
                      <div
                        key={ovField.key}
                        className="p-2.5 rounded-lg border flex items-center justify-between gap-2"
                        style={{
                          backgroundColor: 'var(--sma-active-surface)',
                          borderColor: 'var(--sma-active-border)',
                        }}
                      >
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--sma-active-text)' }}>
                          {ovField.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={normalizeHexColor(currentVal, draft.palette[ovField.key])}
                            onChange={(e) => updateSectionOverride({ [ovField.key]: e.target.value })}
                            className="w-7 h-7 rounded border cursor-pointer bg-transparent p-0.5"
                            style={{ borderColor: 'var(--sma-active-border)' }}
                          />
                          <span className="text-[11px] font-mono uppercase" style={{ color: 'var(--sma-active-text-muted)' }}>
                            {currentVal}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px]" style={{ color: 'var(--sma-active-text-muted)' }}>
                  Inherits the global academy colour system automatically.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Interactive Cross-Platform Live Theme Preview */}
        <div className="xl:col-span-5 space-y-4">
          <div
            className="rounded-2xl border p-5 space-y-4 sticky top-20"
            style={{
              backgroundColor: 'var(--sma-active-surface)',
              borderColor: 'var(--sma-active-border)',
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--sma-active-border)' }}>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" style={{ color: 'var(--sma-primary)' }} />
                <h3 className="text-sm font-serif font-bold" style={{ color: 'var(--sma-active-text)' }}>
                  Live Multi-Page Theme Preview
                </h3>
              </div>
              <div className="flex items-center gap-1 p-0.5 rounded-lg border" style={{ borderColor: 'var(--sma-active-border)', backgroundColor: 'var(--sma-active-bg)' }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode('light')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer"
                  style={{
                    backgroundColor: previewMode === 'light' ? 'var(--sma-active-surface)' : 'transparent',
                    color: previewMode === 'light' ? 'var(--sma-primary)' : 'var(--sma-active-text-muted)',
                  }}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('dark')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer"
                  style={{
                    backgroundColor: previewMode === 'dark' ? 'var(--sma-active-surface)' : 'transparent',
                    color: previewMode === 'dark' ? 'var(--sma-primary)' : 'var(--sma-active-text-muted)',
                  }}
                >
                  Dark
                </button>
              </div>
            </div>

            {/* Simulated Academy Screen Card */}
            <div
              className="rounded-2xl border p-4 space-y-4 transition-colors duration-200"
              style={{
                backgroundColor: previewBg,
                borderColor: previewBorder,
                color: previewText,
              }}
            >
              {/* Simulated Navbar */}
              <div
                className="rounded-xl border px-3.5 py-2.5 flex items-center justify-between"
                style={{ backgroundColor: previewSurface, borderColor: previewBorder }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: draft.palette.secondary }}
                  >
                    SM
                  </div>
                  <span className="text-xs font-serif font-bold tracking-wider">SWANAYA ACADEMY</span>
                </div>
                <button
                  type="button"
                  className="px-3 py-1 rounded-lg text-[11px] font-bold text-white cursor-default whitespace-nowrap"
                  style={{ backgroundColor: draft.palette.primary }}
                >
                  Student Login
                </button>
              </div>

              {/* Simulated Hero */}
              <div
                className="rounded-xl border p-4 space-y-2.5"
                style={{ backgroundColor: previewSurface, borderColor: previewBorder }}
              >
                <span
                  className="text-[10px] font-mono font-bold uppercase tracking-widest block"
                  style={{ color: draft.palette.accent }}
                >
                  AI MEDIA &amp; ENGINEERING INSTITUTE
                </span>
                <h4 className="text-base font-serif font-bold leading-snug">
                  Creative Direction &amp; Full-Stack Mastery
                </h4>
                <p className="text-xs leading-relaxed" style={{ color: previewMuted }}>
                  Unified palette updating Public Landing, Login Gateway, Student &amp; Tutor Portals.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
                    style={{ backgroundColor: draft.palette.primary }}
                  >
                    Explore Courses
                  </span>
                  <span
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
                    style={{ backgroundColor: draft.palette.secondary }}
                  >
                    Register Now
                  </span>
                </div>
              </div>

              {/* Simulated Portal KPI Strip */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: 'Major Track', value: '12 Cr', color: draft.palette.primary },
                  { label: 'Minors Picked', value: '2 Max', color: draft.palette.secondary },
                  { label: 'Readiness', value: '88%', color: draft.palette.accent },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl border p-3 space-y-1"
                    style={{ backgroundColor: previewSurface, borderColor: previewBorder }}
                  >
                    <span className="text-[10px] font-mono block" style={{ color: previewMuted }}>
                      {kpi.label}
                    </span>
                    <span className="text-sm font-mono font-bold tabular-nums block" style={{ color: kpi.color }}>
                      {kpi.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-xl border p-3 text-[11px] flex items-start gap-2"
              style={{
                backgroundColor: 'var(--sma-active-bg)',
                borderColor: 'var(--sma-active-border)',
                color: 'var(--sma-active-text-muted)',
              }}
            >
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--sma-accent)' }} />
              <span>
                Only authenticated Administrators can update and persist global theme colours. Students and Tutors receive read-only synchronized theme updates automatically.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
