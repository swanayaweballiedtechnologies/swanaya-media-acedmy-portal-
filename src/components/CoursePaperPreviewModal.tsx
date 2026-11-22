/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Calendar,
  BookOpen,
  Layers,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { CoursePaper } from '../db/mockDb';

export interface PreviewablePaper {
  id?: string;
  title: string;
  description?: string;
  courseCode?: string;
  courseName?: string;
  semester?: string;
  subject?: string;
  module?: string;
  category?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  isPublished?: boolean;
  publishedAt?: string;
  createdAt?: string;
}

interface CoursePaperPreviewModalProps {
  paper: PreviewablePaper | null;
  onClose: () => void;
  onDownload?: (paper: PreviewablePaper) => void;
  previewBadgeLabel?: string;
}

export function formatPaperFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'PDF';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatPaperDate(iso?: string): string {
  if (!iso) return 'Not published yet';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return String(iso).slice(0, 10);
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export async function triggerBrandedPdfDownload(paper: Pick<CoursePaper | PreviewablePaper, 'fileUrl' | 'fileName'>) {
  try {
    const res = await fetch(paper.fileUrl);
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = paper.fileName || 'swanaya_course_paper.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      return;
    }
  } catch {
    // Fallback to direct anchor download if CORS headers are not set on Storage bucket yet
  }
  const link = document.createElement('a');
  link.href = paper.fileUrl;
  link.download = paper.fileName || 'swanaya_course_paper.pdf';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function CoursePaperPreviewModal({
  paper,
  onClose,
  onDownload,
  previewBadgeLabel,
}: CoursePaperPreviewModalProps) {
  const [iframeFailed, setIframeFailed] = useState(false);

  if (!paper) return null;

  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload(paper);
    } else {
      void triggerBrandedPdfDownload(paper);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`PDF Preview: ${paper.title}`}
    >
      <div
        className="bg-[#0B0F17] border border-amber-500/30 rounded-xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Swanaya Media Academy Branded Viewer Header */}
        <div className="bg-gradient-to-r from-[#0A0D14] via-slate-900 to-[#0A0D14] border-b border-slate-800 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 shrink-0 mt-0.5">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-serif font-bold tracking-widest uppercase text-amber-400">
                  SWANAYA MEDIA ACADEMY
                </span>
                <span className="text-slate-600 text-[10px]">·</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  {previewBadgeLabel || paper.category || 'Course Document'}
                </span>
                {paper.isPublished === false && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    Unpublished Draft Preview
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-serif font-bold text-white truncate">
                {paper.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadClick}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
            <a
              href={paper.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              title="Open PDF in browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Open Tab</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close PDF viewer"
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-300 shrink-0">
          {(paper.courseCode || paper.courseName) && (
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <strong className="text-amber-300 font-mono">{paper.courseCode || 'COURSE'}</strong>
              {paper.courseName && <span className="text-slate-400 hidden md:inline">· {paper.courseName}</span>}
            </span>
          )}
          {(paper.semester || paper.module || paper.subject) && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>
                {[paper.semester, paper.subject, paper.module].filter(Boolean).join(' · ')}
              </span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-slate-400 font-mono">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{formatPaperDate(paper.publishedAt || paper.createdAt)}</span>
          </span>
          <span className="font-mono text-slate-400 ml-auto">
            {paper.fileName} ({formatPaperFileSize(paper.fileSize)})
          </span>
        </div>

        {paper.description && (
          <div className="bg-slate-900/50 border-b border-slate-800/70 px-4 sm:px-6 py-2 text-xs text-slate-300 shrink-0">
            {paper.description}
          </div>
        )}

        {/* PDF Viewport */}
        <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
          {!iframeFailed ? (
            <iframe
              src={`${paper.fileUrl}#toolbar=1&navpanes=0`}
              title={paper.title}
              className="w-full h-full flex-1 border-0 bg-white"
              onError={() => setIframeFailed(true)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <div className="space-y-1 max-w-md">
                <p className="text-sm font-serif font-bold text-white">
                  Embedded PDF preview unavailable on this browser
                </p>
                <p className="text-xs text-slate-400">
                  Use the buttons below to open the Swanaya Media Academy document in your device PDF viewer or download a copy.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={paper.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-white text-xs font-bold uppercase rounded-lg flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  Open PDF Document
                </a>
                <button
                  type="button"
                  onClick={handleDownloadClick}
                  className="px-4 py-2 bg-amber-500 text-black text-xs font-bold uppercase rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Watermark */}
        <div className="bg-[#0A0D14] border-t border-slate-800 px-4 sm:px-6 py-2 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Swanaya Media Academy · Authorized Academic Document Viewer
          </span>
          <span className="hidden sm:inline">Controlled Academic Distribution</span>
        </div>
      </div>
    </div>
  );
}
