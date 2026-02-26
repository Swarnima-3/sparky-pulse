import { useMemo } from "react";
import { motion } from "framer-motion";
import { ProductBrief, BrandName } from "@/lib/npd-engine";

interface OpportunityRadarProps {
  briefs: ProductBrief[];
  brand: BrandName;
}

const brandColorMap: Record<BrandName, { dot: string; glow: string }> = {
  "Man Matters": { dot: "bg-[hsl(174,62%,40%)]", glow: "shadow-[0_0_12px_hsl(174,62%,40%/0.5)]" },
  "Be Bodywise": { dot: "bg-[hsl(340,65%,55%)]", glow: "shadow-[0_0_12px_hsl(340,65%,55%/0.5)]" },
  "Little Joys": { dot: "bg-[hsl(38,80%,55%)]", glow: "shadow-[0_0_12px_hsl(38,80%,55%/0.5)]" },
};

export function OpportunityRadar({ briefs, brand }: OpportunityRadarProps) {
  const data = useMemo(() => {
    return briefs.map((b) => ({
      name: b.dynamicName,
      x: b.signalStrength,
      y: b.evidence.competitionDensity === "High" ? 3 : b.evidence.competitionDensity === "Medium" ? 2 : 1,
      score: b.opportunityScore,
      isBlueOcean: b.opportunityType === "Blue Ocean",
      brief: b,
    }));
  }, [briefs]);

  const maxX = Math.max(...data.map((d) => d.x), 10);
  const colors = brandColorMap[brand];

  return (
    <div className="rounded-2xl border border-border bg-[#111827]/90 backdrop-blur-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-sm font-bold text-white">Friction vs Competition</h3>
          <p className="text-xs text-white/50">Bubble size = Opportunity Score · Blue glow = Blue Ocean</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
            Blue Ocean
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            Optimization
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative w-full h-64 border-l border-b border-white/10">
        {/* Y axis labels */}
        <div className="absolute -left-1 top-0 h-full flex flex-col justify-between text-[9px] text-white/40 -translate-x-full pr-2">
          <span>High</span>
          <span>Medium</span>
          <span>Low</span>
        </div>

        {/* X axis label */}
        <div className="absolute bottom-0 left-0 w-full translate-y-full pt-2 text-center text-[9px] text-white/40">
          Consumer Friction (Signal Strength) →
        </div>

        {/* Y axis title */}
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-white/40 whitespace-nowrap">
          Competition ↑
        </div>

        {/* Grid lines */}
        <div className="absolute inset-0">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="absolute w-full border-t border-white/5"
              style={{ top: `${(i / 3) * 100}%` }}
            />
          ))}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute h-full border-l border-white/5"
              style={{ left: `${(i / 5) * 100}%` }}
            />
          ))}
        </div>

        {/* Data points */}
        {data.map((d, i) => {
          const xPct = Math.min((d.x / maxX) * 90 + 5, 95);
          const yPct = 100 - ((d.y / 3.5) * 90 + 5);
          const size = Math.max(16, Math.min(d.score * 5, 44));

          return (
            <motion.div
              key={d.name + i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className="absolute group"
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                className={`rounded-full flex items-center justify-center text-[8px] font-bold text-white cursor-default transition-all duration-200 hover:scale-125 ${
                  d.isBlueOcean
                    ? "bg-emerald-500 shadow-[0_0_14px_rgba(52,211,153,0.6)]"
                    : `${colors.dot} ${colors.glow}`
                }`}
                style={{ width: size, height: size }}
              >
                {d.score.toFixed(0)}
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white whitespace-nowrap shadow-xl">
                  <p className="font-bold">{d.name}</p>
                  <p className="text-white/60">
                    Score: {d.score}/10 · {d.isBlueOcean ? "🌊 Blue Ocean" : "⚙️ Optimization"}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
