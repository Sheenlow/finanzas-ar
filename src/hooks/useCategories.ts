'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string
  name: string
  color: string
}

export function useCategories(_userId?: string) {
  const [categories, setCategories] = useState<Category[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, color')
        .eq('type', 'expense')
        .order('name')
      setCategories(cats || [])
    }
    load()
  }, [supabase])

  return { categories }
}
