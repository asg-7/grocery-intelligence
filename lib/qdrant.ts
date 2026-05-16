import { QdrantClient } from '@qdrant/js-client-rest'

export const qdrant = new QdrantClient({ 
  url: process.env.QDRANT_URL!, 
  apiKey: process.env.QDRANT_API_KEY! 
})

export const COLLECTION_NAME = 'products'
export const EMBEDDING_SIZE = 384 // Matches Xenova/all-MiniLM-L6-v2 local pipeline