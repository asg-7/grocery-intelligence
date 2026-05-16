import { qdrant, COLLECTION_NAME } from "@/lib/qdrant";
import { embedText, productToText } from "@/lib/embeddings";
import { supabaseAdmin } from "@/lib/supabase";

type Candidate = {
  point_id?: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  dietary_tags?: string[];
  price?: number;
  on_hold?: boolean;
  score?: number | null;
  supabase_id?: string | null;
};

async function callClaudeForChoice(original: any, candidates: Candidate[], reason?: string) {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

  const candidateListText = candidates
    .map((c, i) => {
      return `${i + 1}. ${c.name}${c.brand ? ` — ${c.brand}` : ""}${c.price ? ` (₹${c.price})` : ""}${c.dietary_tags?.length ? ` [${c.dietary_tags.join(", ")}]` : ""}${c.description ? `: ${c.description}` : ""}`;
    })
    .join("\n");

  const prompt = `You are an assistant that helps choose the best direct substitute product for a grocery item.

Original product:\nName: ${original.name}${original.brand ? `\nBrand: ${original.brand}` : ""}${original.price ? `\nPrice: ₹${original.price}` : ""}${original.category ? `\nCategory: ${original.category}` : ""}${original.dietary_tags ? `\nDietary tags: ${JSON.stringify(original.dietary_tags)}` : ""}${original.description ? `\nDescription: ${original.description}` : ""}

Candidates:\n${candidateListText}

Task: From the candidate list, pick the single best substitute for the original product. Consider similarity of product type, category, brand, price, and dietary tags. Exclude any candidate that is on hold. If multiple candidates are similar, prefer the one closest in category and dietary compatibility; mention any tradeoffs (price, brand, texture, taste) briefly.

Return a JSON object only with these keys: `chosen_product` (an object with `name`, `brand` (if available), `price` (if available), and `supabase_id` (if known or null)), and `explanation` (a short human-readable paragraph that MUST mention both the original product name and the chosen product name).

Reason for substitution (user provided): ${reason ?? "none"}

Only return JSON and nothing else.`;

  const msg = await client.messages.create({
    model,
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  // Extract JSON object from Claude output
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude did not return a JSON object for substitution");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (err) {
    throw new Error("Failed to parse JSON from Claude response: " + err);
  }
}

/**
 * Find substitute candidates by querying Qdrant and asking Claude to pick the best one.
 * productId is expected to be the Supabase product ID.
 */
export async function findSubstituteByProductId(productId: string, reason?: string) {
  // 1. Fetch original product from Supabase
  const { data: originalProduct, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw new Error("Failed to fetch original product: " + error.message);
  if (!originalProduct) throw new Error("Original product not found");

  // 2. Vectorize original product text
  const text = productToText(originalProduct);
  const queryVector = await embedText(text);

  // 3. Search Qdrant for similar products (exclude on_hold)
  const results = await qdrant.search(COLLECTION_NAME, {
    vector: queryVector,
    limit: 10,
    filter: { must: [{ key: "on_hold", match: { value: false } }] },
    with_payload: true,
  });

  // 4. Map to candidate objects and exclude the original product by name
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const hit of results) {
    const payload = hit.payload as any;
    const name = (payload.name as string) ?? null;
    if (!name) continue;
    if (name.toLowerCase() === (originalProduct.name as string).toLowerCase()) continue;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    candidates.push({
      point_id: String(hit.id),
      name,
      description: payload.description,
      category: payload.category,
      brand: payload.brand,
      dietary_tags: payload.dietary_tags,
      price: payload.price,
      on_hold: payload.on_hold,
      score: hit.score ?? null,
      supabase_id: null,
    });
  }

  if (candidates.length === 0) {
    return { chosen_product: null, explanation: "No available substitutes found." };
  }

  // 5. Resolve Supabase IDs by product name (case-insensitive)
  const { data: supabaseProducts } = await supabaseAdmin.from("products").select("id, name");
  const productMap = new Map<string, string>();
  for (const p of supabaseProducts ?? []) {
    productMap.set(p.name.toLowerCase(), p.id);
  }

  for (const c of candidates) {
    const sid = productMap.get(c.name.toLowerCase()) ?? null;
    c.supabase_id = sid;
  }

  // 6. Ask Claude to choose the best candidate
  const claudeResp = await callClaudeForChoice(originalProduct, candidates.slice(0, 6), reason);

  // Normalize Claude response
  const chosen = claudeResp.chosen_product ?? null;
  const explanation = claudeResp.explanation ?? String(claudeResp.explanation ?? "");

  // Try to match chosen by name to candidate list to include supabase_id if available
  let chosenCandidate: any = null;
  if (chosen && chosen.name) {
    const lookup = candidates.find((c) => c.name.toLowerCase() === chosen.name.toLowerCase());
    if (lookup) chosenCandidate = { ...lookup, rationale_from_llm: explanation };
  }

  return {
    chosen_product: chosenCandidate ?? chosen,
    explanation,
  };
}

export default findSubstituteByProductId;
