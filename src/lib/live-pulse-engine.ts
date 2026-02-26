/**
 * Live Pulse Ingestion Engine — "The Listening Post"
 * Real-time search via Tavily API; fallback to simulated data on API failure.
 */

import type { BrandName, LiveSignalInput } from "./npd-engine";

export const FRICTION_KEYWORDS = [
  // General consumer friction
  "nothing works",
  "too expensive",
  "hard water",
  "hard water issues",
  "alternative to",
  "waste of money",
  "don't buy",
  "stopped using",
  "didn't work",
  "still have",
  "no results",
  "desperate",
  "tried everything",
  "any recommendations",
  "please help",
  "crying",
  "frustrated",
  "give up",
  "patchy",
  "hormonal acne",
  "post workout",
  "hair fall",
  "dandruff",
  // Parenting-specific friction & guilt signals
  "pediatrician warned",
  "doctor said",
  "tantrum after eating",
  "school lunch came back",
  "hidden sugar",
  "growth chart plateau",
  "won't touch milk",
  "sensory issues",
  "texture aversion",
  "picky eater",
  "refuses to eat",
  "not gaining weight",
  "below average height",
  "nutritional gap",
  "sugar crash",
  "hyperactive after",
  "can't sit still",
  "attention span",
  "won't swallow pills",
  "spits out medicine",
  "came back uneaten",
  "lunch box rejected",
  "worried about growth",
  "compared to other kids",
  "percentile dropped",
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
    allowedTopics: ["hair", "beard", "performance", "dandruff", "scalp", "minoxidil", "grooming", "ed", "testosterone"],
    blockedTerms: ["kids", "baby", "toddler", "infant", "pcos", "pregnancy", "mom", "nutrition children"],
  },
  "Be Bodywise": {
    allowedTopics: ["skin", "pcos", "body care", "acne", "hormonal", "period", "women", "face", "brightening", "kp", "strawberry"],
    blockedTerms: ["beard", "minoxidil", "kids", "baby", "toddler", "infant", "height growth"],
  },
  "Little Joys": {
    allowedTopics: ["kids", "children", "baby", "toddler", "infant", "nutrition", "growth", "mom", "mother", "parent", "supplement", "height", "teen", "adolescent", "snack", "lunch box", "tiffin", "sensory", "texture", "sugar", "attention", "focus", "adhd", "travel", "picky", "iron", "vitamin", "omega", "gut", "sleep", "eye", "screen"],
    blockedTerms: ["hair fall", "hair loss", "beard", "dandruff", "ed ", "erectile", "pcos", "minoxidil", "scalp", "acne"],
  },
};

function passesBrandGuardrail(
  brand: BrandName,
  signal: Pick<RawLiveSignal, "issue" | "raw_text">
): boolean {
  const guardrails = BRAND_MAP[brand];
  const combined = `${signal.issue} ${signal.raw_text}`.toLowerCase();

  for (const term of guardrails.blockedTerms) {
    if (combined.includes(term.toLowerCase())) return false;
  }

  if (guardrails.allowedTopics && guardrails.allowedTopics.length > 0) {
    const hasAllowedTopic = guardrails.allowedTopics.some((topic) =>
      combined.includes(topic.toLowerCase())
    );
    if (!hasAllowedTopic) return false;
  }

  return true;
}

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

const TAVILY_API_KEY = (
  import.meta as unknown as { env: Record<string, string | undefined> }
).env?.VITE_TAVILY_API_KEY;

const BRAND_QUERIES: Record<BrandName, string[]> = {
  "Man Matters": [
    "Reddit Man Matters hair fall beard growth consumer complaints 2026",
    "Reddit hard water hair loss India men frustrated 2026",
    "Reddit patchy beard minoxidil not working India 2026",
  ],
  "Be Bodywise": [
    "Reddit Be Bodywise PCOS hair skin friction points 2026",
    "Reddit hormonal acne Indian women frustrated skincare 2026",
    "Reddit period pain no relief India women supplements 2026",
  ],
  "Little Joys": [
    "Indian mom reddit kids vitamin deficiency picky eater 2026",
    "natural height growth supplements for picky eaters India 2026",
    "toxic ingredients in Indian kids snacks reddit concerns 2026",
    "behavioral issues sugar intake kids forum India 2026",
    "reddit toddler iron deficiency refuses supplements India 2026",
  ],
};

/** Rotate through brand queries to get diverse results */
function getRotatedQuery(brand: BrandName): string {
  const queries = BRAND_QUERIES[brand];
  const index = Math.floor(Date.now() / 60000) % queries.length; // rotate every minute
  return queries[index];
}

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
  query?: string;
  responseTime?: number;
}

export async function simulateLiveSearch(
  brand: BrandName
): Promise<LiveSignalInput[]> {
  try {
    if (!TAVILY_API_KEY) {
      return getSimulatedSignalsAsInput(brand);
    }
    const query = getRotatedQuery(brand);
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: 15,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as TavilySearchResponse;
    const results = data.results ?? [];

    const signals: LiveSignalInput[] = results
      .map((r, i) => ({
        id: generateId(),
        issue: (r.title ?? `Signal ${i + 1}`).trim() || `Signal ${i + 1}`,
        pain_intensity: 6,
        frequency_count: 1,
        source_url: r.url ?? "",
        raw_text: (r.content ?? "").trim() || (r.title ?? ""),
        source_meta: "Reddit/Live Web",
      }))
      .filter((s) => s.issue || s.raw_text)
      .filter((s) => passesBrandGuardrail(brand, { issue: s.issue, raw_text: s.raw_text }));

    return signals;
  } catch (_err) {
    return getSimulatedSignalsAsInput(brand);
  }
}

function getSimulatedSignalsAsInput(brand: BrandName): LiveSignalInput[] {
  const raw = getSimulatedSignals(brand);
  return raw
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
      {
        id: generateId(),
        issue: "Kids Height Growth Stagnation",
        pain_intensity: 9,
        frequency_count: 44,
        source_url: "https://reddit.com/r/IndianParenting/comments/sim_height_growth",
        source: "reddit",
        raw_text: "My 6-year-old isn't growing as expected. Pediatrician says nutrition is key but I can't get him to eat vegetables. Tried everything — gummies, powders, nothing works. Any recommendations from other moms?",
        detected_friction_keywords: ["tried everything", "nothing works", "any recommendations"],
        source_meta: "r/IndianParenting",
      },
      {
        id: generateId(),
        issue: "Toddler Iron Deficiency Anxiety",
        pain_intensity: 8,
        frequency_count: 31,
        source_url: "https://reddit.com/r/Mommit/comments/sim_iron_deficiency",
        source: "reddit",
        raw_text: "Pediatrician flagged low iron in my toddler. The supplements taste horrible and she refuses. Crying every dose time. Desperate for a kids-friendly iron supplement that doesn't taste like metal.",
        detected_friction_keywords: ["crying", "desperate"],
        source_meta: "r/Mommit",
      },
      {
        id: generateId(),
        issue: "Children's Immunity — Post-Monsoon Sick Cycles",
        pain_intensity: 8,
        frequency_count: 29,
        source_url: "https://reddit.com/r/IndianParenting/comments/sim_immunity",
        source: "reddit",
        raw_text: "Every monsoon my kids get sick back-to-back. Started them on Vitamin C + Zinc but it didn't work. Parent group says colostrum helps but too expensive. Any budget-friendly immunity booster for children?",
        detected_friction_keywords: ["didn't work", "too expensive", "any recommendations"],
        source_meta: "r/IndianParenting",
      },
      {
        id: generateId(),
        issue: "Fussy Eater Nutrition Gap",
        pain_intensity: 7,
        frequency_count: 38,
        source_url: "https://trends.google.com/trends/explore?q=nutrition+supplement+kids+india",
        source: "google_trends",
        raw_text: "Search spike: 'nutrition powder for kids India', 'healthy snacks for picky eaters', 'hidden vegetable recipes toddlers'. Rising 210% YoY.",
        detected_friction_keywords: [],
        source_meta: "India",
      },
      {
        id: generateId(),
        issue: "Omega-3 for Kids Brain Development Gap",
        pain_intensity: 7,
        frequency_count: 25,
        source_url: "https://reddit.com/r/BabyBumps/comments/sim_omega3",
        source: "competitor_gap",
        raw_text: "No good kids omega-3 supplement on Amazon India without fishy aftertaste. Parents are frustrated — stopped giving after children refused. Need a palatable DHA for kids 2–8.",
        detected_friction_keywords: ["frustrated", "stopped using"],
        source_meta: "Competitor review gap (Amazon/Flipkart)",
      },
      {
        id: generateId(),
        issue: "Kids Gut Health — Chronic Constipation",
        pain_intensity: 8,
        frequency_count: 33,
        source_url: "https://reddit.com/r/IndianParenting/comments/sim_gut_kids",
        source: "reddit",
        raw_text: "My 4-year-old has chronic constipation. Tried Isabgol, prune juice, nothing works long-term. Pediatrician says we need a daily probiotic but the ones available are adult formulations. Need something safe for kids.",
        detected_friction_keywords: ["nothing works", "tried everything"],
        source_meta: "r/IndianParenting",
      },
      {
        id: generateId(),
        issue: "Screen Time Eye Strain in Children",
        pain_intensity: 6,
        frequency_count: 22,
        source_url: "https://trends.google.com/trends/explore?q=kids+eye+health+screen+time+india",
        source: "google_trends",
        raw_text: "Searches: 'kids eye vitamin India', 'lutein gummies children', 'screen time eye drops kids'. Rising 190% YoY. Parents increasingly concerned about tablet/phone screen impact on children's vision.",
        detected_friction_keywords: [],
        source_meta: "India",
      },
      {
        id: generateId(),
        issue: "Sugar-Free Kids Supplements Hard to Find",
        pain_intensity: 7,
        frequency_count: 27,
        source_url: "https://reddit.com/r/IndianParenting/comments/sim_sugar_free",
        source: "reddit",
        raw_text: "Every kids supplement on Amazon is loaded with sugar or artificial sweeteners. My dentist says gummies are causing cavities. Why can't someone make a zero-sugar vitamin for kids that actually tastes good?",
        detected_friction_keywords: ["waste of money", "frustrated"],
        source_meta: "r/IndianParenting",
      },
      {
        id: generateId(),
        issue: "Post-Partum Recovery for New Moms",
        pain_intensity: 8,
        frequency_count: 20,
        source_url: "https://reddit.com/r/Mommit/comments/sim_postpartum",
        source: "reddit",
        raw_text: "6 weeks post-delivery and I'm exhausted. Breastfeeding is draining me. Iron tablets cause horrible constipation. Need a lactation + recovery supplement that doesn't wreck my stomach.",
        detected_friction_keywords: ["desperate", "stopped using"],
        source_meta: "r/Mommit",
      },
      {
        id: generateId(),
        issue: "Kids Sleep Issues — Bedtime Battles",
        pain_intensity: 6,
        frequency_count: 18,
        source_url: "https://reddit.com/r/IndianParenting/comments/sim_sleep_kids",
        source: "reddit",
        raw_text: "My 5-year-old takes 2 hours to fall asleep every night. We've tried warm milk, no screens, stories — nothing works. Is there a safe, gentle supplement for kids sleep? Don't want melatonin.",
        detected_friction_keywords: ["nothing works", "please help"],
        source_meta: "r/IndianParenting",
      },
      {
        id: generateId(),
        issue: "Vitamin D Deficiency in Metro Kids",
        pain_intensity: 5,
        frequency_count: 15,
        source_url: "https://trends.google.com/trends/explore?q=vitamin+d+kids+india",
        source: "google_trends",
        raw_text: "Searches: 'vitamin D drops for kids', 'indoor kids vitamin D deficiency', 'rickets prevention India'. Rising 140% YoY in metro cities.",
        detected_friction_keywords: [],
        source_meta: "India",
      },
    ];
  }

  if (brand === "Be Bodywise") {
    return [
      {
        id: generateId(),
        issue: "Hormonal Acne Post-Workout",
        pain_intensity: 8,
        frequency_count: 32,
        source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_hormonal_acne",
        source: "reddit",
        raw_text: "Hormonal acne flares up every time after gym. Tried everything—niacinamide, salicylic, adapalene. Still have breakouts. Too expensive to keep buying actives that don't work. Any recommendations?",
        detected_friction_keywords: ["tried everything", "still have", "too expensive", "any recommendations"],
        source_meta: "r/IndianSkincareAddicts",
      },
      {
        id: generateId(),
        issue: "PCOS Weight Plateau Despite Diet",
        pain_intensity: 9,
        frequency_count: 41,
        source_url: "https://reddit.com/r/PCOS/comments/sim_pcos_weight",
        source: "reddit",
        raw_text: "Following a low-GI diet for PCOS for 4 months — no change. Desperate. Doctor says metformin but I want a supplement approach first. Frustrated and giving up on finding something affordable.",
        detected_friction_keywords: ["desperate", "frustrated", "give up"],
        source_meta: "r/PCOS",
      },
      {
        id: generateId(),
        issue: "Strawberry Skin / KP Body",
        pain_intensity: 7,
        frequency_count: 41,
        source_url: "https://trends.google.com/trends/explore?q=strawberry%20skin%20india",
        source: "google_trends",
        raw_text: "Searches: 'strawberry skin treatment', 'keratosis pilaris body lotion India', 'bumpy skin remedy'. Rising 180% YoY in India.",
        detected_friction_keywords: [],
        source_meta: "India",
      },
      {
        id: generateId(),
        issue: "Period Pain No OTC Solution",
        pain_intensity: 8,
        frequency_count: 28,
        source_url: "https://reddit.com/r/TwoXIndia/comments/sim_period_pain",
        source: "reddit",
        raw_text: "Dysmenorrhea is ruining my life. OTC painkillers stopped working. Tried women's health supplements — nothing works. Please help. Any women who've found something that actually helps?",
        detected_friction_keywords: ["stopped using", "nothing works", "please help"],
        source_meta: "r/TwoXIndia",
      },
      {
        id: generateId(),
        issue: "Brightening Serum for South Asian Skin",
        pain_intensity: 7,
        frequency_count: 22,
        source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_brightening",
        source: "competitor_gap",
        raw_text: "Most brightening serums are formulated for light Caucasian skin. Nothing for deeper Indian skin tones without bleaching effect. Competitor gap on Amazon India.",
        detected_friction_keywords: ["nothing works"],
        source_meta: "Competitor review gap (Amazon/Flipkart)",
      },
    ];
  }

  // Default: Man Matters
  return [
    {
      id: generateId(),
      issue: "Hard Water Hair Fall",
      pain_intensity: 9,
      frequency_count: 47,
      source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_hard_water_hair",
      source: "reddit",
      raw_text: "Nothing works for my hair in Bangalore water. I've tried every shampoo and serum. Hard water is destroying my scalp and I'm losing so much hair. Desperate for something that actually works. Alternative to [Brand X]?",
      detected_friction_keywords: ["nothing works", "hard water", "desperate", "alternative to"],
      source_meta: "r/IndianSkincareAddicts",
    },
    {
      id: generateId(),
      issue: "Patchy Beard Gaps",
      pain_intensity: 8,
      frequency_count: 28,
      source_url: "https://reddit.com/r/mensgrooming/comments/sim_patchy_beard",
      source: "reddit",
      raw_text: "Patchy beard won't fill in. Used minoxidil for 6 months, barely any change. Don't want to give up but frustrated. Need something that actually targets the gaps.",
      detected_friction_keywords: ["patchy", "frustrated", "give up"],
      source_meta: "r/mensgrooming",
    },
    {
      id: generateId(),
      issue: "Dandruff Persistence Despite Treatment",
      pain_intensity: 9,
      frequency_count: 38,
      source_url: "https://reddit.com/r/IndianSkincareAddicts/comments/sim_dandruff",
      source: "competitor_gap",
      raw_text: "Ketoconazole didn't work. Zinc pyrithione made it worse. I'm crying at this point. Need a leave-on that actually gets rid of flakes. Nothing works.",
      detected_friction_keywords: ["didn't work", "crying", "nothing works"],
      source_meta: "Competitor review gap (Amazon/Flipkart)",
    },
    {
      id: generateId(),
      issue: "Performance Anxiety — No Discreet Supplement",
      pain_intensity: 8,
      frequency_count: 22,
      source_url: "https://reddit.com/r/menshealth/comments/sim_performance",
      source: "reddit",
      raw_text: "Tried ashwagandha but inconsistent results. No discreet, clinically backed men's performance supplement available in India. Embarrassing to buy offline. Desperate.",
      detected_friction_keywords: ["desperate", "didn't work"],
      source_meta: "r/menshealth",
    },
    {
      id: generateId(),
      issue: "Scalp Microbiome Imbalance",
      pain_intensity: 7,
      frequency_count: 19,
      source_url: "https://trends.google.com/trends/explore?q=scalp+microbiome+India",
      source: "google_trends",
      raw_text: "Rising searches: 'scalp probiotic India', 'microbiome shampoo men', 'scalp health serum'. Up 160% YoY.",
      detected_friction_keywords: [],
      source_meta: "India",
    },
  ];
}

export function filterByFrictionKeywords(rawText: string): string[] {
  const lower = rawText.toLowerCase();
  return FRICTION_KEYWORDS.filter((k) => lower.includes(k));
}
