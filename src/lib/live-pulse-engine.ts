/**
 * Live Pulse Ingestion Engine — "The Listening Post"
 * Real-time search via Tavily API; fallback to simulated data on API failure.
 */

import type { BrandName, LiveSignalInput } from "./npd-engine";

export const FRICTION_KEYWORDS = [
  "nothing works", "too expensive", "hard water", "hard water issues",
  "alternative to", "waste of money", "don't buy", "stopped using",
  "didn't work", "still have", "no results", "desperate", "tried everything",
  "any recommendations", "please help", "crying", "frustrated", "give up",
  "patchy", "hormonal acne", "post workout", "hair fall", "dandruff",
  "pediatrician warned", "doctor said", "picky eater", "refuses to eat",
  "not gaining weight", "below average height", "nutritional gap",
  "won't swallow", "spits out", "worried about growth", "percentile dropped",
] as const;

export type LiveSignalSource = "reddit" | "google_trends" | "competitor_gap";

export interface RawLiveSignal {
  id: string;
  issue: string;
  pain_intensity: number;
  frequency_count: number;
  source_url: string;
  source: LiveSignalSource;
  raw_text: string;
  detected_friction_keywords: string[];
  source_meta?: string;
}

interface BrandGuardrails {
  allowedTopics?: string[];
  blockedTerms: string[];
}

const BRAND_MAP: Record<BrandName, BrandGuardrails> = {
  "Man Matters": {
    allowedTopics: ["hair", "beard", "performance", "dandruff", "scalp", "minoxidil", "grooming", "ed", "testosterone", "stamina", "energy", "gym"],
    blockedTerms: ["kids", "baby", "toddler", "infant", "pcos", "pregnancy", "nutrition children"],
  },
  "Be Bodywise": {
    allowedTopics: ["skin", "pcos", "body", "acne", "hormonal", "period", "women", "face", "brightening", "kp", "strawberry", "serum", "moisturiser"],
    blockedTerms: ["beard", "minoxidil", "kids", "baby", "toddler", "infant", "height growth"],
  },
  "Little Joys": {
    allowedTopics: ["kids", "children", "baby", "toddler", "infant", "nutrition", "growth", "mom", "mother", "parent", "supplement", "height", "picky", "iron", "vitamin", "omega", "gut", "sleep", "eye", "sugar", "school", "snack", "immunity"],
    blockedTerms: ["hair fall", "hair loss", "beard", "dandruff", "erectile", "pcos", "minoxidil", "scalp", "acne"],
  },
};

/* ── Noise filters ───────────────────────────────────────────────────────────
 * Reject titles that are subreddit metadata, SEO pages, or dev noise.
 * ────────────────────────────────────────────────────────────────────────── */
const TITLE_BLACKLIST_PATTERNS = [
  /r\//i,
  /\bwiki\b/i,
  /node_modules/i,
  /\.coffee|\.js|\.ts\b/i,
  /frequency.list/i,
  /app\.aspell/i,
  /admin.message/i,
  /privacy.polic/i,
  /terms.of.service/i,
  /cookie.polic/i,
  /^https?:\/\//i,
  /^\s*[\W\d]+\s*$/,
];

const SEO_NOISE_WORDS = [
  "best", "top", "vs", "review", "buy now", "discount", "% off",
  "amazon", "flipkart", "myntra", "nykaa", "shop", "price", "offer",
];

function isBadTitle(title: string): boolean {
  if (!title || title.trim().length < 5) return true;
  if (TITLE_BLACKLIST_PATTERNS.some((re) => re.test(title))) return true;
  const lower = title.toLowerCase();
  if (SEO_NOISE_WORDS.filter((w) => lower.includes(w)).length >= 2) return true;
  const specialCharRatio = (title.match(/[^a-zA-Z0-9\s\-']/g) ?? []).length / title.length;
  if (specialCharRatio > 0.25) return true;
  return false;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-|·•]\s*Reddit.*$/i, "")
    .replace(/\s*\|\s*r\/\w+/i, "")
    .replace(/^\s*\[.*?\]\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function scorePainIntensity(text: string): number {
  const lower = text.toLowerCase();
  const hits = FRICTION_KEYWORDS.filter((k) => lower.includes(k)).length;
  return Math.min(5 + hits * 0.5, 9);
}

function scoreFrequency(text: string): number {
  const lower = text.toLowerCase();
  const upvoteMatch = lower.match(/(\d+)\s*(?:upvotes?|points?|votes?)/);
  if (upvoteMatch) return Math.min(parseInt(upvoteMatch[1], 10), 50);
  const commentMatch = lower.match(/(\d+)\s*comments?/);
  if (commentMatch) return Math.max(Math.min(parseInt(commentMatch[1], 10) * 2, 50), 5);
  if (lower.includes("rising") || lower.includes("trending") || lower.includes("yoy")) return 35;
  const frictionHits = FRICTION_KEYWORDS.filter((k) => lower.includes(k)).length;
  return Math.max(frictionHits * 4, 5);
}

function passesBrandGuardrail(
  brand: BrandName,
  signal: { issue: string; raw_text: string }
): boolean {
  const guardrails = BRAND_MAP[brand];
  const combined = `${signal.issue} ${signal.raw_text}`.toLowerCase();
  for (const term of guardrails.blockedTerms) {
    if (combined.includes(term.toLowerCase())) return false;
  }
  if (guardrails.allowedTopics && guardrails.allowedTopics.length > 0) {
    return guardrails.allowedTopics.some((topic) => combined.includes(topic.toLowerCase()));
  }
  return true;
}

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

const TAVILY_API_KEY = "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";

const BRAND_QUERIES: Record<BrandName, string> = {
  "Man Matters": "Reddit India men hair fall hard water beard growth dandruff scalp issues consumer frustration 2026",
  "Be Bodywise": "Reddit India women PCOS hormonal acne strawberry skin period pain skincare frustration consumer gaps 2026",
  "Little Joys": "Reddit Indian parents picky eater kids nutrition height growth immunity supplement gaps 2026",
};

function generateId(): string {
  return `lp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface TavilyResultItem {
  title?: string;
  content?: string;
  url?: string;
}

interface TavilySearchResponse {
  results?: TavilyResultItem[];
  answer?: string;
  query?: string;
  responseTime?: number;
}

export async function simulateLiveSearch(brand: BrandName): Promise<LiveSignalInput[]> {
  try {
    if (!TAVILY_API_KEY) {
      return getSimulatedSignalsAsInput(brand);
    }

    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: BRAND_QUERIES[brand],
        max_results: 20,
        search_depth: "advanced",
        include_answer: true,
      }),
    });

    if (!res.ok) throw new Error(`Tavily API error: ${res.status}`);

    const data = (await res.json()) as TavilySearchResponse;
    const results = data.results ?? [];

    const signals: LiveSignalInput[] = results
      .map((r, i) => {
        const rawTitle = (r.title ?? "").trim();
        const rawText = (r.content ?? r.title ?? "").trim();
        const cleanedTitle = cleanTitle(rawTitle);
        const issue = isBadTitle(cleanedTitle)
          ? `Live Signal ${i + 1}`
          : cleanedTitle;

        return {
          id: generateId(),
          issue,
          pain_intensity: scorePainIntensity(rawText),
          frequency_count: scoreFrequency(rawText),
          source_url: r.url ?? "",
          raw_text: rawText,
          source_meta: "Reddit/Live Web",
        };
      })
      .filter((s) => s.raw_text.length > 30)
      .filter((s) => !s.issue.startsWith("Live Signal"))
      .filter((s) => passesBrandGuardrail(brand, s));

    // Backfill with simulated if Tavily returns fewer than 5 clean signals
    if (signals.length < 5) {
      const sim = getSimulatedSignalsAsInput(brand);
      return [...signals, ...sim].slice(0, 10);
    }

    return signals.slice(0, 10);
  } catch (_err) {
    return getSimulatedSignalsAsInput(brand);
  }
}

function getSimulatedSignalsAsInput(brand: BrandName): LiveSignalInput[] {
  return getSimulatedSignals(brand)
    .filter((r) => passesBrandGuardrail(brand, { issue: r.issue, raw_text: r.raw_text }))
    .map((r) => ({
      id: r.id,
      issue: r.issue,
      pain_intensity: r.pain_intensity,
      frequency_count: r.frequency_count,
      source_url: r.source_url,
      raw_text: r.raw_text,
      source_meta: r.source_meta ?? "Reddit/Live Web",
    }));
}

function getSimulatedSignals(brand: BrandName): RawLiveSignal[] {
  if (brand === "Little Joys") {
    return [
      { id: generateId(), issue: "Kids Height Growth Stagnation", pain_intensity: 9, frequency_count: 44, source_url: "https://reddit.com/r/IndianParenting/comments/sim_height_growth", source: "reddit", raw_text: "My 6-year-old isn't growing as expected. Pediatrician says nutrition is key but I can't get him to eat vegetables. Tried everything — gummies, powders, nothing works. Any recommendations from other moms?", detected_friction_keywords: ["tried everything", "nothing works"], source_meta: "r/IndianParenting" },
      { id: generateId(), issue: "Toddler Iron Deficiency Anxiety", pain_intensity: 8, frequency_count: 31, source_url: "https://reddit.com/r/Mommit/comments/sim_iron", source: "reddit", raw_text: "Pediatrician flagged low iron in my toddler. The supplements taste horrible and she refuses. Crying every dose time. Desperate for a kids-friendly iron supplement that doesn't taste like metal.", detected_friction_keywords: ["crying", "desperate"], source_meta: "r/Mommit" },
      { id: generateId(), issue: "Post-Monsoon Immunity Sick Cycles", pain_intensity: 8, frequency_count: 29, source_url: "https://reddit.com/r/IndianParenting/comments/sim_immunity", source: "reddit", raw_text: "Every monsoon my kids get sick back-to-back. Started them on Vitamin C + Zinc but it didn't work. Too expensive to keep buying supplements that don't hold. Need budget-friendly immunity booster for children.", detected_friction_keywords: ["didn't work", "too expensive"], source_meta: "r/IndianParenting" },
      { id: generateId(), issue: "Fussy Eater Nutrition Gap", pain_intensity: 7, frequency_count: 38, source_url: "https://trends.google.com/trends/explore?q=nutrition+supplement+kids+india", source: "google_trends", raw_text: "Search spike: 'nutrition powder for kids India', 'healthy snacks for picky eaters', 'hidden vegetable recipes toddlers'. Rising 210% YoY.", detected_friction_keywords: [], source_meta: "India" },
      { id: generateId(), issue: "Kids Omega-3 Fishy Aftertaste Problem", pain_intensity: 7, frequency_count: 25, source_url: "https://reddit.com/r/BabyBumps/comments/sim_omega3", source: "competitor_gap", raw_text: "No good kids omega-3 on Amazon India without fishy aftertaste. Parents frustrated — stopped giving after children refused. Need a palatable DHA for kids 2–8.", detected_friction_keywords: ["frustrated", "stopped using"], source_meta: "Competitor review gap (Amazon/Flipkart)" },
      { id: generateId(), issue: "Kids Chronic Constipation — No Safe Probiotic", pain_intensity: 8, frequency_count: 33, source_url: "https://reddit.com/r/IndianParenting/comments/sim_gut_kids", source: "reddit", raw_text: "My 4-year-old has chronic constipation. Tried Isabgol, prune juice, nothing works long-term. Need a daily probiotic safe for kids — all available ones are adult formulations.", detected_friction_keywords: ["nothing works", "tried everything"], source_meta: "r/IndianParenting" },
      { id: generateId(), issue: "Screen Time Eye Strain in Children", pain_intensity: 6, frequency_count: 22, source_url: "https://trends.google.com/trends/explore?q=kids+eye+health+screen+time+india", source: "google_trends", raw_text: "Searches: 'kids eye vitamin India', 'lutein gummies children', 'screen time eye drops kids'. Rising 190% YoY. Parents increasingly concerned about tablet/phone screen impact on children's vision.", detected_friction_keywords: [], source_meta: "India" },
      { id: generateId(), issue: "Sugar-Free Kids Vitamins Unavailable", pain_intensity: 7, frequency_count: 27, source_url: "https://reddit.com/r/IndianParenting/comments/sim_sugar_free", source: "reddit", raw_text: "Every kids supplement on Amazon is loaded with sugar or artificial sweeteners. My dentist says gummies are causing cavities. Why can't someone make a zero-sugar vitamin for kids that actually tastes good?", detected_friction_keywords: ["waste of money", "frustrated"], source_meta: "r/IndianParenting" },
      { id: generateId(), issue: "Post-Partum Recovery — Iron Causes Constipation", pain_intensity: 8, frequency_count: 20, source_url: "https://reddit.com/r/Mommit/comments/sim_postpartum", source: "reddit", raw_text: "6 weeks post-delivery and I'm exhausted. Breastfeeding is draining me. Iron tablets cause horrible constipation. Need a lactation + recovery supplement that doesn't wreck my stomach.", detected_friction_keywords: ["desperate", "stopped using"], source_meta: "r/Mommit" },
      { id: generateId(), issue: "Kids Bedtime Sleep — Safe Supplement Needed", pain_intensity: 6, frequency_count: 18, source_url: "https://reddit.com/r/IndianParenting/comments/sim_sleep_kids", source: "reddit", raw_text: "My 5-year-old takes 2 hours to fall asleep every night. We've tried warm milk, no screens, stories — nothing works. Need a safe, gentle supplement for kids sleep without melatonin.", detected_friction_keywords: ["nothing works", "please help"], source_meta: "r/IndianParenting" },
    ];
  }

  if (brand === "Be Bodywise") {
    return [
      { id: generateId(), issue: "Hormonal Acne Post-Workout", pain_intensity: 8, frequency_count: 32, source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_hormonal_acne", source: "reddit", raw_text: "Hormonal acne flares up every time after gym. Tried everything—niacinamide, salicylic, adapalene. Still have breakouts. Too expensive to keep buying actives that don't work. Any recommendations?", detected_friction_keywords: ["tried everything", "still have", "too expensive"], source_meta: "r/IndianSkincareAddicts" },
      { id: generateId(), issue: "PCOS Weight Plateau Despite Low-GI Diet", pain_intensity: 9, frequency_count: 41, source_url: "https://reddit.com/r/PCOS/comments/sim_pcos_weight", source: "reddit", raw_text: "Following a low-GI diet for PCOS for 4 months — no change. Desperate. Doctor says metformin but I want a supplement approach first. Frustrated and giving up on finding something affordable.", detected_friction_keywords: ["desperate", "frustrated", "give up"], source_meta: "r/PCOS" },
      { id: generateId(), issue: "Strawberry Skin / KP Body Lotion Gap", pain_intensity: 7, frequency_count: 41, source_url: "https://trends.google.com/trends/explore?q=strawberry%20skin%20india", source: "google_trends", raw_text: "Searches: 'strawberry skin treatment', 'keratosis pilaris body lotion India', 'bumpy skin remedy'. Rising 180% YoY in India.", detected_friction_keywords: [], source_meta: "India" },
      { id: generateId(), issue: "Period Pain — OTC Solutions Not Working", pain_intensity: 8, frequency_count: 28, source_url: "https://reddit.com/r/TwoXIndia/comments/sim_period_pain", source: "reddit", raw_text: "Dysmenorrhea is ruining my life. OTC painkillers stopped working. Tried women's health supplements — nothing works. Please help. Any women who've found something that actually helps?", detected_friction_keywords: ["stopped using", "nothing works", "please help"], source_meta: "r/TwoXIndia" },
      { id: generateId(), issue: "Brightening Serum for South Asian Skin Tones", pain_intensity: 7, frequency_count: 22, source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_brightening", source: "competitor_gap", raw_text: "Most brightening serums formulated for light Caucasian skin. Nothing for deeper Indian skin tones without bleaching effect. Competitor gap on Amazon India.", detected_friction_keywords: ["nothing works"], source_meta: "Competitor review gap (Amazon/Flipkart)" },
      { id: generateId(), issue: "Skin Barrier Damage from Over-Exfoliation", pain_intensity: 7, frequency_count: 24, source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_barrier", source: "reddit", raw_text: "Destroyed my skin barrier trying too many actives. Everything stings now. Tried ceramide creams but nothing restoring it fast enough. Desperate for a barrier repair solution that actually works.", detected_friction_keywords: ["nothing works", "desperate"], source_meta: "r/IndianSkincareAddicts" },
      { id: generateId(), issue: "Humidity-Proof Sunscreen Gap for Women", pain_intensity: 7, frequency_count: 30, source_url: "https://trends.google.com/trends/explore?q=sunscreen+humid+india+women", source: "google_trends", raw_text: "Searches: 'sunscreen for humid weather India', 'no white cast sunscreen women', 'sweat proof SPF India'. Rising 165% YoY. Women want SPF that doesn't pill under makeup in humidity.", detected_friction_keywords: [], source_meta: "India" },
      { id: generateId(), issue: "PCOS Hair Thinning — Hormonal Root Cause Unaddressed", pain_intensity: 8, frequency_count: 26, source_url: "https://reddit.com/r/PCOS/comments/sim_pcos_hair", source: "reddit", raw_text: "PCOS is causing massive hair thinning. Minoxidil made it worse. Biotin didn't work. Need something that addresses hormonal root cause of hair loss in women, not just topicals.", detected_friction_keywords: ["didn't work", "frustrated"], source_meta: "r/PCOS" },
      { id: generateId(), issue: "Intimate Hygiene — No Affordable pH-Balanced Option", pain_intensity: 6, frequency_count: 19, source_url: "https://reddit.com/r/TwoXIndia/comments/sim_intimate", source: "competitor_gap", raw_text: "No good pH-balanced intimate wash in India that isn't overpriced or full of fragrance. Competitor reviews show massive dissatisfaction. Market gap for affordable, gentle, fragrance-free option.", detected_friction_keywords: ["waste of money"], source_meta: "Competitor review gap (Amazon/Flipkart)" },
      { id: generateId(), issue: "Gut-Skin Link — PCOS Synbiotic Gap", pain_intensity: 7, frequency_count: 21, source_url: "https://reddit.com/r/PCOS/comments/sim_gut_pcos", source: "reddit", raw_text: "Doctor says my gut microbiome is affecting PCOS symptoms and skin. Can't find a synbiotic specifically for women with PCOS. Everything out there is generic gut health with no hormonal focus.", detected_friction_keywords: ["no results", "frustrated"], source_meta: "r/PCOS" },
    ];
  }

  // Default: Man Matters
  return [
    { id: generateId(), issue: "Hard Water Hair Fall", pain_intensity: 9, frequency_count: 47, source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_hard_water_hair", source: "reddit", raw_text: "Nothing works for my hair in Bangalore water. I've tried every shampoo and serum. Hard water is destroying my scalp and I'm losing so much hair. Desperate for something that actually works. Alternative to [Brand X]?", detected_friction_keywords: ["nothing works", "hard water", "desperate", "alternative to"], source_meta: "r/IndianSkincareAddicts" },
    { id: generateId(), issue: "Patchy Beard Gaps", pain_intensity: 8, frequency_count: 28, source_url: "https://reddit.com/r/mensgrooming/comments/sim_patchy_beard", source: "reddit", raw_text: "Patchy beard won't fill in. Used minoxidil for 6 months, barely any change. Don't want to give up but frustrated. Need something that actually targets the gaps.", detected_friction_keywords: ["patchy", "frustrated", "give up"], source_meta: "r/mensgrooming" },
    { id: generateId(), issue: "Dandruff Persistence Despite Treatment", pain_intensity: 9, frequency_count: 38, source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_dandruff", source: "competitor_gap", raw_text: "Ketoconazole didn't work. Zinc pyrithione made it worse. I'm crying at this point. Need a leave-on that actually gets rid of flakes. Nothing works.", detected_friction_keywords: ["didn't work", "crying", "nothing works"], source_meta: "Competitor review gap (Amazon/Flipkart)" },
    { id: generateId(), issue: "Performance Anxiety — No Discreet Supplement", pain_intensity: 8, frequency_count: 22, source_url: "https://reddit.com/r/menshealth/comments/sim_performance", source: "reddit", raw_text: "Tried ashwagandha but inconsistent results. No discreet, clinically backed men's performance supplement available in India. Embarrassing to buy offline. Desperate.", detected_friction_keywords: ["desperate", "didn't work"], source_meta: "r/menshealth" },
    { id: generateId(), issue: "Scalp Microbiome Imbalance", pain_intensity: 7, frequency_count: 19, source_url: "https://trends.google.com/trends/explore?q=scalp+microbiome+India", source: "google_trends", raw_text: "Rising searches: 'scalp probiotic India', 'microbiome shampoo men', 'scalp health serum'. Up 160% YoY.", detected_friction_keywords: [], source_meta: "India" },
    { id: generateId(), issue: "Stress-Induced Hair Loss at 25", pain_intensity: 8, frequency_count: 33, source_url: "https://reddit.com/r/IndianMaleHealth/comments/sim_stress_hair", source: "reddit", raw_text: "Work stress is destroying my hairline. Temples receding at 26. Cortisol through the roof. Nothing topical works — need something that addresses root cause internally.", detected_friction_keywords: ["nothing works"], source_meta: "r/IndianMaleHealth" },
    { id: generateId(), issue: "Beard Itch — No Lightweight Solution", pain_intensity: 7, frequency_count: 24, source_url: "https://reddit.com/r/mensgrooming/comments/sim_beard_itch", source: "reddit", raw_text: "Growing a beard but the itch is unbearable in the first 3 weeks. Tried beard oils but they're too greasy and smell artificial. Stopped using them. Need lightweight, non-greasy under-beard skin care.", detected_friction_keywords: ["stopped using", "frustrated"], source_meta: "r/mensgrooming" },
    { id: generateId(), issue: "Crown Thinning — No Targeted Product", pain_intensity: 9, frequency_count: 41, source_url: "https://reddit.com/r/IndianMaleHealth/comments/sim_crown_thinning", source: "competitor_gap", raw_text: "Crown thinning is accelerating and no product specifically targets that area. Most serums are generic scalp products. Amazon competitor reviews show huge gaps — users say 'didn't work for crown'.", detected_friction_keywords: ["didn't work", "no results"], source_meta: "Competitor review gap (Amazon/Flipkart)" },
    { id: generateId(), issue: "Men's Anti-Aging — No Simple Routine", pain_intensity: 7, frequency_count: 21, source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_men_antiaging", source: "reddit", raw_text: "Fine lines at 29 — gym sweat and Delhi pollution wrecking my skin. Men's skincare in India is just aftershave. Need a simple anti-aging routine for Indian men that takes under 2 minutes.", detected_friction_keywords: ["frustrated"], source_meta: "r/IndianSkincareAddicts" },
    { id: generateId(), issue: "Post-Gym Recovery Supplement Gap", pain_intensity: 7, frequency_count: 29, source_url: "https://trends.google.com/trends/explore?q=recovery+supplement+men+india", source: "google_trends", raw_text: "Search surge: 'post workout recovery India', 'muscle soreness supplement men', 'natural recovery drink India'. Rising 150% YoY. High demand, low clinical credibility in existing products.", detected_friction_keywords: [], source_meta: "India" },
  ];
}

export function filterByFrictionKeywords(rawText: string): string[] {
  const lower = rawText.toLowerCase();
  return FRICTION_KEYWORDS.filter((k) => lower.includes(k));
}
