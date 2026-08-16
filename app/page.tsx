import Link from "next/link";

const NAV = [
  { href: "#spells", label: "Spells" },
  { href: "#how", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
];

const MOTES = [
  { left: "4%", dur: "13s", delay: "0s", x: "18px", size: "10px", color: "bg-ember/60" },
  { left: "10%", dur: "21s", delay: "2.4s", x: "-16px", size: "7px", color: "bg-aegis/50" },
  { left: "16%", dur: "17s", delay: "3.2s", x: "-14px", size: "12px", color: "bg-rune/60" },
  { left: "23%", dur: "15s", delay: "6.5s", x: "10px", size: "8px", color: "bg-storm/50" },
  { left: "30%", dur: "19s", delay: "1.4s", x: "-20px", size: "11px", color: "bg-ember/50" },
  { left: "37%", dur: "14s", delay: "8s", x: "16px", size: "9px", color: "bg-aegis/40" },
  { left: "44%", dur: "22s", delay: "5.2s", x: "-12px", size: "7px", color: "bg-rune/50" },
  { left: "51%", dur: "16s", delay: "0.8s", x: "22px", size: "12px", color: "bg-storm/40" },
  { left: "58%", dur: "18s", delay: "4.6s", x: "-12px", size: "8px", color: "bg-ember/60" },
  { left: "64%", dur: "20s", delay: "7.1s", x: "14px", size: "10px", color: "bg-rune/60" },
  { left: "70%", dur: "15s", delay: "2.9s", x: "-18px", size: "9px", color: "bg-aegis/50" },
  { left: "77%", dur: "23s", delay: "5.9s", x: "12px", size: "7px", color: "bg-storm/50" },
  { left: "83%", dur: "16s", delay: "1.1s", x: "-22px", size: "11px", color: "bg-ember/50" },
  { left: "89%", dur: "19s", delay: "3.8s", x: "18px", size: "8px", color: "bg-rune/50" },
  { left: "95%", dur: "14s", delay: "6.2s", x: "-14px", size: "10px", color: "bg-aegis/40" },
];

const STEPS = [
  {
    step: "01",
    title: "Grant camera access",
    body: "One click, no sign-up. Your camera feed stays on this device the whole time.",
    accent: "text-rune",
  },
  {
    step: "02",
    title: "Shape a gesture",
    body: "Stack open palms, spread your fingers side by side, or raise one steady open palm.",
    accent: "text-storm",
  },
  {
    step: "03",
    title: "Cast",
    body: "The spell forms, charges, and releases from your hand's geometry and motion.",
    accent: "text-ember",
  },
];

const SPELLS = [
  {
    name: "Void Singularity",
    gesture: "Stack open palms vertically, then pull them apart.",
    effect: "A black hole with an orange-violet event horizon; consumes trial wisps.",
    accent: "text-rune",
    ring: "group-hover:border-rune/50",
    glow: "group-hover:shadow-[0_0_50px_rgba(106,91,255,0.22)]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <circle cx="12" cy="12" r="3.5" fill="currentColor" />
        <ellipse cx="12" cy="12" rx="9" ry="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5 8.5c2-2.3 5.5-3.5 9-2.8M19 15.5c-2 2.3-5.5 3.5-9 2.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: "Storm Weave",
    gesture: "Hands side by side, fingers spread.",
    effect: "Five tip-to-tip lightning arcs; strikes trial wisps.",
    accent: "text-storm",
    ring: "group-hover:border-storm/50",
    glow: "group-hover:shadow-[0_0_50px_rgba(139,108,255,0.2)]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path
          d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "Aegis Ward",
    gesture: "One steady open palm toward the camera.",
    effect: "A rotating rune ward; blocks diving hazard bolts.",
    accent: "text-aegis",
    ring: "group-hover:border-aegis/50",
    glow: "group-hover:shadow-[0_0_50px_rgba(61,224,208,0.18)]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path
          d="M12 2 4.5 5v6c0 5 3.2 8.7 7.5 11 4.3-2.3 7.5-6 7.5-11V5L12 2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "Ember Grasp",
    gesture: "Clench one fist toward the camera.",
    effect: "Molten embers coalesce around your fist; incinerates trial wisps.",
    accent: "text-ember",
    ring: "group-hover:border-ember/50",
    glow: "group-hover:shadow-[0_0_50px_rgba(255,122,58,0.22)]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <path
          d="M12 2c1 3-2 4.5-2 7.5 0 1.5 1 3 3 3 2.5 0 3.5-1.5 3.5-3.5 0-2-1.5-3.5-1.5-6 2 2 4 4 4 6.5C19 14.5 16 18 12 18s-7-3.5-7-8.5C5 7 6 5 7 4c.5 1.5 0 2.5-.5 3.5C6.5 4.5 8.5 3 12 2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const FEATURES = [
  {
    title: "No controllers",
    body: "Hand geometry and motion are the only input — nothing to hold, pair, or charge.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M7 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M12 3v6M6 6.5c-1.5 3-1 6.5 0 10M18 6.5c1.5 3 1 6.5 0 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "On-device privacy",
    body: "Every frame is processed locally. Video is never uploaded, saved, or stored.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M12 2 4.5 5v6c0 5 3.2 8.7 7.5 11 4.3-2.3 7.5-6 7.5-11V5L12 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Real-time effects",
    body: "MediaPipe hand tracking + PixiJS rendering keep casts low-latency and fluid.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M3 12h4l2-7 4 14 2-7h6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Four living spells",
    body: "Singularity, Storm Weave, Aegis Ward, and Ember Grasp — each with its own gesture.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="m12 3 1.9 5.8L20 10l-5 3.5L16.5 20 12 16.5 7.5 20 9 13.5 4 10l6.1-1.2L12 3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Trial mode",
    body: "A wave-based challenge with score, lives, and hazards that scale as you clear.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 6H4a1 1 0 0 0-1 1c0 4 3 6 9 6s9-2 9-6a1 1 0 0 0-1-1h-3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    title: "Open web",
    body: "Runs in any modern browser — no install, no app store, no account.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ember focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-foreground/10 bg-background/70 backdrop-blur-md">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
          aria-label="Primary"
        >
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-rune/30 bg-surface/60 text-rune transition-colors group-hover:border-rune/60">
              <SigilMark />
            </span>
            <span className="font-display text-sm font-bold tracking-[0.18em] text-foreground">
              ARCANE HANDCASTING
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-foreground/65 transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <Link
            href="/arena"
            className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-black transition-transform duration-200 hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
          >
            Enter the Spell Lens
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative">
          {/* Ambient rising motes */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {MOTES.map((m, i) => (
              <span
                key={i}
                className={`mote absolute bottom-0 rounded-full ${m.color}`}
                style={{
                  left: m.left,
                  width: m.size,
                  height: m.size,
                  ["--drift-dur" as string]: m.dur,
                  ["--drift-delay" as string]: m.delay,
                  ["--drift-x" as string]: m.x,
                }}
              />
            ))}
          </div>

          <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:pt-28">
            <div className="relative space-y-7">
              <h1
                className="anim-rise font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
                style={{ animationDelay: "80ms" }}
              >
                Your hands are{" "}
                <span className="shimmer-text bg-gradient-to-r from-ember via-storm to-aegis">
                  the controller
                </span>
                .
              </h1>

              <p
                className="anim-rise max-w-xl text-lg leading-relaxed text-foreground/70"
                style={{ animationDelay: "160ms" }}
              >
                Shape living spells with real hand geometry, straight from your
                webcam. No controllers, no buttons — every frame is processed on
                your device.
              </p>

              <div
                className="anim-rise flex flex-wrap items-center gap-3 pt-1"
                style={{ animationDelay: "240ms" }}
              >
                <Link
                  href="/arena"
                  className="group relative overflow-hidden rounded-lg bg-ember px-6 py-3.5 text-sm font-semibold text-black transition-transform duration-200 hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
                >
                  <span className="relative z-10">Enter the Spell Lens</span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                </Link>
                <Link
                  href="/sandbox"
                  className="rounded-lg border border-foreground/15 px-6 py-3.5 text-sm text-foreground/85 transition-colors hover:border-rune/50 hover:text-foreground"
                >
                  Try the Vision Sandbox
                </Link>
              </div>

              <p
                className="anim-rise flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/50"
                style={{ animationDelay: "320ms" }}
              >
                <span>Free</span>
                <span aria-hidden className="text-foreground/25">·</span>
                <span>No sign-up</span>
                <span aria-hidden className="text-foreground/25">·</span>
                <span>Video never leaves your device</span>
              </p>
            </div>

            {/* Hero visual — the spell lens */}
            <div
              className="anim-rise relative mx-auto hidden aspect-square w-full max-w-[440px] lg:block"
              style={{ animationDelay: "160ms" }}
              aria-hidden
            >
              <div className="sigil-ring absolute inset-0 rounded-full border border-rune/25">
                <div className="absolute inset-8 rounded-full border border-dashed border-rune/30" />
                <div className="sigil-ring-inner absolute inset-16 rounded-full border border-aegis/20">
                  <div className="absolute inset-8 rounded-full border border-dashed border-ember/25" />
                </div>
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <span
                    key={deg}
                    className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-rune/50"
                    style={{ transform: `rotate(${deg}deg) translateX(200px)` }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="anim-flicker relative h-32 w-32 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ffb15c_0%,#ff7a3a_35%,#8b6cff_70%,rgba(139,108,255,0)_100%)] shadow-[0_0_90px_rgba(139,108,255,0.5)]" />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          aria-labelledby="how-title"
          className="border-t border-foreground/10 bg-surface/40"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <SectionHeading
              id="how-title"
              eyebrow="How it works"
              title="Three gestures, endless magic"
              description="No calibration, no learning curve. Raise your hands and the lens does the rest."
            />
            <ol className="mt-14 grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <li
                  key={step.step}
                  className="group relative rounded-2xl border border-foreground/10 bg-background/40 p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-foreground/20"
                >
                  <span className="font-mono text-xs tracking-[0.3em] text-foreground/35">
                    {step.step}
                  </span>
                  <h3 className={`mt-3 font-display text-lg font-bold ${step.accent}`}>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Spells */}
        <section
          id="spells"
          aria-labelledby="spells-title"
          className="border-t border-foreground/10"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <SectionHeading
              id="spells-title"
              eyebrow="The spells"
              title="Shape the arcane"
              description="Each spell responds to a distinct hand pose, tuned to your palm geometry and motion."
            />
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SPELLS.map((spell) => (
                <article
                  key={spell.name}
                  className={`group rounded-2xl border border-foreground/10 bg-surface/60 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 ${spell.ring} ${spell.glow}`}
                >
                  <div className={`${spell.accent} mb-4 w-fit`}>{spell.icon}</div>
                  <h3 className="font-display text-lg font-bold tracking-wide">
                    {spell.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/60">
                    {spell.gesture}
                  </p>
                  <p className="mt-3 border-t border-foreground/10 pt-3 text-xs leading-relaxed text-foreground/45">
                    {spell.effect}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          aria-labelledby="features-title"
          className="border-t border-foreground/10 bg-surface/40"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <SectionHeading
              id="features-title"
              eyebrow="Why it feels different"
              title="Built for the browser, designed for your hands"
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="flex gap-4 rounded-xl border border-foreground/10 bg-background/40 p-5"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rune/25 bg-rune/10 text-rune">
                    {feature.icon}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/55">
                      {feature.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section
          id="privacy"
          aria-labelledby="privacy-title"
          className="border-t border-foreground/10"
        >
          <div className="mx-auto max-w-4xl px-6 py-24 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-aegis/30 bg-aegis/10 text-aegis">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
                <path
                  d="M12 2 4.5 5v6c0 5 3.2 8.7 7.5 11 4.3-2.3 7.5-6 7.5-11V5L12 2Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="m9 12 2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2
              id="privacy-title"
              className="font-display text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Private by design
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-foreground/65">
              Webcam frames are processed{" "}
              <span className="text-foreground">entirely in your browser</span> for
              hand-landmark inference. Nothing is transmitted, saved, or stored —
              the magic stays on your device.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section aria-labelledby="cta-title" className="border-t border-foreground/10">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="relative overflow-hidden rounded-3xl border border-rune/25 bg-gradient-to-br from-surface to-background px-8 py-16 text-center">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-rune/20 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-ember/15 blur-3xl"
                aria-hidden
              />
              <h2
                id="cta-title"
                className="relative font-display text-3xl font-bold tracking-tight sm:text-4xl"
              >
                Ready to cast?
              </h2>
              <p className="relative mx-auto mt-3 max-w-xl text-foreground/65">
                Open the Spell Lens, raise your hands, and watch the geometry of
                your fingers become magic.
              </p>
              <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/arena"
                  className="rounded-lg bg-ember px-7 py-3.5 text-sm font-semibold text-black transition-transform duration-200 hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
                >
                  Enter the Spell Lens
                </Link>
                <Link
                  href="/sandbox"
                  className="rounded-lg border border-foreground/15 px-7 py-3.5 text-sm text-foreground/85 transition-colors hover:border-rune/50 hover:text-foreground"
                >
                  Inspect the vision sandbox
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-foreground/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-foreground/45 sm:flex-row">
          <p className="flex items-center gap-2">
            <SigilMark className="h-4 w-4 text-rune" />
            Arcane Handcasting
          </p>
          <p>
            Built with Next.js, MediaPipe Tasks Vision, and PixiJS.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/arena" className="transition-colors hover:text-foreground">
              Arena
            </Link>
            <Link href="/sandbox" className="transition-colors hover:text-foreground">
              Sandbox
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SigilMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path
        d="M12 1v3M12 20v3M1 12h3M20 12h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-rune">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-foreground/60">{description}</p>
      )}
    </div>
  );
}
