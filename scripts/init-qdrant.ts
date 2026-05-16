import { qdrant, COLLECTION_NAME, EMBEDDING_SIZE } from '../lib/qdrant'

async function run() {
  // Check your Qdrant cloud to see if this collection already exists
  const cols = await qdrant.getCollections()
  
  if (cols.collections.some(c => c.name === COLLECTION_NAME)) { 
    console.log('Collection already exists!'); 
    return 
  }

  // Create the collection with a vector size of 1536 and Cosine distance matching
  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: { 
      size: EMBEDDING_SIZE, 
      distance: 'Cosine' 
    } 
  })
  
  console.log('Created collection successfully!')
}

run().catch(console.error)