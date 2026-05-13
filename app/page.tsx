'use client'
import { useEffect, useState } from 'react'

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        setProducts(data)
        setLoading(false)
      })
      .catch(err => console.error("Error fetching products:", err))
  }, [])

  if (loading) return <div className="p-8">Loading products from ZING...</div>

  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-green-700">Grocery Intelligence Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product: any) => (
          <div key={product.id} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-800">{product.name}</h2>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full uppercase font-bold">
                {product.category}
              </span>
            </div>
            <p className="text-gray-500 text-sm mb-4">{product.description}</p>
            <div className="text-2xl font-bold text-gray-900">
              {'\u20B9'}
              {Number(product.price).toLocaleString('en-IN')}
              <span className="text-sm text-gray-500 font-normal ml-1">
                {product.name === 'Dark Chocolate'
                  ? '/ 100g'
                  : product.name === 'Free Range Eggs'
                    ? '/ 12pc'
                    : product.category === 'Produce'
                      ? '/ kg'
                      : '/ unit'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
