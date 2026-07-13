'use client'

import { motion, useReducedMotion } from 'framer-motion'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div 
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, staggerChildren: reduceMotion ? 0 : 0.1 }}
      className="space-y-8"
    >
      {children}
    </motion.div>
  )
}
