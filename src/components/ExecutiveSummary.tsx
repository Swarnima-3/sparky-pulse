import { motion } from "framer-motion";
import { TrendingUp, Crosshair, Lightbulb } from "lucide-react";
import { ProductBrief, BrandName } from "@/lib/npd-engine";

interface ExecutiveSummaryProps {
  briefs: ProductBrief[];
  brand: BrandName;
}

interface SummaryPoint {
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  text: string;
}

function buildSummary(topBrief: ProductBrief, brand: BrandName): SummaryPoint[] {
  const painPoint: SummaryPoint = {
    icon: TrendingUp,
    label: "Pain Point",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    text: `Top consumer friction detected for ${brand}: "${topBrief.whiteSpace}". Signal strength: ${topBrief.signalStrength}/10 with ${topBrief.evidence.redditBuzz} Reddit mentions and ${topBrief.evidence.marketplaceHits} marketplace data points.`,
  };

  const competitionLabel =
    topBrief.evidence.competitionDensity === "Low"
      ? "low competition density — a clear Blue Ocean"
      : topBrief.evidence.competitionDensity === "Medium"
      ? "moderate competition, with room to differentiate"
      : "high competition, requiring a strong unique value proposition";

  const marketGap: SummaryPoint = {
    icon: Crosshair,
    label: "Market Gap",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
    text: `"${topBrief.dynamicName}" targets an unserved segment with ${competitionLabel}. ${topBrief.evidence.marketplaceHits} marketplace rows confirm consumer demand is real and unmet. Opportunity score: ${topBrief.opportunityScore}/10.`,
  };

  const recommendation: SummaryPoint = {
    icon: Lightbulb,
    label: "Recommendation",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: `Prioritise ${topBrief.isDecisionReady ? "immediate R&D initiation" : "exploratory R&D validation"} for "${topBrief.dynamicName}" — ${topBrief.format} with ${topBrief.ingredients.slice(0, 3).join(", ")}. Suggested MRP: ${topBrief.mrpRange}. Positioning: ${topBrief.positioning}`,
  };

  return [painPoint, marketGap, recommendation];
}

export default function ExecutiveSummary({ briefs, brand }: ExecutiveSummaryProps) {
  if (!briefs || briefs.length === 0) return null;

  const topBrief = [...briefs].sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
  const points = buildSummary(topBrief, brand);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-[#111827]/90 backdrop-blur-md p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-white">
            Executive Summary
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Derived from top signal · <span className="font-semibold text-white/70">{topBrief.dynamicName}</span> · Score {topBrief.opportunityScore}/10
          </p>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
            topBrief.opportunityType === "Blue Ocean"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          }`}
        >
          {topBrief.opportunityType}
        </span>
      </div>

      <div className="space-y-3">
        {points.map((point, i) => {
          const Icon = point.icon;
          return (
            <motion.div
              key={point.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.35 }}
              className={`flex items-start gap-3 rounded-xl border p-4 ${point.bg}`}
            >
              <div className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <Icon className={`w-4 h-4 ${point.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${point.color}`}>
                  {point.label}
                </p>
                <p className="text-sm text-white/80 leading-relaxed">{point.text}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
