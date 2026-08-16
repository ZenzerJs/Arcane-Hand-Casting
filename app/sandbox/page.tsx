import Link from "next/link";
import { VisionSandbox } from "@/components/VisionSandbox";

export default function SandboxPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <Link href="/" className="text-sm text-foreground/60 hover:text-foreground">
        ← Back
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Spell Sandbox</h1>
        <p className="text-foreground/70">
          Vision debug: local MediaPipe landmarks, mirrored overlay, palm distance,
          and FPS. Video stays on this device.
        </p>
      </div>

      <VisionSandbox />
    </main>
  );
}
