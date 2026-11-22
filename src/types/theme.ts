/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeMode = 'light' | 'dark';

export type ThemeSectionKey = 'global' | 'landing' | 'login' | 'student' | 'tutor';

export interface ThemePalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  darkBackground: string;
  darkSurface: string;
  darkTextPrimary: string;
  darkTextSecondary: string;
  darkBorder: string;
}

export interface SectionThemeOverride {
  enabled: boolean;
  mode?: ThemeMode;
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  textPrimary?: string;
  textSecondary?: string;
  darkBackground?: string;
  darkSurface?: string;
}

export interface AcademyThemeConfig {
  id: string;
  defaultMode: ThemeMode;
  allowUserModeToggle: boolean;
  palette: ThemePalette;
  sectionOverrides: {
    landing: SectionThemeOverride;
    login: SectionThemeOverride;
    student: SectionThemeOverride;
    tutor: SectionThemeOverride;
  };
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_THEME_PALETTE: ThemePalette = {
  primary: '#6941C6',
  secondary: '#243B70',
  accent: '#269B78',
  background: '#F7F7FA',
  surface: '#FFFFFF',
  textPrimary: '#20243A',
  textSecondary: '#74798A',
  border: '#E5E5ED',
  darkBackground: '#151525',
  darkSurface: '#202038',
  darkTextPrimary: '#F5F4FA',
  darkTextSecondary: '#B3B6CA',
  darkBorder: '#333452',
};

export type OverrideSectionKey = 'landing' | 'login' | 'student' | 'tutor';

export const DEFAULT_ACADEMY_THEME_CONFIG: AcademyThemeConfig = {
  id: 'theme_config',
  defaultMode: 'light',
  allowUserModeToggle: true,
  palette: { ...DEFAULT_THEME_PALETTE },
  sectionOverrides: {
    landing: { enabled: false },
    login: { enabled: false },
    student: { enabled: false },
    tutor: { enabled: false },
  },
  updatedAt: '2026-10-01T00:00:00.000Z',
  updatedBy: 'System Default',
};

export const DEFAULT_THEME_CONFIG = DEFAULT_ACADEMY_THEME_CONFIG;

export function normalizeHexColor(val: string | undefined, fallback: string): string {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHexColor(hex, '#6941C6').slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function adjustHexLuminance(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const nr = clamp(r + amount);
  const ng = clamp(g + amount);
  const nb = clamp(b + amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`.toUpperCase();
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const lum = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const [rs, gs, bs] = [r, g, b].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };
  const l1 = lum(hex1);
  const l2 = lum(hex2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((brighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function mergeThemeConfig(partial?: Partial<AcademyThemeConfig> | null): AcademyThemeConfig {
  const safe = partial && typeof partial === 'object' ? partial : {};
  const rawPalette = (safe.palette || {}) as Partial<ThemePalette>;
  const rawOverrides = (safe.sectionOverrides || {}) as Partial<AcademyThemeConfig['sectionOverrides']>;

  const sanitizeOverride = (ovr?: SectionThemeOverride): SectionThemeOverride => ({
    enabled: Boolean(ovr?.enabled),
    ...(ovr?.mode === 'light' || ovr?.mode === 'dark' ? { mode: ovr.mode } : {}),
    ...(ovr?.primary ? { primary: normalizeHexColor(ovr.primary, DEFAULT_THEME_PALETTE.primary) } : {}),
    ...(ovr?.secondary ? { secondary: normalizeHexColor(ovr.secondary, DEFAULT_THEME_PALETTE.secondary) } : {}),
    ...(ovr?.accent ? { accent: normalizeHexColor(ovr.accent, DEFAULT_THEME_PALETTE.accent) } : {}),
    ...(ovr?.background ? { background: normalizeHexColor(ovr.background, DEFAULT_THEME_PALETTE.background) } : {}),
    ...(ovr?.surface ? { surface: normalizeHexColor(ovr.surface, DEFAULT_THEME_PALETTE.surface) } : {}),
    ...(ovr?.textPrimary ? { textPrimary: normalizeHexColor(ovr.textPrimary, DEFAULT_THEME_PALETTE.textPrimary) } : {}),
    ...(ovr?.textSecondary ? { textSecondary: normalizeHexColor(ovr.textSecondary, DEFAULT_THEME_PALETTE.textSecondary) } : {}),
    ...(ovr?.darkBackground ? { darkBackground: normalizeHexColor(ovr.darkBackground, DEFAULT_THEME_PALETTE.darkBackground) } : {}),
    ...(ovr?.darkSurface ? { darkSurface: normalizeHexColor(ovr.darkSurface, DEFAULT_THEME_PALETTE.darkSurface) } : {}),
  });

  return {
    id: 'theme_config',
    defaultMode: safe.defaultMode === 'dark' ? 'dark' : 'light',
    allowUserModeToggle: typeof safe.allowUserModeToggle === 'boolean' ? safe.allowUserModeToggle : true,
    palette: {
      primary: normalizeHexColor(rawPalette.primary, DEFAULT_THEME_PALETTE.primary),
      secondary: normalizeHexColor(rawPalette.secondary, DEFAULT_THEME_PALETTE.secondary),
      accent: normalizeHexColor(rawPalette.accent, DEFAULT_THEME_PALETTE.accent),
      background: normalizeHexColor(rawPalette.background, DEFAULT_THEME_PALETTE.background),
      surface: normalizeHexColor(rawPalette.surface, DEFAULT_THEME_PALETTE.surface),
      textPrimary: normalizeHexColor(rawPalette.textPrimary, DEFAULT_THEME_PALETTE.textPrimary),
      textSecondary: normalizeHexColor(rawPalette.textSecondary, DEFAULT_THEME_PALETTE.textSecondary),
      border: normalizeHexColor(rawPalette.border, DEFAULT_THEME_PALETTE.border),
      darkBackground: normalizeHexColor(rawPalette.darkBackground, DEFAULT_THEME_PALETTE.darkBackground),
      darkSurface: normalizeHexColor(rawPalette.darkSurface, DEFAULT_THEME_PALETTE.darkSurface),
      darkTextPrimary: normalizeHexColor(rawPalette.darkTextPrimary, DEFAULT_THEME_PALETTE.darkTextPrimary),
      darkTextSecondary: normalizeHexColor(rawPalette.darkTextSecondary, DEFAULT_THEME_PALETTE.darkTextSecondary),
      darkBorder: normalizeHexColor(rawPalette.darkBorder, DEFAULT_THEME_PALETTE.darkBorder),
    },
    sectionOverrides: {
      landing: sanitizeOverride(rawOverrides.landing),
      login: sanitizeOverride(rawOverrides.login),
      student: sanitizeOverride(rawOverrides.student),
      tutor: sanitizeOverride(rawOverrides.tutor),
    },
    updatedAt: typeof safe.updatedAt === 'string' && safe.updatedAt ? safe.updatedAt : DEFAULT_ACADEMY_THEME_CONFIG.updatedAt,
    updatedBy: typeof safe.updatedBy === 'string' && safe.updatedBy ? safe.updatedBy : DEFAULT_ACADEMY_THEME_CONFIG.updatedBy,
  };
}

export function resolveEffectivePalette(config: AcademyThemeConfig, section: ThemeSectionKey): ThemePalette {
  const base = config.palette;
  if (section === 'global') return base;
  const ovr = config.sectionOverrides?.[section];
  if (!ovr || !ovr.enabled) return base;
  return {
    ...base,
    primary: ovr.primary || base.primary,
    secondary: ovr.secondary || base.secondary,
    accent: ovr.accent || base.accent,
    background: ovr.background || base.background,
    surface: ovr.surface || base.surface,
    textPrimary: ovr.textPrimary || base.textPrimary,
    textSecondary: ovr.textSecondary || base.textSecondary,
    darkBackground: ovr.darkBackground || base.darkBackground,
    darkSurface: ovr.darkSurface || base.darkSurface,
  };
}
