'use client'

import { motion } from 'framer-motion'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, staggerChildren: 0.1 }}
      className="space-y-8"
    >
      {children}
    </motion.div>
  )
}
