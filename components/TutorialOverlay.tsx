"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  {
    title: "Ember Grasp",
    body: "Clench one fist toward the camera. Molten embers gather around your hand and burn anything that drifts close.",
    accent: "text-ember",
    icon: (
      <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
        <path
          d="M24 4c2 6-4 9-4 15 0 3 2 6 6 6 5 0 7-3 7-7 0-4-3-7-3-12 4 4 8 8 8 13 0 8-6 14-14 14S10 27 10 19c0-5 4-9 6-12 1 3 0 5-1 7 0-5 4-8 9-10Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function TutorialOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore — overlay simply reappears next session.
    }
    setOpen(false);
  }, []);

  const trapTab = useCallback((e: KeyboardEvent) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    let seen = true;
    try {
      seen = !!window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked (private mode) — show once per session instead.
      seen = false;
    }
    if (seen) return;
    // Seed the overlay from a client-only store on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    nextButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "Tab") trapTab(e);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      restoreFocusRef.current?.focus();
    };
  }, [open, dismiss, trapTab]);

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
      ref={dialogRef}
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
