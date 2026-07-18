import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ES modules do not provide __dirname, so derive the repository root
// from this script's file URL.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// MediaPipe ships its runtime files inside node_modules, but browsers can
// only request static files exposed through Next.js's public directory.
const src = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(root, "public", "wasm");

// Keep the message explicit when package contents differ from expectations.
if (!existsSync(src)) {
  console.warn("[copy-mediapipe-wasm] source missing:", src);
  process.exit(0);
}

// postinstall runs after dependencies exist. Copying here makes /wasm
// available in local development and production builds without a CDN.
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-mediapipe-wasm] copied wasm -> public/wasm");
