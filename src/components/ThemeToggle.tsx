/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`inline-flex items-center gap-2 rounded-lg border border-[#E5E1EA] dark:border-[#38384B] bg-[#FFFFFF] dark:bg-[#242436] text-[#25263A] dark:text-[#F5F3FA] hover:border-[#7652A8] dark:hover:border-[#A985D6] transition-all cursor-pointer shrink-0 whitespace-nowrap shadow-xs ${
        compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-xs font-semibold'
      } ${className}`}
    >
      {isDark ? (
        <>
          <Sun className="w-4 h-4 text-[#A985D6]" aria-hidden="true" />
          <span className={compact ? 'hidden sm:inline' : ''}>Light</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-[#7652A8]" aria-hidden="true" />
          <span className={compact ? 'hidden sm:inline' : ''}>Dark</span>
        </>
      )}
    </button>
  );
}
