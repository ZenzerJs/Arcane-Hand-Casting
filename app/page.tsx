import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.25em] text-rune">Arcane Handcasting</p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Your hands are the controller.
        </h1>
        <p className="max-w-xl text-lg text-foreground/75">
          Shape spells with real hand geometry in a browser arena. Webcam video is processed
          locally on your device and never uploaded.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/arena"
          className="rounded-md bg-ember px-5 py-3 text-sm font-medium text-black transition hover:brightness-110"
        >
          Open Ember Lens
        </Link>
        <Link
          href="/sandbox"
          className="rounded-md border border-foreground/20 px-5 py-3 text-sm text-foreground/90 transition hover:border-foreground/40"
        >
          Vision Sandbox
        </Link>
        <a
          href="#privacy"
          className="rounded-md border border-foreground/20 px-5 py-3 text-sm text-foreground/90 transition hover:border-foreground/40"
        >
          Privacy
        </a>
      </div>

      <section id="privacy" className="rounded-lg border border-foreground/10 bg-black/20 p-5 text-sm text-foreground/70">
        <h2 className="mb-2 font-medium text-foreground">Privacy</h2>
        <p>
          Camera frames stay in your browser for hand landmark inference. This MVP does not
          transmit, save, or store webcam video.
        </p>
      </section>

      <p className="text-xs text-foreground/40">
        Stage 5 Ember live — fire forms directly between your palms.
      </p>
    </main>
  );
}
