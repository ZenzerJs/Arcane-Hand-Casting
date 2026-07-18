import Link from "next/link";

const MOTES = [
  { left: "8%", dur: "13s", delay: "0s", x: "18px", color: "bg-ember/60" },
  { left: "22%", dur: "17s", delay: "3.2s", x: "-14px", color: "bg-rune/60" },
  { left: "38%", dur: "15s", delay: "6.5s", x: "10px", color: "bg-aegis/50" },
  { left: "57%", dur: "19s", delay: "1.4s", x: "-20px", color: "bg-storm/50" },
  { left: "71%", dur: "14s", delay: "8s", x: "16px", color: "bg-ember/50" },
  { left: "86%", dur: "18s", delay: "4.6s", x: "-12px", color: "bg-rune/50" },
];

const SPELLS = [
  {
    name: "Void Singularity",
    gesture: "Stack open palms vertically — gravity deepens with the gap.",
    accent: "text-rune",
    ring: "group-hover:border-rune/50",
    glow: "group-hover:shadow-[0_0_50px_rgba(106,91,255,0.22)]",
    anim: "anim-pulse-soft",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
        <circle cx="12" cy="12" r="3.5" fill="currentColor" />
        <ellipse cx="12" cy="12" rx="9" ry="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 8.5c2-2.3 5.5-3.5 9-2.8M19 15.5c-2 2.3-5.5 3.5-9 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Storm Weave",
    gesture: "Hands side by side, fingers spread — arcs leap tip to tip.",
    accent: "text-storm",
    ring: "group-hover:border-storm/50",
    glow: "group-hover:shadow-[0_0_50px_rgba(139,108,255,0.2)]",
    anim: "anim-pulse-soft",
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
    gesture: "One steady open palm toward the camera raises the ward.",
    accent: "text-aegis",
    ring: "group-hover:border-aegis/50",
    glow: "group-hover:shadow-[0_0_50px_rgba(61,224,208,0.18)]",
    anim: "anim-float",
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
];

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-14 overflow-hidden px-6 py-20">
      {/* Ambient rising motes */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {MOTES.map((m, i) => (
          <span
            key={i}
            className={`mote absolute bottom-0 h-1.5 w-1.5 rounded-full ${m.color}`}
            style={{
              left: m.left,
              ["--drift-dur" as string]: m.dur,
              ["--drift-delay" as string]: m.delay,
              ["--drift-x" as string]: m.x,
            }}
          />
        ))}
      </div>

      {/* Casting sigil — signature element */}
      <div
        className="pointer-events-none absolute -right-40 top-1/2 hidden -translate-y-1/2 lg:block"
        aria-hidden
      >
        <div className="sigil-ring h-[520px] w-[520px] rounded-full border border-rune/20 [mask-image:linear-gradient(to_left,black,transparent_80%)]">
          <div className="absolute inset-6 rounded-full border border-dashed border-rune/25" />
          <div className="sigil-ring-inner absolute inset-16 rounded-full border border-aegis/15">
            <div className="absolute inset-8 rounded-full border border-dashed border-ember/20" />
          </div>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <span
              key={deg}
              className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-rune/50"
              style={{
                transform: `rotate(${deg}deg) translateX(260px)`,
              }}
            />
          ))}
        </div>
      </div>

      <header className="relative space-y-5">
        <p
          className="anim-rise font-mono text-xs uppercase tracking-[0.35em] text-rune"
          style={{ animationDelay: "0ms" }}
        >
          Arcane Handcasting
        </p>
        <h1
          className="anim-rise max-w-2xl font-display text-5xl font-bold leading-[1.06] tracking-tight sm:text-6xl"
          style={{ animationDelay: "90ms" }}
        >
          Your hands are{" "}
          <span className="shimmer-text bg-gradient-to-r from-ember via-storm to-aegis">
            the controller
          </span>
          .
        </h1>
        <p
          className="anim-rise max-w-xl text-lg leading-relaxed text-foreground/70"
          style={{ animationDelay: "180ms" }}
        >
          Shape living spells with real hand geometry, straight from your
          webcam. Every frame is processed on your device — video never
          leaves the browser.
        </p>
        <div
          className="anim-rise flex flex-wrap items-center gap-3 pt-2"
          style={{ animationDelay: "270ms" }}
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
            Vision Sandbox
          </Link>
        </div>
      </header>

      <section
        className="anim-rise relative grid gap-4 sm:grid-cols-3"
        style={{ animationDelay: "380ms" }}
        aria-label="Spells"
      >
        {SPELLS.map((spell) => (
          <article
            key={spell.name}
            className={`group rounded-xl border border-foreground/10 bg-surface/60 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 ${spell.ring} ${spell.glow}`}
          >
            <div className={`${spell.accent} ${spell.anim} mb-4 w-fit`}>
              {spell.icon}
            </div>
            <h2 className="font-display text-base font-bold tracking-wide">
              {spell.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">
              {spell.gesture}
            </p>
          </article>
        ))}
      </section>

      <footer
        className="anim-rise relative flex flex-wrap items-center justify-between gap-4 border-t border-foreground/10 pt-6 text-xs text-foreground/45"
        style={{ animationDelay: "480ms" }}
      >
        <p>
          Camera frames stay in your browser for hand landmark inference.
          Nothing is transmitted, saved, or stored.
        </p>
        <p className="font-mono uppercase tracking-[0.2em]">
          Three spells live
        </p>
      </footer>
    </main>
  );
}
