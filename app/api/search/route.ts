import { NextRequest, NextResponse } from "next/server";
import { qdrant, COLLECTION_NAME } from "@/lib/qdrant";
import { embedText } from "@/lib/embeddings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, limit = 5, maxPrice, dietaryFilter } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query string is required" },
        { status: 400 }
      );
    }

    // 1. Embed the query text into a vector using the same model as ingestion
    const queryVector = await embedText(query);

    // 2. Build Qdrant metadata filters
    const filterConditions: any[] = [
      {
        key: "on_hold",
        match: { value: false },
      },
    ];

    if (typeof maxPrice === "number") {
      filterConditions.push({
        key: "price",
        range: { lte: maxPrice },
      });
    }

    if (dietaryFilter) {
      filterConditions.push({
        key: "dietary_tags",
        match: { value: dietaryFilter },
      });
    }

    // 3. Perform vector similarity search against Qdrant
    const searchResults = await qdrant.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: limit,
      filter: {
        must: filterConditions,
      },
      with_payload: true,
    });

    // 4. Map database hits to clean product responses
    const products = searchResults.map((hit) => ({
      id: hit.id,
      score: hit.score,
      ...(hit.payload as object),
    }));

    return NextResponse.json({ products });
  } catch (error: any) {
    console.error("Semantic search error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}