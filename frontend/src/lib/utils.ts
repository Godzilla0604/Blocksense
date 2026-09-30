import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskCategory } from "@/types/api";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const RISK_COLOR: Record<RiskCategory, string> = {
  High: "#F43F5E",
  Medium: "#F59E0B",
  Low: "#34D399",
};
export const NEUTRAL = "#4B5874";
export const CYAN = "#22D3EE";
export const VIOLET = "#A78BFA";

export const riskOrder: Record<RiskCategory, number> = { High: 3, Medium: 2, Low: 1 };

export const shortAddr = (a: string, head = 8, tail = 6) =>
  a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;

export const fmtBtc = (v: number, digits = 4) =>
  `${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits })} BTC`;

export const fmtNum = (v: number, digits = 0) =>
  v.toLocaleString(undefined, { maximumFractionDigits: digits });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  }) + " UTC";

export const fmtShortDate = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
