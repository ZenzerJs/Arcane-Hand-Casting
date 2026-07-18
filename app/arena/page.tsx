import Link from "next/link";
import { ArenaView } from "@/components/ArenaView";

const GESTURES = [
  { label: "Void", hint: "palms stacked", dot: "bg-rune" },
  { label: "Storm", hint: "fingers side by side", dot: "bg-storm" },
  { label: "Ward", hint: "one open palm", dot: "bg-aegis" },
];

export default function ArenaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <Link
        href="/"
        className="anim-rise w-fit text-sm text-foreground/55 transition-colors hover:text-foreground"
      >
        ← Back
      </Link>

      <div
        className="anim-rise flex flex-wrap items-end justify-between gap-4"
        style={{ animationDelay: "80ms" }}
      >
        <div className="space-y-1.5">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-rune">
            Live hand spell
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Spell Lens
          </h1>
        </div>

        <ul className="flex flex-wrap gap-2" aria-label="Gesture guide">
          {GESTURES.map((g) => (
            <li
              key={g.label}
              className="flex items-center gap-2 rounded-full border border-foreground/10 bg-surface/70 px-3.5 py-1.5 text-xs text-foreground/70"
            >
              <span
                className={`anim-pulse-soft h-1.5 w-1.5 rounded-full ${g.dot}`}
              />
              <span className="font-medium text-foreground/90">{g.label}</span>
              <span className="text-foreground/45">{g.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="anim-rise" style={{ animationDelay: "160ms" }}>
        <ArenaView />
      </div>
    </main>
  );
}
