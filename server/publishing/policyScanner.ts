import type { App } from "@shared/schema";

export type PolicyFlag = {
  category: "gambling" | "adult" | "copyright" | "spam";
  match: string;
  location: string;
  severity: "low" | "medium" | "high";
};

export type PolicyScanResult = {
  riskScore: number; // 0..1
  flagged: PolicyFlag[];
};

function normalizeText(v: unknown) {
  return typeof v === "string" ? v : "";
}

function collectText(app: App): Record<string, string> {
  const name = normalizeText(app.name);
  const shortDescription = normalizeText((app as any).shortDescription);
  const fullDescription = normalizeText((app as any).fullDescription);
  const prompt = normalizeText((app as any).generatedPrompt);

  // Shallow extract from editorScreens (text fields only)
  const screens = Array.isArray(app.editorScreens) ? app.editorScreens : [];
  const screenText = JSON.stringify(screens).slice(0, 20000);

  return {
    name,
    shortDescription,
    fullDescription,
    prompt,
    screenText,
  };
}

function scanOne(location: string, text: string): PolicyFlag[] {
  const t = text.toLowerCase();
  const hits: PolicyFlag[] = [];

  const push = (category: PolicyFlag["category"], match: string, severity: PolicyFlag["severity"]) => {
    hits.push({ category, match, location, severity });
  };

  // Gambling
  const gambling = ["casino", "slot", "slots", "sportsbook", "betting", "bet ", "poker", "roulette", "blackjack"];
  for (const k of gambling) {
    if (t.includes(k.trim())) push("gambling", k.trim(), "high");
  }

  // Adult
  const adult = ["porn", "xxx", "escort", "sex chat", "nudes", "adult content"];
  for (const k of adult) {
    if (t.includes(k)) push("adult", k, "high");
  }

  // Spam / growth hacks
  const spam = ["free money", "get rich", "guaranteed", "limited time", "act now", "click here", "100% free", "no risk"];
  for (const k of spam) {
    if (t.includes(k)) push("spam", k, "medium");
  }

  // Copyright / brand misuse (heuristic)
  const brands = [
    "google", "facebook", "instagram", "whatsapp", "tiktok", "youtube", "netflix", "amazon", "apple", "paypal",
    "spotify", "microsoft", "play store", "google play",
  ];
  for (const b of brands) {
    // flag if the app name claims affiliation: "Official <brand>" etc
    if (/\bofficial\b/.test(t) && t.includes(b)) push("copyright", `${b} (official claim)`, "high");
    if (/\bnot\s+affiliated\b/.test(t) && t.includes(b)) push("copyright", `${b} (disclaimer present)`, "low");
    if (t.includes(`${b}™`) || t.includes(`${b}®`)) push("copyright", `${b} mark`, "medium");
  }

  return hits;
}

export function scanPolicy(app: App): PolicyScanResult {
  const fields = collectText(app);
  const flagged: PolicyFlag[] = [];
  for (const [loc, txt] of Object.entries(fields)) {
    if (!txt) continue;
    flagged.push(...scanOne(loc, txt));
  }

  // Compute risk: weighted by severity + variety.
  const severityWeight = (s: PolicyFlag["severity"]) => (s === "high" ? 0.35 : s === "medium" ? 0.2 : 0.1);
  const raw = flagged.reduce((sum, f) => sum + severityWeight(f.severity), 0);
  const distinctCats = new Set(flagged.map((f) => f.category)).size;
  const categoryBoost = distinctCats >= 2 ? 0.15 : distinctCats === 1 ? 0.05 : 0;

  const riskScore = Math.max(0, Math.min(1, raw + categoryBoost));
  return { riskScore, flagged };
}
