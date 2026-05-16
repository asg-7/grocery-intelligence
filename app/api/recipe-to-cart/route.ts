import { NextRequest, NextResponse } from "next/server";
import { parseIngredients, ParsedIngredient } from "@/lib/parser";
import { embedText } from "@/lib/embeddings";
import { qdrant, COLLECTION_NAME } from "@/lib/qdrant";

interface CartItem {
  original: string;
  parsed: {
    qty: number | null;
    unit: string | null;
    item: string;
    notes: string | null;
  };
  matched_product: string | null;
  confidence: number | null;
  product_details: Record<string, unknown> | null;
}

/**
 * POST /api/recipe-to-cart
 *
 * Full pipeline: Recipe URL → scrape ingredients → NLP parse → vector search → cart
 *
 * Body: { "url": "https://..." }
 * Returns: { "url", "ingredient_count", "items": CartItem[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A recipe URL is required" },
        { status: 400 }
      );
    }

    // ── Step 1: Call /api/recipe to scrape ingredient strings ────────────
    // Determine the base URL for internal API calls
    const protocol = req.headers.get("x-forwarded-proto") ?? "http";
    const host = req.headers.get("host") ?? "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    const recipeRes = await fetch(`${baseUrl}/api/recipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!recipeRes.ok) {
      const err = await recipeRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: "Failed to extract ingredients", details: err },
        { status: 422 }
      );
    }

    const { ingredients: rawIngredients } = await recipeRes.json();

    if (!rawIngredients || rawIngredients.length === 0) {
      return NextResponse.json(
        { error: "Could not extract ingredients from the provided URL" },
        { status: 422 }
      );
    }

    // ── Step 2: Parse each ingredient into structured data ──────────────
    const parsedIngredients = await parseIngredients(rawIngredients);

    // ── Step 3: For each parsed item, vector-search for the best match ──
    const items: CartItem[] = await Promise.all(
      parsedIngredients.map(async (parsed: ParsedIngredient) => {
        try {
          // Use the extracted item name for semantic search
          const searchTerm = parsed.item;
          const queryVector = await embedText(searchTerm);

          const results = await qdrant.search(COLLECTION_NAME, {
            vector: queryVector,
            limit: 1,
            filter: {
              must: [{ key: "on_hold", match: { value: false } }],
            },
            with_payload: true,
          });

          if (results.length > 0) {
            const topHit = results[0];
            const payload = topHit.payload as Record<string, unknown>;

            return {
              original: parsed.original,
              parsed: {
                qty: parsed.qty,
                unit: parsed.unit,
                item: parsed.item,
                notes: parsed.notes,
              },
              matched_product: (payload.name as string) ?? null,
              confidence: Math.round((topHit.score ?? 0) * 100) / 100,
              product_details: payload,
            };
          }

          // No match found
          return {
            original: parsed.original,
            parsed: {
              qty: parsed.qty,
              unit: parsed.unit,
              item: parsed.item,
              notes: parsed.notes,
            },
            matched_product: null,
            confidence: null,
            product_details: null,
          };
        } catch (searchErr) {
          console.warn(`Search failed for "${parsed.item}":`, searchErr);
          return {
            original: parsed.original,
            parsed: {
              qty: parsed.qty,
              unit: parsed.unit,
              item: parsed.item,
              notes: parsed.notes,
            },
            matched_product: null,
            confidence: null,
            product_details: null,
          };
        }
      })
    );

    return NextResponse.json({
      url,
      ingredient_count: items.length,
      items,
    });
  } catch (error: any) {
    console.error("Recipe-to-cart pipeline error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
