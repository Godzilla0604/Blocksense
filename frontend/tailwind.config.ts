import type { Config } from "tailwindcss";

// Design tokens — Frontend PRD §3.2 / §3.3
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // "base" lives only under backgroundColor/borderColor so `text-base`
      // keeps meaning font-size (a colour named "base" would override it).
      backgroundColor: { base: "#0A0E17" },
      borderColor: { base: "#0A0E17" },
      colors: {
        panel: "#111827",
        card: "#161D2E",
        subtle: "#232B3D",
        primary: "#F1F5F9",
        secondary: "#8A9BB8",
        accent: { DEFAULT: "#22D3EE", primary: "#22D3EE", secondary: "#A78BFA" },
        risk: { high: "#F43F5E", medium: "#F59E0B", low: "#34D399" },
      },
      fontFamily: {
        // Whole UI in Consolas for a terminal look; JetBrains Mono is the web fallback
        // for machines without Consolas (macOS/Linux).
        sans: ["Consolas", "'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
        mono: ["Consolas", "'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { card: "12px" },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
      },
      animation: { shimmer: "shimmer 1.4s linear infinite" },
    },
  },
  plugins: [],
} satisfies Config;
