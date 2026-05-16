import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Free embedding fallback runner
let localPipeline: any = null;

export async function embedText(text: string): Promise<number[]> {
  // If you don't have an OpenAI key, run the free transformers model locally!
  if (!process.env.OPENAI_API_KEY) {
    if (!localPipeline) {
      // Dynamically load the transformer pipeline to keep things fast
      const { pipeline } = await import('@xenova/transformers');
      localPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    
    const output = await localPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data); // Returns a free 384-dimensional array vector!
  }

  // Fallback structural safety wrapper for OpenAI (if key is added later)
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const resp = await openai.embeddings.create({ 
    model: 'text-embedding-3-small', 
    input: text 
  })
  return resp.data[0].embedding
}

export function productToText(product: any): string {
  return [
    product.name, 
    product.description, 
    product.category, 
    product.brand,
    ...(product.dietary_tags || [])
  ].filter(Boolean).join('.')
}