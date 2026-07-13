'use client'

import { motion } from 'framer-motion'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="space-y-8 animate-fade-in">
      {children}
    </motion.div>
  )
}
