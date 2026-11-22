/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MessageCircle } from 'lucide-react';

interface FloatingSocialButtonsProps {
  whatsappNumber?: string;
  instagramUrl?: string;
  hidden?: boolean;
}

const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/swanaya_media_acedemy_for_ai/';

export default function FloatingSocialButtons({
  whatsappNumber = '+91 94460 12345',
  instagramUrl = DEFAULT_INSTAGRAM_URL,
  hidden = false,
}: FloatingSocialButtonsProps) {
  if (hidden) return null;

  const cleanWaDigits = String(whatsappNumber || '+91 94460 12345')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');
  const whatsappHref = `https://wa.me/${cleanWaDigits}?text=${encodeURIComponent(
    'Hello Swanaya Media Academy! I would like admissions or course details.'
  )}`;

  return (
    <div
      className="fixed bottom-[88px] right-4 sm:bottom-[98px] sm:right-5 z-[68] flex flex-col items-end gap-2 pointer-events-none"
      aria-label="Quick Social & Admissions Channels"
    >
      {/* Floating Instagram Button */}
      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Follow Swanaya Media Academy on Instagram"
        title="Instagram · @swanaya_media_acedemy_for_ai"
        className="pointer-events-auto group flex items-center gap-2 rounded-full bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] pl-3 pr-2 py-1.5 shadow-lg hover:-translate-y-0.5 transition-all duration-200"
      >
        <span className="hidden sm:inline text-[11px] font-bold text-[var(--sma-active-text)] whitespace-nowrap">
          Instagram
        </span>
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm"
          style={{
            background:
              'linear-gradient(135deg, #833AB4 0%, #E1306C 52%, #F77737 100%)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        </span>
      </a>

      {/* Floating WhatsApp Button */}
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Swanaya Media Academy on WhatsApp"
        title="WhatsApp Admissions Support"
        className="pointer-events-auto group flex items-center gap-2 rounded-full bg-[var(--sma-active-surface)] border border-[var(--sma-active-border)] pl-3 pr-2 py-1.5 shadow-lg hover:-translate-y-0.5 transition-all duration-200"
      >
        <span className="hidden sm:inline text-[11px] font-bold text-[var(--sma-active-text)] whitespace-nowrap">
          WhatsApp
        </span>
        <span className="w-9 h-9 rounded-full flex items-center justify-center bg-[#25D366] text-white shrink-0 shadow-sm">
          <MessageCircle className="w-4 h-4 fill-white/15" />
        </span>
      </a>
    </div>
  );
}
