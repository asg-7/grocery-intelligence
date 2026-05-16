import 'dotenv/config'
import { qdrant, COLLECTION_NAME } from '../lib/qdrant'
import { embedText, productToText } from '../lib/embeddings'
import { randomUUID } from 'crypto'

// 10 Seed products with fixed string quotes
const sampleProducts = [
  { name: "Fresh Palak", description: "Organic crisp green spinach leaves crisp and nutrient dense", category: "Vegetables", brand: "Nature's Fresh", dietary_tags: ["organic", "gluten-free"], price: 40, on_hold: false },
  { name: "Roma Tomatoes", description: "Plump red juicy tomatoes perfect for sauces and salads", category: "Vegetables", brand: "FarmPick", dietary_tags: ["organic"], price: 60, on_hold: false },
  { name: "Basmati Rice", description: "Long grain aromatic premium white basmati rice", category: "Grains", brand: "IndiaGate", dietary_tags: ["gluten-free"], price: 120, on_hold: false },
  { name: "Organic Atta", description: "Whole wheat flour rich in fiber for soft rotis", category: "Grains", brand: "Aashirvaad", dietary_tags: [], price: 90, on_hold: false },
  { name: "Fresh Curd", description: "Creamy dahi prepared from pasteurized toned milk", category: "Dairy", brand: "Amul", dietary_tags: ["vegetarian"], price: 35, on_hold: false },
  { name: "Farm Fresh Eggs", description: "High protein farm fresh white eggs rich in nutrition", category: "Dairy", brand: "Eggo", dietary_tags: [], price: 80, on_hold: false },
  { name: "Baby Spinach", description: "Tender baby spinach leaves perfect for healthy green salads", category: "Vegetables", brand: "Nature's Fresh", dietary_tags: ["organic", "gluten-free"], price: 55, on_hold: false },
  { name: "Greek Yogurt", description: "Thick high-protein strained natural low-fat yogurt", category: "Dairy", brand: "Epigamia", dietary_tags: ["vegetarian", "low-fat"], price: 70, on_hold: false },
  { name: "Brown Rice", description: "Unpolished whole grain brown rice high fiber content", category: "Grains", brand: "Daawat", dietary_tags: ["gluten-free"], price: 140, on_hold: false },
  { name: "Red Onions", description: "Crisp sharp flavor red onions perfect for base curries", category: "Vegetables", brand: "FarmPick", dietary_tags: [], price: 30, on_hold: false }
]

async function ingest() {
  console.log('🚀 Starting product vector ingestion into Qdrant Cloud...')
  const points = []

  for (const product of sampleProducts) {
    const plainTextString = productToText(product)
    
    console.log(`✨ Vectorizing product: "${product.name}"...`)
    const embeddingVector = await embedText(plainTextString)

    points.push({
      id: randomUUID(),
      vector: embeddingVector,
      payload: {
        name: product.name,
        description: product.description,
        category: product.category,
        brand: product.brand,
        dietary_tags: product.dietary_tags,
        price: product.price,
        on_hold: product.on_hold
      }
    })
  }

  await qdrant.upsert(COLLECTION_NAME, { points })
  console.log('✅ Success! All 10 products successfully indexed into your vector store.')
}

ingest().catch(console.error)