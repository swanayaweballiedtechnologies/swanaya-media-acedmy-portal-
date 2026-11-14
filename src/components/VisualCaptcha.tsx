import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, Calculator, Grid2x2 } from 'lucide-react';

export type CaptchaPurpose = 'signup' | 'admissions' | 'course_registration' | 'exam_registration';

interface CaptchaTile {
  id: string;
  imageUri: string;
}

interface VisualChallengeData {
  challengeId: string;
  mode: 'visual';
  prompt: string;
  requiredSelections: number;
  targetImageUri: string;
  tiles: CaptchaTile[];
  expiresAt: number;
}

interface MathChallengeData {
  challengeId: string;
  mode: 'math';
  prompt: string;
  accessiblePrompt: string;
  mathImageUri: string;
  expiresAt: number;
}

type ChallengeData = VisualChallengeData | MathChallengeData;

interface VisualCaptchaProps {
  purpose: CaptchaPurpose;
  onTokenChange: (token: string | null) => void;
  resetSignal?: number;
  compact?: boolean;
}

export default function VisualCaptcha({
  purpose,
  onTokenChange,
  resetSignal = 0,
  compact = false,
}: VisualCaptchaProps) {
  const [mode, setMode] = useState<'visual' | 'math'>('visual');
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mathAnswer, setMathAnswer] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'verifying' | 'verified' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onTokenChangeRef = useRef(onTokenChange);
  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  const loadChallenge = useCallback(
    async (targetMode: 'visual' | 'math' = mode) => {
      setStatus('loading');
      setErrorMessage(null);
      setSelectedIds([]);
      setMathAnswer('');
      onTokenChangeRef.current(null);

      try {
        const res = await fetch(
          `/api/captcha/challenge?mode=${targetMode}&purpose=${encodeURIComponent(purpose)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          throw new Error('Unable to load verification challenge.');
        }
        const data: ChallengeData = await res.json();
        setChallenge(data);
        setStatus('ready');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err?.message || 'Verification service unavailable. Please retry.');
      }
    },
    [mode, purpose]
  );

  useEffect(() => {
    loadChallenge(mode);
  }, [loadChallenge, mode, resetSignal]);

  const submitVerification = async (payload: {
    challengeId: string;
    selectedIds?: string[];
    answer?: string;
  }) => {
    setStatus('verifying');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          purpose,
        }),
      });
      const data = await res.json();

      if (res.ok && data.verified && data.captchaToken) {
        setStatus('verified');
        onTokenChangeRef.current(data.captchaToken);
        return;
      }

      onTokenChangeRef.current(null);
      setSelectedIds([]);
      setMathAnswer('');

      if (data.expired) {
        setErrorMessage(data.error || 'Challenge expired. Loading a new one.');
        setTimeout(() => {
          loadChallenge(mode);
        }, 700);
        return;
      }

      setStatus('ready');
      setErrorMessage(data.error || 'Verification did not match. Please try again.');
    } catch {
      onTokenChangeRef.current(null);
      setStatus('ready');
      setErrorMessage('Network error verifying challenge. Please try again.');
    }
  };

  const handleTileToggle = (tileId: string) => {
    if (!challenge || challenge.mode !== 'visual') return;
    if (status === 'verifying' || status === 'verified' || status === 'loading') return;

    setErrorMessage(null);

    const alreadySelected = selectedIds.includes(tileId);
    let nextSelected: string[];

    if (alreadySelected) {
      nextSelected = selectedIds.filter((id) => id !== tileId);
      setSelectedIds(nextSelected);
      return;
    }

    if (selectedIds.length >= challenge.requiredSelections) {
      nextSelected = [...selectedIds.slice(1), tileId];
    } else {
      nextSelected = [...selectedIds, tileId];
    }

    setSelectedIds(nextSelected);

    if (nextSelected.length === challenge.requiredSelections) {
      submitVerification({
        challengeId: challenge.challengeId,
        selectedIds: nextSelected,
      });
    }
  };

  const handleMathVerify = () => {
    if (!challenge || challenge.mode !== 'math') return;
    if (!mathAnswer.trim()) {
      setErrorMessage('Please enter the numeric answer.');
      return;
    }
    submitVerification({
      challengeId: challenge.challengeId,
      answer: mathAnswer.trim(),
    });
  };

  const handleModeSwitch = () => {
    const nextMode = mode === 'visual' ? 'math' : 'visual';
    setMode(nextMode);
  };

  return (
    <div
      className={`bg-slate-950/90 border rounded-lg transition-colors duration-200 ${
        status === 'verified'
          ? 'border-emerald-500/40 bg-emerald-950/15'
          : errorMessage
          ? 'border-rose-500/40'
          : 'border-slate-800'
      } ${compact ? 'p-3.5' : 'p-4'}`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck
            className={`w-4 h-4 shrink-0 ${
              status === 'verified' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          />
          <span className="text-xs font-semibold text-slate-200 truncate">
            Human Verification
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status !== 'verified' && (
            <button
              type="button"
              onClick={handleModeSwitch}
              title={mode === 'visual' ? 'Switch to math challenge' : 'Switch to visual challenge'}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-amber-400 rounded border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {mode === 'visual' ? (
                <>
                  <Calculator className="w-3 h-3" />
                  <span>Math Check</span>
                </>
              ) : (
                <>
                  <Grid2x2 className="w-3 h-3" />
                  <span>Visual Check</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => loadChallenge(mode)}
            title="Load a new challenge"
            aria-label="Refresh CAPTCHA challenge"
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-amber-400 rounded border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <RefreshCw className={`w-3 h-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
            <span>{status === 'verified' ? 'Reset' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Verified Confirmation */}
      {status === 'verified' ? (
        <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-medium text-emerald-300">
              Human verification complete
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80 whitespace-nowrap">
            Verified
          </span>
        </div>
      ) : status === 'loading' || !challenge ? (
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md bg-slate-900 border border-slate-800 animate-pulse shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-40 bg-slate-900 rounded animate-pulse" />
              <div className="h-2.5 w-24 bg-slate-900 rounded animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 rounded-md bg-slate-900 border border-slate-800 animate-pulse" />
            ))}
          </div>
        </div>
      ) : challenge.mode === 'visual' ? (
        <div className="space-y-3">
          {/* Reference Target Prompt */}
          <div className="flex items-center justify-between gap-3 bg-[#080B11] border border-slate-800/80 rounded-md p-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded border border-amber-500/30 bg-[#070A10] flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={challenge.targetImageUri}
                  alt="Target emblem to match"
                  className="w-10 h-10 object-contain select-none pointer-events-none"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200 leading-snug">
                  {challenge.prompt}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Symbols may be slightly tilted
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-mono tabular-nums font-semibold text-amber-400">
                {selectedIds.length}/{challenge.requiredSelections}
              </span>
            </div>
          </div>

          {/* 3x2 Interactive Emblem Grid */}
          <div
            role="group"
            aria-label={challenge.prompt}
            className="grid grid-cols-3 gap-2"
          >
            {challenge.tiles.map((tile, idx) => {
              const isSelected = selectedIds.includes(tile.id);
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => handleTileToggle(tile.id)}
                  disabled={status === 'verifying'}
                  aria-pressed={isSelected}
                  aria-label={`Verification option ${idx + 1}`}
                  className={`relative min-h-[52px] h-14 rounded-md border flex items-center justify-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-400/50 scale-[0.98]'
                      : 'border-slate-800 bg-[#0B0F18] hover:border-slate-600 hover:bg-slate-900'
                  } disabled:opacity-60`}
                >
                  <img
                    src={tile.imageUri}
                    alt={`Choice ${idx + 1}`}
                    className="w-11 h-11 object-contain select-none pointer-events-none"
                  />
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Accessible Math Mode */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded border border-amber-500/30 bg-[#070A10] px-2 py-1 shrink-0">
              <img
                src={challenge.mathImageUri}
                alt={challenge.accessiblePrompt}
                className="h-10 w-auto object-contain select-none pointer-events-none"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <input
                type="text"
                inputMode="numeric"
                value={mathAnswer}
                onChange={(e) => {
                  setMathAnswer(e.target.value);
                  setErrorMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleMathVerify();
                  }
                }}
                placeholder="Answer"
                aria-label={challenge.accessiblePrompt}
                className="w-full min-h-[40px] bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleMathVerify}
                disabled={status === 'verifying'}
                className="min-h-[40px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {status === 'verifying' ? 'Checking...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status / Error Message */}
      {status === 'verifying' && (
        <p className="mt-2.5 text-[11px] text-amber-400 font-medium">
          Validating response...
        </p>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-2.5 py-1.5"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
