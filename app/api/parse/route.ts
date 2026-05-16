import { NextRequest, NextResponse } from "next/server";
import { parseIngredient, parseIngredients } from "@/lib/parser";

/**
 * POST /api/parse
 *
 * Accepts either a single ingredient or a batch:
 *   { "ingredient": "2 cups flour" }
 *   { "ingredients": ["2 cups flour", "3 eggs"] }
 *
 * Returns structured parsed ingredient(s).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Single ingredient mode
    if (typeof body.ingredient === "string") {
      const parsed = parseIngredient(body.ingredient);
      return NextResponse.json({ parsed });
    }

    // Batch mode
    if (Array.isArray(body.ingredients)) {
      const parsed = await parseIngredients(body.ingredients);
      return NextResponse.json({ parsed });
    }

    return NextResponse.json(
      { error: 'Provide "ingredient" (string) or "ingredients" (string[])' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
