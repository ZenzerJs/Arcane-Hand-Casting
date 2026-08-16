import { ImageResponse } from "next/og";

export const alt = "Arcane Handcasting — cast spells with your hands";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background:
            "linear-gradient(160deg, #070b14 0%, #121a2e 55%, #1a1433 100%)",
          color: "#e8eefc",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 760,
            height: 760,
            borderRadius: 380,
            background:
              "radial-gradient(circle, rgba(139,108,255,0.4) 0%, rgba(255,122,58,0.18) 45%, transparent 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            fontSize: 34,
            letterSpacing: 8,
            color: "#8b6cff",
            textTransform: "uppercase",
          }}
        >
          Arcane Handcasting
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 82,
            fontWeight: 700,
            textAlign: "center",
            maxWidth: 940,
            lineHeight: 1.05,
          }}
        >
          Your hands are the controller
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 30,
            color: "rgba(232,238,252,0.72)",
          }}
        >
          Cast spells with webcam-tracked hand geometry — right in your browser.
        </div>
      </div>
    ),
    { ...size },
  );
}
