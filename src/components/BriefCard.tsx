import { useState } from "react";
import { ProductBrief, BrandName, generateProductBriefDraft } from "@/lib/npd-engine";
import { FlaskConical, Quote, Target, User, Tag, TrendingUp, Swords, Beaker, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, FileText, ExternalLink } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

const brandGlassMap: Record<BrandName, string> = {
  "Man Matters": "border-l-[hsl(174,62%,40%)] bg-gradient-to-br from-[hsl(174,50%,95%)]/80 to-card/90",
  "Be Bodywise": "border-l-[hsl(340,65%,55%)] bg-gradient-to-br from-[hsl(340,50%,96%)]/80 to-card/90",
  "Little Joys": "border-l-[hsl(38,80%,55%)] bg-gradient-to-br from-[hsl(38,60%,95%)]/80 to-card/90",
};

const brandAccentMap: Record<BrandName, string> = {
  "Man Matters": "text-[hsl(174,62%,40%)]",
  "Be Bodywise": "text-[hsl(340,65%,55%)]",
  "Little Joys": "text-[hsl(38,80%,55%)]",
};

const brandBadgeMap: Record<BrandName, string> = {
  "Man Matters": "bg-[hsl(174,62%,40%)] text-white",
  "Be Bodywise": "bg-[hsl(340,65%,55%)] text-white",
  "Little Joys": "bg-[hsl(38,80%,55%)] text-white",
};

interface BriefCardProps {
  brief: ProductBrief;
  brand: BrandName;
  index: number;
  showEvidenceAndDraft?: boolean;
}

export default function BriefCard({ brief, brand, index, showEvidenceAndDraft }: BriefCardProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false);
  const [draftContent, setDraftContent] = useState<string | null>(null);

  const handleGenerateBrief = () => {
    const md = generateProductBriefDraft(brief);
    setDraftContent(md);
    setDraftGenerated(true);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brief.dynamicName.replace(/\s+/g, "_")}_Brief.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className={`relative rounded-2xl border border-border/50 border-l-4 ${brandGlassMap[brand]} p-6 opacity-0 animate-fade-in-up backdrop-blur-md shadow-sm hover:shadow-lg transition-all duration-300`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {brief.opportunityType && (
              <span
                className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  brief.opportunityType === "Blue Ocean"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {brief.opportunityType}
              </span>
            )}
            {brief.isDecisionReady && (
              <span className="text-[10px] uppercase tracking-widest font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Decision Ready
              </span>
            )}
            {brief.isLowSignal && (
              <span className="text-[10px] uppercase tracking-widest font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Low Signal — R&D Required
              </span>
            )}
          </div>
          <h3 className="font-display text-lg font-bold text-foreground leading-tight">
            {brief.dynamicName}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">ref: {brief.conceptName}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${brief.isDecisionReady ? "bg-emerald-500 text-white" : brandBadgeMap[brand]}`}>
            <TrendingUp className="inline w-3 h-3 mr-1 -mt-0.5" />
            {brief.opportunityScore}/10
          </span>
        </div>
      </div>

      <div className="space-y-3.5">
        <Row icon={User} label="Target Consumer" accentClass={brandAccentMap[brand]}>
          <p className="text-sm text-foreground/85">{brief.persona}</p>
        </Row>
        <Row icon={Target} label="White Space" accentClass={brandAccentMap[brand]}>
          <p className="text-sm text-foreground">{brief.whiteSpace}</p>
        </Row>
        <Row icon={Beaker} label="Format & Formulation" accentClass={brandAccentMap[brand]}>
          <p className="text-sm text-foreground/85">
            <span className="font-semibold">{brief.format}</span> — {brief.ingredients.join(", ")}
          </p>
        </Row>
        <Row icon={Tag} label="Suggested MRP" accentClass={brandAccentMap[brand]}>
          <p className="text-sm font-semibold text-foreground">{brief.mrpRange}</p>
        </Row>
        <Row icon={Swords} label="Competitive Positioning" accentClass={brandAccentMap[brand]}>
          <p className="text-sm text-foreground/80">{brief.positioning}</p>
        </Row>
        <Row icon={Quote} label="Consumer Evidence" accentClass={brandAccentMap[brand]}>
          <p className="text-sm text-foreground/75 italic line-clamp-2">"{brief.citation}"</p>
        </Row>
        <Row icon={FlaskConical} label="Active Ingredients" accentClass={brandAccentMap[brand]}>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {brief.ingredients.map((ing) => (
              <span
                key={ing}
                className="text-xs px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground font-medium backdrop-blur-sm"
              >
                {ing}
              </span>
            ))}
          </div>
        </Row>
      </div>

      {/* Evidence Panel (Audit Trail) */}
      <div className="mt-5 p-3 rounded-lg bg-muted/60 border border-border/50">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Audit Trail</h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground">Marketplace Hits</p>
            <p className="font-display font-bold text-sm text-foreground">{brief.evidence.marketplaceHits} Rows</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Reddit Buzz</p>
            <p className="font-display font-bold text-sm text-foreground">{brief.evidence.redditBuzz} Mentions</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Competition</p>
            <p className={`font-display font-bold text-sm ${
              brief.evidence.competitionDensity === "High" ? "text-destructive" :
              brief.evidence.competitionDensity === "Medium" ? "text-[hsl(38,80%,55%)]" : "text-emerald-600"
            }`}>{brief.evidence.competitionDensity}</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-[10px] font-mono text-muted-foreground">Formula: {brief.evidence.formulaString}</p>
        </div>

        {showEvidenceAndDraft && (brief.evidence.evidenceSnippet || brief.evidence.sourceUrl) && (
          <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen} className="mt-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-8">
                Evidence — Reddit snippet / source
                {evidenceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 rounded-md bg-background/80 border border-border/50 text-xs text-foreground/90 whitespace-pre-wrap">
                {brief.evidence.evidenceSnippet ?? brief.citation}
              </div>
              {brief.evidence.sourceUrl && (
                <a
                  href={brief.evidence.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open source
                </a>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {showEvidenceAndDraft && (
          <Button
            onClick={handleGenerateBrief}
            variant="outline"
            size="sm"
            className="mt-3 w-full gap-2"
          >
            <FileText className="w-4 h-4" />
            {draftGenerated ? "Product Brief generated" : "Generate Product Brief"}
          </Button>
        )}
      </div>

      {/* Glassmorphism shimmer accent */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl" />
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  accentClass,
  children,
}: {
  icon: React.ElementType;
  label: string;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${accentClass}`} />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}
