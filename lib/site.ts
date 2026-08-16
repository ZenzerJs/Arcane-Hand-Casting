/**
 * Shared site identity for SEO metadata, robots, and sitemap.
 * `VERCEL_PROJECT_PRODUCTION_URL` is provided automatically by Vercel.
 */
export const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const siteConfig = {
  name: "Arcane Handcasting",
  title: "Arcane Handcasting — cast spells with your hands",
  description:
    "A browser spell sandbox where webcam-tracked hand geometry creates, charges, aims, and releases magic. No controllers, no buttons — your hands are the controller.",
  url: siteUrl,
} as const;
