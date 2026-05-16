import { NextRequest, NextResponse } from "next/server";
import findSubstituteByProductId from "@/lib/substitution";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product_id, reason } = body;

    if (!product_id || typeof product_id !== "string") {
      return NextResponse.json({ error: "Provide a product_id string" }, { status: 400 });
    }

    const result = await findSubstituteByProductId(product_id, reason);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Substitution API error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
