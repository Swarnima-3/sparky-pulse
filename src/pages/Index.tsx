import { useState, useCallback, useMemo } from "react";
import {
  BrandName,
  AnalysisResult,
  LivePulseResult,
  ProductBrief,
  runAnalysis,
  runLivePulseAnalysis,
  generateExecutiveSummary,
  generateMarkdownReport,
} from "@/lib/npd-engine";
import { simulateLiveSearch } from "@/lib/live-pulse-engine";
import BrandSelector from "@/components/BrandSelector";
import CsvUploader from "@/components/CsvUploader";
import BriefCard from "@/components/BriefCard";
import LivePulseStatusBar from "@/components/LivePulseStatusBar";
import { OpportunityRadar } from "@/components/OpportunityRadar";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import {
  Rocket,
  AlertTriangle,
  Sparkles,
  Database,
  ScanSearch,
  Zap,
  Download,
  Shield,
  BarChart3,
  Star,
  FileCheck,
  Flame,
  Target,
  Wrench,
  ChevronDown,
  Radio,
  History,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

/* ── Swimlane classification ── */

type Swimlane = "high-signal" | "competitor-gaps" | "portfolio-v2";

interface LaneMeta {
  id: Swimlane;
  emoji: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
}

const LANES: LaneMeta[] = [
  {
    id: "high-signal",
    emoji: "🚀",
    title: "High-Signal Innovation",
    subtitle: "Decision-ready concepts with strong consumer evidence and high opportunity scores",
    icon: Flame,
    accent: "border-l-emerald-500",
  },
  {
    id: "competitor-gaps",
    emoji: "🎯",
    title: "Competitor Love-Mark Gaps",
    subtitle: "Blue-ocean opportunities where competition density is low or medium",
    icon: Target,
    accent: "border-l-sky-500",
  },
  {
    id: "portfolio-v2",
    emoji: "🔧",
    title: "Portfolio V2 Optimization",
    subtitle: "Exploratory extensions and iterative product-line improvements",
    icon: Wrench,
    accent: "border-l-amber-500",
  },
];

function classifyBrief(brief: ProductBrief): Swimlane {
  // Guard against SEO noise/hallucinations — demote to V2
  const isNoise = /Best|Top|Offers|Sale|Amazon|2026|Discount|Review/i.test(brief.dynamicName || brief.conceptName);
  if (isNoise) return "portfolio-v2";

  if (brief.isDecisionReady || brief.opportunityScore > 8.5) return "high-signal";
  if (
    (brief.evidence.competitionDensity === "Low" || brief.evidence.competitionDensity === "Medium") &&
    !brief.isExploratory
  )
    return "competitor-gaps";
  return "portfolio-v2";
}

function partitionBriefs(briefs: ProductBrief[]) {
  const lowPriority: ProductBrief[] = [];
  const laneMap: Record<Swimlane, ProductBrief[]> = {
    "high-signal": [],
    "competitor-gaps": [],
    "portfolio-v2": [],
  };

  for (const b of briefs) {
    if (b.isLowSignal) {
      lowPriority.push(b);
    } else {
      laneMap[classifyBrief(b)].push(b);
    }
  }
  return { laneMap, lowPriority };
}

/* ── Page ── */

export default function Index() {
  const [selectedBrand, setSelectedBrand] = useState<BrandName | null>(null);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvName, setCsvName] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [liveResult, setLiveResult] = useState<LivePulseResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLiveScanning, setIsLiveScanning] = useState(false);
  const [lowPriorityOpen, setLowPriorityOpen] = useState(false);

  const handleDataLoaded = useCallback((rows: Record<string, string>[], fileName: string) => {
    setCsvRows(rows);
    setCsvName(fileName);
    setResult(null);
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!selectedBrand || csvRows.length === 0) return;
    setLiveResult(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      const res = runAnalysis(selectedBrand, csvRows);
      setResult(res);
      setIsAnalyzing(false);
      setLowPriorityOpen(false);
    }, 800);
  }, [selectedBrand, csvRows]);

  const handleLiveScan = useCallback(async () => {
    if (!selectedBrand) return;
    setIsLiveScanning(true);
    setLiveResult(null);
    setResult(null);
    try {
      const signals = await simulateLiveSearch(selectedBrand);
      const res = runLivePulseAnalysis(selectedBrand, signals);
      setLiveResult(res);
    } finally {
      setIsLiveScanning(false);
    }
  }, [selectedBrand]);

  const handleDownload = useCallback(() => {
    const data = result ?? liveResult;
    if (!data || "rawSignals" in data) return;
    const md = generateMarkdownReport(data);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.brand.replace(/\s+/g, "_")}_NPD_Report.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [result, liveResult]);

  const { laneMap, lowPriority } = useMemo(() => {
    const briefs = liveResult?.briefs ?? result?.briefs ?? [];
    return briefs.length
      ? partitionBriefs(briefs)
      : { laneMap: { "high-signal": [], "competitor-gaps": [], "portfolio-v2": [] }, lowPriority: [] };
  }, [result, liveResult]);

  const canAnalyze = selectedBrand && csvRows.length > 0;
  const canLiveScan = !!selectedBrand;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-foreground leading-none">
              Mosaic Pulse
            </h1>
            <p className="text-xs text-muted-foreground">
              NPD Command Center · Live Signal + Historical · 2026
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <section>
          <StepHeader number={1} title="Select Brand" subtitle="Man Matters, Be Bodywise, Little Joys" />
          <BrandSelector selected={selectedBrand} onSelect={setSelectedBrand} />
        </section>

        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="live" className="gap-2">
              <Radio className="w-4 h-4" />
              Live Pulse
            </TabsTrigger>
            <TabsTrigger value="historical" className="gap-2">
              <History className="w-4 h-4" />
              Historical Data
            </TabsTrigger>
          </TabsList>

          {/* ── Live Pulse Tab ── */}
          <TabsContent value="live" className="space-y-8 mt-0">
            <section>
              <StepHeader
                number={2}
                title="Live Pulse Feed"
                subtitle="Scan Reddit, Google Trends & competitor review gaps for friction keywords"
              />
              <LivePulseStatusBar
                isScanning={isLiveScanning}
                signalsCount={liveResult?.rawSignals?.length ?? 0}
              />
              <div className="mt-4 flex justify-center">
                <motion.button
                  onClick={handleLiveScan}
                  disabled={!canLiveScan || isLiveScanning}
                  whileHover={canLiveScan && !isLiveScanning ? { scale: 1.02 } : {}}
                  whileTap={canLiveScan && !isLiveScanning ? { scale: 0.98 } : {}}
                  className={`inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-display font-semibold text-base transition-all duration-200 ${
                    canLiveScan && !isLiveScanning
                      ? "bg-primary text-primary-foreground hover:opacity-90 shadow-lg hover:shadow-xl"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <Radio className={`w-5 h-5 ${isLiveScanning ? "animate-pulse" : ""}`} />
                  {isLiveScanning ? "Scanning Internet…" : "Start Live Scan"}
                </motion.button>
              </div>
            </section>

            <AnimatePresence mode="wait">
              {liveResult && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  {liveResult.noData ? (
                    <div className="rounded-xl border border-border bg-card p-8 text-center">
                      <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                      <h3 className="font-display text-lg font-bold text-foreground mb-1">
                        No Signals Yet
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Run a Live Scan to ingest signals from Reddit, Google Trends and competitor gaps.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <StatPill icon={Database} label="Signals Ingested" value={liveResult.stats.signalsIngested} />
                          <StatPill icon={Zap} label="Blue Ocean" value={liveResult.stats.blueOceanCount} />
                          <StatPill icon={Target} label="Optimization" value={liveResult.stats.optimizationCount} />
                        </div>
                      </div>

                      <div>
                        <StepHeader number={3} title="Executive Summary" subtitle="Dynamic 3-point brief from top-scoring signal" />
                        <ExecutiveSummary briefs={liveResult.briefs} brand={liveResult.brand} />
                      </div>

                      <div>
                        <StepHeader number={4} title="Opportunity Radar" subtitle="Friction vs Competition — Blue Ocean bubbles glow" />
                        <OpportunityRadar briefs={liveResult.briefs} brand={liveResult.brand} />
                      </div>

                      <div>
                        <StepHeader
                          number={5}
                          title="Product Recommendations"
                          subtitle={`${liveResult.briefs.length} opportunities · Expand Evidence for source snippet`}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          {liveResult.briefs.map((brief, i) => (
                            <BriefCard
                              key={brief.dynamicName + i}
                              brief={brief}
                              brand={liveResult.brand}
                              index={i}
                              showEvidenceAndDraft
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── Historical Data Tab ── */}
          <TabsContent value="historical" className="space-y-8 mt-0">
            <section>
              <StepHeader
                number={2}
                title="Upload Consumer Data"
                subtitle="CSV with consumer reviews, Reddit posts, or survey responses"
              />
              <CsvUploader onDataLoaded={handleDataLoaded} />
            </section>

            <section className="flex justify-center">
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze || isAnalyzing}
                className={`inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-display font-semibold text-base transition-all duration-200 ${
                  canAnalyze
                    ? "bg-foreground text-background hover:opacity-90 shadow-lg hover:shadow-xl active:scale-[0.98]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                <Rocket className={`w-5 h-5 ${isAnalyzing ? "animate-bounce" : ""}`} />
                {isAnalyzing ? "Analyzing…" : "Generate Decision Pipeline"}
              </button>
            </section>

            {result && (
              <section className="space-y-8 animate-fade-in-up">
                {result.noData ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <h3 className="font-display text-lg font-bold text-foreground mb-1">
                      No Specific Gaps Found
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      No specific gaps found for <strong>{result.brand}</strong> in this dataset.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md p-5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatPill icon={Database} label="Datasets Analyzed" value={result.stats.datasetsAnalyzed} />
                        <StatPill icon={ScanSearch} label="Rows Scanned" value={result.stats.totalRows.toLocaleString()} />
                        <StatPill icon={Zap} label="High-Intensity Gaps" value={result.stats.highIntensityGaps} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display text-xl font-bold text-foreground">Decision Pipeline</h2>
                        <p className="text-sm text-muted-foreground">
                          {result.briefs.length} concepts for {result.brand} · Source: {csvName}
                        </p>
                      </div>
                      <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background font-display font-semibold text-sm hover:opacity-90 transition-opacity"
                      >
                        <Download className="w-4 h-4" />
                        Download Report
                      </button>
                    </div>

                    <div>
                      <StepHeader number={3} title="Executive Summary" subtitle="Dynamic 3-point brief from top-scoring signal" />
                      <ExecutiveSummary briefs={result.briefs} brand={result.brand} />
                    </div>

                    <div>
                      <StepHeader number={4} title="Opportunity Radar" subtitle="Friction vs Competition — Blue Ocean bubbles glow" />
                      <OpportunityRadar briefs={result.briefs} brand={result.brand} />
                    </div>

                    {LANES.map((lane) => (
                      <SwimLane
                        key={lane.id}
                        lane={lane}
                        briefs={laneMap[lane.id]}
                        brand={result.brand}
                        showEvidenceAndDraft={false}
                      />
                    ))}

                    {lowPriority.length > 0 && (
                      <div className="space-y-4">
                        <button
                          onClick={() => setLowPriorityOpen((o) => !o)}
                          className="w-full flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-5 py-4 text-left transition-colors hover:bg-muted/60"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                            </span>
                            <div>
                              <h3 className="font-display text-sm font-bold text-muted-foreground">
                                Low Priority · {lowPriority.length} concept{lowPriority.length > 1 ? "s" : ""}
                              </h3>
                              <p className="text-xs text-muted-foreground/70">
                                Low-signal items requiring further R&D validation
                              </p>
                            </div>
                          </div>
                          <ChevronDown
                            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${lowPriorityOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {lowPriorityOpen && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in-up">
                            {lowPriority.map((brief, i) => (
                              <BriefCard
                                key={brief.conceptName + i}
                                brief={brief}
                                brand={result.brand}
                                index={i}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <LegacyExecutiveSummary result={result} />
                  </>
                )}
              </section>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SwimLane({
  lane,
  briefs,
  brand,
  showEvidenceAndDraft,
}: {
  lane: LaneMeta;
  briefs: ProductBrief[];
  brand: BrandName;
  showEvidenceAndDraft?: boolean;
}) {
  const Icon = lane.icon;

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 border-l-4 ${lane.accent} pl-4`}>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0 mt-0.5">
          <Icon className="w-5 h-5 text-foreground" />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-foreground leading-tight">
            {lane.emoji} {lane.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{lane.subtitle}</p>
        </div>
        <span className="ml-auto shrink-0 text-xs font-bold text-muted-foreground bg-muted rounded-full px-2.5 py-1 mt-1">
          {briefs.length}
        </span>
      </div>

      {briefs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground font-medium">No Gaps Identified</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {briefs.map((brief, i) => (
            <BriefCard
              key={brief.conceptName + i}
              brief={brief}
              brand={brand}
              index={i}
              showEvidenceAndDraft={showEvidenceAndDraft}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StepHeader({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-foreground text-background text-xs font-bold font-display">
        {number}
      </span>
      <div>
        <h2 className="font-display text-base font-bold text-foreground leading-none">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="w-9 h-9 rounded-lg bg-foreground/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-foreground" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-bold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

function LegacyExecutiveSummary({ result }: { result: AnalysisResult }) {
  const summary = generateExecutiveSummary(result);

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md p-8 space-y-6">
      <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
        <Star className="w-5 h-5 text-[hsl(38,80%,55%)]" />
        Strategic Executive Summary (Audit Grade)
      </h2>

      <div className="space-y-5">
        <SummaryBlock icon={FileCheck} title="Data Integrity" text={summary.dataIntegrity} />
        <SummaryBlock icon={BarChart3} title="Opportunity Score Logic" text={summary.opportunityLogic} />
        <SummaryBlock icon={Shield} title="Format Compliance" text={summary.formatCompliance} />
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-foreground" />
            <h3 className="font-display text-sm font-bold text-foreground">High-Priority for Immediate R&D</h3>
          </div>
          <ul className="space-y-1.5 ml-6">
            {summary.highPriority.map((item, i) => (
              <li key={i} className="text-sm text-foreground/85 list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-foreground" />
        <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed ml-6">{text}</p>
    </div>
  );
}
