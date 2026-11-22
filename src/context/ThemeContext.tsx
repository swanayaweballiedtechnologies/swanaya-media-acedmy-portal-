/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AcademyThemeConfig,
  DEFAULT_ACADEMY_THEME_CONFIG,
  ThemeMode,
  ThemeSectionKey,
  adjustHexLuminance,
  hexToRgba,
  mergeThemeConfig,
  resolveEffectivePalette,
} from '../types/theme';

export type SmaTheme = ThemeMode;

interface ThemeContextValue {
  theme: SmaTheme;
  setTheme: (next: SmaTheme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  themeConfig: AcademyThemeConfig;
  savedThemeConfig: AcademyThemeConfig;
  activeSection: ThemeSectionKey;
  setActiveSection: (section: ThemeSectionKey) => void;
  previewThemeConfig: (draft: AcademyThemeConfig | null) => void;
  saveThemeConfig: (next: AcademyThemeConfig, actor?: { name?: string; email?: string; role?: string }) => Promise<AcademyThemeConfig>;
  resetThemeConfig: (actor?: { name?: string; email?: string; role?: string }) => Promise<AcademyThemeConfig>;
  refreshThemeFromServer: () => Promise<void>;
  themeSaving: boolean;
}

const MODE_STORAGE_KEY = 'sma_theme';
const CONFIG_STORAGE_KEY = 'sma_theme_config_v1';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function loadCachedThemeConfig(): AcademyThemeConfig {
  if (typeof window === 'undefined') return DEFAULT_ACADEMY_THEME_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_ACADEMY_THEME_CONFIG;
    return mergeThemeConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_ACADEMY_THEME_CONFIG;
  }
}

function detectInitialMode(config: AcademyThemeConfig): SmaTheme {
  if (typeof window === 'undefined') return config.defaultMode || 'light';
  try {
    const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (config.defaultMode === 'light' || config.defaultMode === 'dark') {
      return config.defaultMode;
    }
    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyThemeAndPaletteToDocument(
  mode: SmaTheme,
  config: AcademyThemeConfig,
  section: ThemeSectionKey
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const effective = resolveEffectivePalette(config, section);
  const overrideMode =
    section !== 'global' && config.sectionOverrides?.[section]?.enabled
      ? config.sectionOverrides[section].mode
      : undefined;
  const activeMode = overrideMode || mode;

  if (activeMode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.dataset.theme = activeMode;
  root.dataset.themeSection = section;

  const s = root.style;
  s.setProperty('--sma-primary', effective.primary);
  s.setProperty('--sma-primary-hover', adjustHexLuminance(effective.primary, -18));
  s.setProperty('--sma-primary-soft', hexToRgba(effective.primary, activeMode === 'dark' ? 0.18 : 0.12));

  s.setProperty('--sma-secondary', effective.secondary);
  s.setProperty('--sma-secondary-hover', adjustHexLuminance(effective.secondary, -14));
  s.setProperty('--sma-secondary-soft', hexToRgba(effective.secondary, activeMode === 'dark' ? 0.2 : 0.12));

  s.setProperty('--sma-accent', effective.accent);
  s.setProperty('--sma-accent-hover', adjustHexLuminance(effective.accent, -16));
  s.setProperty('--sma-accent-soft', hexToRgba(effective.accent, activeMode === 'dark' ? 0.2 : 0.12));

  s.setProperty('--sma-bg', effective.background);
  s.setProperty('--sma-surface', effective.surface);
  s.setProperty('--sma-text-primary', effective.textPrimary);
  s.setProperty('--sma-text-secondary', effective.textSecondary);
  s.setProperty('--sma-border', effective.border);

  s.setProperty('--sma-dark-bg', effective.darkBackground);
  s.setProperty('--sma-dark-surface', effective.darkSurface);
  s.setProperty('--sma-dark-text-primary', effective.darkTextPrimary);
  s.setProperty('--sma-dark-text-secondary', effective.darkTextSecondary);
  s.setProperty('--sma-dark-border', effective.darkBorder);

  if (activeMode === 'dark') {
    s.setProperty('--sma-active-bg', effective.darkBackground);
    s.setProperty('--sma-active-surface', effective.darkSurface);
    s.setProperty('--sma-active-surface-alt', adjustHexLuminance(effective.darkSurface, -8));
    s.setProperty('--sma-active-text', effective.darkTextPrimary);
    s.setProperty('--sma-active-text-muted', effective.darkTextSecondary);
    s.setProperty('--sma-active-border', effective.darkBorder);
  } else {
    s.setProperty('--sma-active-bg', effective.background);
    s.setProperty('--sma-active-surface', effective.surface);
    s.setProperty('--sma-active-surface-alt', adjustHexLuminance(effective.background, -6));
    s.setProperty('--sma-active-text', effective.textPrimary);
    s.setProperty('--sma-active-text-muted', effective.textSecondary);
    s.setProperty('--sma-active-border', effective.border);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [savedConfig, setSavedConfig] = useState<AcademyThemeConfig>(() => loadCachedThemeConfig());
  const [draftPreview, setDraftPreview] = useState<AcademyThemeConfig | null>(null);
  const [activeSection, setActiveSection] = useState<ThemeSectionKey>('global');
  const [theme, setThemeState] = useState<SmaTheme>(() => detectInitialMode(loadCachedThemeConfig()));
  const [themeSaving, setThemeSaving] = useState(false);

  const effectiveConfig = draftPreview || savedConfig;

  const refreshThemeFromServer = useCallback(async () => {
    try {
      const res = await fetch('/api/theme-settings', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const rawCfg = data?.config || data?.settings;
      if (rawCfg) {
        const merged = mergeThemeConfig(rawCfg);
        setSavedConfig((prev) => (JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged));
        try {
          window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
          const userModePref = window.localStorage.getItem(MODE_STORAGE_KEY);
          if (!userModePref && (merged.defaultMode === 'light' || merged.defaultMode === 'dark')) {
            setThemeState(merged.defaultMode);
          }
        } catch {
          // ignore localStorage errors
        }
      }
    } catch {
      // keep cached config when offline
    }
  }, []);

  useEffect(() => {
    void refreshThemeFromServer();
  }, [refreshThemeFromServer]);

  useEffect(() => {
    applyThemeAndPaletteToDocument(theme, effectiveConfig, activeSection);
  }, [theme, effectiveConfig, activeSection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === CONFIG_STORAGE_KEY && ev.newValue) {
        try {
          setSavedConfig(mergeThemeConfig(JSON.parse(ev.newValue)));
        } catch {
          // ignore malformed JSON
        }
      }
      if (ev.key === MODE_STORAGE_KEY && (ev.newValue === 'light' || ev.newValue === 'dark')) {
        setThemeState(ev.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = useCallback((next: SmaTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // ignore storage write errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const previewThemeConfig = useCallback((draft: AcademyThemeConfig | null) => {
    if (!draft) {
      setDraftPreview((prev) => (prev === null ? prev : null));
      return;
    }
    const merged = mergeThemeConfig(draft);
    const nextSerialized = JSON.stringify(merged);
    setDraftPreview((prev) => (prev && JSON.stringify(prev) === nextSerialized ? prev : merged));
  }, []);

  const saveThemeConfig = useCallback(
    async (
      next: AcademyThemeConfig,
      actor?: { name?: string; email?: string; role?: string }
    ): Promise<AcademyThemeConfig> => {
      setThemeSaving(true);
      try {
        const normalized = mergeThemeConfig({
          ...next,
          updatedAt: new Date().toISOString(),
          updatedBy: actor?.name || actor?.email || 'Administrator',
        });

        const res = await fetch('/api/theme-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            config: normalized,
            settings: normalized,
            actorRole: actor?.role,
            actorName: actor?.name,
            actorEmail: actor?.email,
          }),
        });

        let persisted = normalized;
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const rawSaved = data?.config || data?.settings;
          if (rawSaved) {
            persisted = mergeThemeConfig(rawSaved);
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Unable to save global theme settings.');
        }

        setDraftPreview(null);
        setSavedConfig(persisted);
        setThemeState(persisted.defaultMode);
        try {
          window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(persisted));
          window.localStorage.setItem(MODE_STORAGE_KEY, persisted.defaultMode);
        } catch {
          // ignore localStorage error
        }
        return persisted;
      } finally {
        setThemeSaving(false);
      }
    },
    []
  );

  const resetThemeConfig = useCallback(
    async (actor?: { name?: string; email?: string; role?: string }): Promise<AcademyThemeConfig> => {
      setThemeSaving(true);
      try {
        const res = await fetch('/api/theme-settings/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            actorRole: actor?.role,
            actorName: actor?.name,
            actorEmail: actor?.email,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Unable to reset global theme settings.');
        }

        const data = await res.json().catch(() => ({}));
        const resetCfg = mergeThemeConfig(data?.config || data?.settings || DEFAULT_ACADEMY_THEME_CONFIG);
        setDraftPreview(null);
        setSavedConfig(resetCfg);
        setThemeState(resetCfg.defaultMode);
        try {
          window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(resetCfg));
          window.localStorage.setItem(MODE_STORAGE_KEY, resetCfg.defaultMode);
        } catch {
          // ignore localStorage error
        }
        return resetCfg;
      } finally {
        setThemeSaving(false);
      }
    },
    []
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      isDark: theme === 'dark',
      themeConfig: effectiveConfig,
      savedThemeConfig: savedConfig,
      activeSection,
      setActiveSection,
      previewThemeConfig,
      saveThemeConfig,
      resetThemeConfig,
      refreshThemeFromServer,
      themeSaving,
    }),
    [
      theme,
      setTheme,
      toggleTheme,
      effectiveConfig,
      savedConfig,
      activeSection,
      previewThemeConfig,
      saveThemeConfig,
      resetThemeConfig,
      refreshThemeFromServer,
      themeSaving,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return ctx;
}
