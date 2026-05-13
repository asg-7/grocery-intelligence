import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  // Fetch all products from the table you just saw
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('category')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}