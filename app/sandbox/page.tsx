import Link from "next/link";

export default function SandboxPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Spell Sandbox</h1>
        <p className="text-foreground/70">
          Placeholder route for the arena. Stage 2 will mount the camera, MediaPipe hand
          landmarker, and debug overlay here.
        </p>
      </div>

      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-foreground/20 bg-black/30 text-sm text-foreground/50">
        Game canvas placeholder
      </div>
    </main>
  );
}
