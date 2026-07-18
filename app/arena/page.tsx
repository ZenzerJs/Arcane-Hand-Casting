import Link from "next/link";
import { ArenaView } from "@/components/ArenaView";

export default function ArenaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back
      </Link>

      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-ember">
          Live hand spell
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Spell Lens
        </h1>
        <p className="text-foreground/70">
          Camera is the world. Hands stacked vertically channel fire; side by
          side with crossing fingertip beams channel lightning.
        </p>
      </div>

      <ArenaView />
    </main>
  );
}
