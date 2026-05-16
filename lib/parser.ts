/**
 * Ingredient NLP Parser
 *
 * Parses raw ingredient strings like "2 cups all-purpose flour, sifted"
 * into structured { qty, unit, item, notes } objects.
 *
 * Uses a local regex-based approach by default. When ANTHROPIC_API_KEY is set,
 * it upgrades to Claude for higher-accuracy parsing of complex strings.
 */

export interface ParsedIngredient {
  original: string;
  qty: number | null;
  unit: string | null;
  item: string;
  notes: string | null;
}

// ─── Unit normalization map ────────────────────────────────────────────
const UNIT_MAP: Record<string, string> = {
  cup: "cup", cups: "cup",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", liter: "l", liters: "l", litre: "l", litres: "l",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  piece: "piece", pieces: "piece", pcs: "piece",
  bunch: "bunch", bunches: "bunch",
  can: "can", cans: "can",
  dozen: "dozen",
  pinch: "pinch",
  medium: "medium", large: "large", small: "small",
  clove: "clove", cloves: "clove",
  sprig: "sprig", sprigs: "sprig",
  slice: "slice", slices: "slice",
  head: "head", heads: "head",
  stalk: "stalk", stalks: "stalk",
};

// Regex: optional quantity (with fractions), optional unit, then the item name
const INGREDIENT_REGEX = new RegExp(
  [
    "^",
    // Group 1: quantity — digits, fractions, ranges like "2-3"
    "(?:([\\d]+(?:[\\./\\-][\\d]+)?)\\s*)?",
    // Group 2: unit keyword
    `(?:(${Object.keys(UNIT_MAP).join("|")})\\b\\.?\\s+)?`,
    // Group 3: item name (everything up to a comma, parenthesis, or end)
    "([^,()]+?)",
    // Group 4: optional notes after comma or in parentheses
    "(?:\\s*[,(]\\s*(.+?)\\s*\\)?)?",
    "$",
  ].join(""),
  "i"
);

// ─── Fraction helper ───────────────────────────────────────────────────
function parseFraction(s: string): number {
  if (s.includes("/")) {
    const [num, den] = s.split("/").map(Number);
    return den ? num / den : num;
  }
  if (s.includes("-")) {
    // Range like "2-3" → take average
    const [lo, hi] = s.split("-").map(Number);
    return (lo + hi) / 2;
  }
  return Number(s);
}

// ─── Local regex parser ────────────────────────────────────────────────
function parseLocal(raw: string): ParsedIngredient {
  let cleaned = raw.replace(/\s+/g, " ").trim();

  // Pre-extract parenthetical notes like "(400g)" or "(Cottage Cheese)"
  let parenNotes: string[] = [];
  cleaned = cleaned.replace(/\(([^)]+)\)/g, (_match, inner) => {
    parenNotes.push(inner.trim());
    return " ";
  }).replace(/\s+/g, " ").trim();

  const m = cleaned.match(INGREDIENT_REGEX);

  if (!m) {
    return { original: raw, qty: null, unit: null, item: cleaned, notes: parenNotes.join("; ") || null };
  }

  const [, qtyStr, unitStr, itemRaw, commaNotesRaw] = m;

  // Combine comma-notes and paren-notes
  const allNotes = [commaNotesRaw?.trim(), ...parenNotes].filter(Boolean).join("; ");

  return {
    original: raw,
    qty: qtyStr ? parseFraction(qtyStr) : null,
    unit: unitStr ? UNIT_MAP[unitStr.toLowerCase()] ?? unitStr.toLowerCase() : null,
    item: itemRaw.trim(),
    notes: allNotes || null,
  };
}

// ─── Claude-powered parser (activated when ANTHROPIC_API_KEY is set) ──
async function parseWithClaude(ingredients: string[]): Promise<ParsedIngredient[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Parse each ingredient string into JSON with keys: qty (number|null), unit (string|null), item (string), notes (string|null).
Return a JSON array only, no explanation.

Ingredients:
${ingredients.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b) => (b as any).type === "text")
    .map((b: any) => (b as any).text)
    .join("");

  // Extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON");

  const parsed: Array<{ qty: number | null; unit: string | null; item: string; notes: string | null }> =
    JSON.parse(jsonMatch[0]);

  return parsed.map((p, i) => ({
    original: ingredients[i],
    ...p,
  }));
}

// ─── Public API ────────────────────────────────────────────────────────

/** Parse a single ingredient string */
export function parseIngredient(raw: string): ParsedIngredient {
  return parseLocal(raw);
}

/** Parse a batch of ingredient strings — uses Claude if available */
export async function parseIngredients(raws: string[]): Promise<ParsedIngredient[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && apiKey.length > 10) {
    try {
      return await parseWithClaude(raws);
    } catch (err) {
      console.warn("Claude parsing failed, falling back to local:", err);
    }
  }

  // Local fallback
  return raws.map(parseLocal);
}
