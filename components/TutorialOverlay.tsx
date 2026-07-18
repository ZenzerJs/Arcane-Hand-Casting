"use client";

import { useEffect, useRef, useState } from "react";

/**
 * First-run tutorial — Stage 7.
 *
 * Three gesture steps shown once per browser (localStorage flag). Rendered as
 * a modal dialog over the arena: Escape or "Skip" dismisses, "Next" advances.
 * Icons are inline SVG so they follow theme tokens, no emoji.
 */

const STORAGE_KEY = "arcane-tutorial-done";

type Step = {
  title: string;
  body: string;
  accent: string;
  icon: React.ReactNode;
};

const STEPS: Step[] = [
  {
    title: "Void Singularity",
    body: "Stack both open palms vertically, one above the other. Pull them apart to grow the singularity.",
    accent: "text-rune",
    icon: (
      <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
        <circle cx="24" cy="24" r="7" fill="currentColor" />
        <ellipse
          cx="24"
          cy="24"
          rx="17"
          ry="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          transform="rotate(-14 24 24)"
        />
      </svg>
    ),
  },
  {
    title: "Storm Weave",
    body: "Hold both hands side by side with fingers spread. Arcs leap fingertip to fingertip across the gap.",
    accent: "text-storm",
    icon: (
      <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
        <path
          d="M26 6 14 26h8l-4 16 16-22h-9l5-14z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Aegis Ward",
    body: "Raise one steady open palm toward the camera. A protective ward blooms over your hand.",
    accent: "text-aegis",
    icon: (
      <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
        <path
          d="M24 5 39 11v12c0 10-6.4 16.7-15 20C15.4 39.7 9 33 9 23V11l15-6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="22" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
];

export function TutorialOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // Storage blocked (private mode) — show once per session instead.
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    nextButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore — overlay simply reappears next session.
    }
    setOpen(false);
  }

  function next() {
    if (step >= STEPS.length - 1) {
      dismiss();
      return;
    }
    setStep((s) => s + 1);
  }

  if (!open) return null;
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to cast spells"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
    >
      <div className="anim-rise w-full max-w-sm rounded-2xl border border-foreground/15 bg-surface p-6 shadow-[0_0_80px_rgba(139,108,255,0.18)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/45">
          Spell {step + 1} of {STEPS.length}
        </p>

        <div className={`mt-4 flex items-center gap-4 ${current.accent}`}>
          {current.icon}
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            {current.title}
          </h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          {current.body}
        </p>

        <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-foreground/80" : "w-2.5 bg-foreground/20"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full px-3.5 py-2 text-xs text-foreground/50 transition-colors hover:text-foreground"
          >
            Skip
          </button>
          <button
            ref={nextButtonRef}
            type="button"
            onClick={next}
            className="rounded-full border border-foreground/20 bg-foreground/10 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-rune/60 hover:bg-rune/15"
          >
            {last ? "Begin casting" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
