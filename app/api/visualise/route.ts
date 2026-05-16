import { NextRequest, NextResponse } from "next/server";
import { qdrant, COLLECTION_NAME } from "@/lib/qdrant";

type PointResp = {
  id: string | number;
  x: number;
  y: number;
  name?: string;
  category?: string;
  price?: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const points: any[] = [];

    // Scroll all points from Qdrant in pages
    let offset: any = undefined;
    while (true) {
      const batch = await qdrant.scroll(COLLECTION_NAME, {
        limit: 200,
        offset,
        with_payload: true,
        with_vector: true,
      } as any);

      // batch may be an array or an object with .result and .next_page_offset
      const hits = Array.isArray(batch) ? batch : batch.result ?? batch;
      if (!hits || hits.length === 0) break;

      points.push(...hits);

      // Determine next offset if provided by client
      offset = batch.next_page_offset ?? batch.next_page ?? null;
      if (!offset) break;
    }

    if (points.length === 0) {
      return NextResponse.json({ points: [] });
    }

    // Build matrix of vectors
    const vectors: number[][] = [];
    const metas: any[] = [];

    for (const p of points) {
      // Qdrant scroll returns points with 'vector' field when with_vector: true
      const vector = (p as any).vector ?? (p as any).payload_vector ?? null;
      if (!vector) continue;
      vectors.push(vector as number[]);
      metas.push(p);
    }

    if (vectors.length === 0) {
      return NextResponse.json({ points: [] });
    }

    // Dynamically import UMAP and run dimensionality reduction
    const umapModule = await import('umap-js');
    const UMAPClass = (umapModule as any).UMAP ?? (umapModule as any).default ?? umapModule;
    const umap = new UMAPClass({ nComponents: 2, nNeighbors: 15, minDist: 0.1 });

    let embedding: number[][] | null = null;

    try {
      if (typeof umap.fitAsync === 'function') {
        await umap.fitAsync(vectors);
        embedding = umap.getEmbedding();
      } else if (typeof umap.fit === 'function') {
        umap.fit(vectors);
        embedding = umap.getEmbedding();
      } else {
        throw new Error('UMAP API not found');
      }
    } catch (err) {
      // Fallback to synchronous fit + getEmbedding
      try {
        if (typeof umap.fit === 'function') {
          umap.fit(vectors);
          embedding = umap.getEmbedding();
        }
      } catch (err2) {
        console.error('UMAP failed:', err, err2);
        return NextResponse.json({ error: 'UMAP reduction failed' }, { status: 500 });
      }
    }

    // Map embeddings back to points
    const out: PointResp[] = [];
    for (let i = 0; i < embedding.length; i++) {
      const e = embedding[i];
      const meta = metas[i];
      const payload = meta.payload ?? meta;
      out.push({
        id: meta.id ?? meta.point_id ?? i,
        x: e[0],
        y: e[1],
        name: payload?.name ?? payload?.title ?? null,
        category: payload?.category ?? null,
        price: payload?.price ?? null,
      });
    }

    return NextResponse.json({ points: out });
  } catch (error: any) {
    console.error('Visualise API error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
