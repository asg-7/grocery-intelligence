import { NextRequest, NextResponse } from "next/server";
import { parseIngredients } from "@/lib/parser";
import { embedText } from "@/lib/embeddings";
import { qdrant, COLLECTION_NAME } from "@/lib/qdrant";
import { computeFeasibility, MatchedItem } from "@/lib/feasibility";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/cart
 *
 * Full cart pipeline:
 *   1. Parse free-text grocery list into structured items
 *   2. Embed each item & vector-search Qdrant (with on_hold filter)
 *   3. Look up matching Supabase product IDs
 *   4. Compute feasibility score
 *   5. Save cart + cart_items to Supabase
 *
 * Body: { "list": "3 bunches fresh palak\na few tomatoes\n..." }
 * Returns: { cart_id, feasibility, items[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { list } = body;

    if (!list || typeof list !== "string") {
      return NextResponse.json(
        { error: 'Provide a "list" string with newline-separated ingredients' },
        { status: 400 }
      );
    }

    // ── Step 1: Split free-text list into lines & parse ─────────────────
    const lines = list
      .split(/\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "No ingredient lines found in the list" },
        { status: 400 }
      );
    }

    const parsedIngredients = await parseIngredients(lines);

    // ── Step 2: Vector-search Qdrant for each parsed item ──────────────
    // Pre-fetch all Supabase products for ID lookups
    const { data: supabaseProducts } = await supabaseAdmin
      .from("products")
      .select("id, name, on_hold");

    const productMap = new Map<string, string>();
    for (const p of supabaseProducts ?? []) {
      productMap.set(p.name.toLowerCase(), p.id);
    }

    const matchedItems: (MatchedItem & {
      original: string;
      qty: number | null;
      unit: string | null;
      notes: string | null;
      product_details: Record<string, unknown> | null;
    })[] = await Promise.all(
      parsedIngredients.map(async (parsed) => {
        try {
          const queryVector = await embedText(parsed.item);

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
            const matchedName = (payload.name as string) ?? "";
            const confidence = Math.round((topHit.score ?? 0) * 100) / 100;

            // Resolve Supabase product ID by name (case-insensitive)
            const supabaseId = productMap.get(matchedName.toLowerCase()) ?? null;

            return {
              original: parsed.original,
              item: parsed.item,
              qty: parsed.qty,
              unit: parsed.unit,
              notes: parsed.notes,
              matched_product: matchedName,
              confidence,
              product_id: supabaseId,
              product_details: payload,
            };
          }

          return {
            original: parsed.original,
            item: parsed.item,
            qty: parsed.qty,
            unit: parsed.unit,
            notes: parsed.notes,
            matched_product: null,
            confidence: null,
            product_id: null,
            product_details: null,
          };
        } catch (err) {
          console.warn(`Search failed for "${parsed.item}":`, err);
          return {
            original: parsed.original,
            item: parsed.item,
            qty: parsed.qty,
            unit: parsed.unit,
            notes: parsed.notes,
            matched_product: null,
            confidence: null,
            product_id: null,
            product_details: null,
          };
        }
      })
    );

    // ── Step 3: Compute feasibility ────────────────────────────────────
    const feasibility = computeFeasibility(matchedItems);

    // ── Step 4: Save cart to Supabase ──────────────────────────────────
    const { data: cart, error: cartError } = await supabaseAdmin
      .from("carts")
      .insert({})
      .select("id")
      .single();

    if (cartError || !cart) {
      console.error("Failed to create cart:", cartError);
      return NextResponse.json(
        { error: "Failed to create cart in database", details: cartError?.message },
        { status: 500 }
      );
    }

    const cartId = cart.id;

    // Insert cart items (only those with a resolved Supabase product_id)
    const itemsToInsert = matchedItems
      .filter((i) => i.product_id !== null)
      .map((i) => ({
        cart_id: cartId,
        product_id: i.product_id!,
        quantity: i.qty ?? 1,
      }));

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from("cart_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Failed to insert cart items:", itemsError);
        // Non-fatal — cart was created, items partially failed
      }
    }

    // ── Step 5: Build response ─────────────────────────────────────────
    const responseItems = matchedItems.map((i) => ({
      original: i.original,
      parsed: {
        qty: i.qty,
        unit: i.unit,
        item: i.item,
        notes: i.notes,
      },
      matched_product: i.matched_product,
      confidence: i.confidence,
      product_id: i.product_id,
    }));

    return NextResponse.json({
      cart_id: cartId,
      feasibility,
      items: responseItems,
    });
  } catch (error: any) {
    console.error("Cart pipeline error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
