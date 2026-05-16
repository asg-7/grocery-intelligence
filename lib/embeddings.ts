import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function embedText(text: string): Promise<number[]> {
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