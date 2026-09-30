import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { RISK_COLOR } from "@/lib/utils";
import type { RiskCategory } from "@/types/api";

function categoryOf(score: number): RiskCategory {
  return score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";
}

/** Radial 0–100 arc. Color is the category threshold color, not a gradient (PRD §6.3). */
export function RiskGauge({ score, size = 148, stroke = 10, label = "Risk score" }: {
  score: number; size?: number; stroke?: number; label?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? score : 0);
  const color = RISK_COLOR[categoryOf(score)];
  const r = (size - stroke) / 2;
  const arc = 0.75; // 270° gauge
  const circ = 2 * Math.PI * r;
  const track = circ * arc;

  useEffect(() => {
    if (reduce) { setDisplay(score); return; }
    const controls = animate(0, score, { duration: 0.6, ease: "easeOut", onUpdate: setDisplay });
    return () => controls.stop();
  }, [score, reduce]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score.toFixed(0)} of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(135deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#232B3D" strokeWidth={stroke}
          strokeDasharray={`${track} ${circ}`} strokeLinecap="round" />
        <motion.circle
          key={score}
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${track} ${circ}`}
          initial={{ strokeDashoffset: reduce ? track * (1 - score / 100) : track }}
          animate={{ strokeDashoffset: track * (1 - score / 100) }}
          transition={{ duration: reduce ? 0 : 0.6, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold tabular-nums leading-none" style={{ fontSize: size * 0.26 }}>
          {Math.round(display)}
        </span>
        {size >= 100 && <span className="mt-1 text-[11px] text-secondary">/ 100</span>}
      </div>
    </div>
  );
}
