"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrag" | "onDragEnd" | "onDragStart" | "onAnimationStart"> {
  title: string
  subtitle?: string
  amount: number
  currency: "ARS" | "USD"
  type: "bank" | "cash" | "crypto"
  loading?: boolean
  delay?: number
}

export function AnimatedCard({
  title,
  subtitle,
  amount,
  currency,
  type,
  loading = false,
  delay = 0,
  className,
  ...props
}: AnimatedCardProps) {
  const formatValue = (val: number, curr: "ARS" | "USD") => {
    return new Intl.NumberFormat(curr === "ARS" ? "es-AR" : "en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: curr === "USD" ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(val)
  }

  const getTypeStyles = () => {
    switch (type) {
      case "crypto":
        return {
          bgGradient: "from-crypto/10 to-transparent",
          borderHover: "hover:border-crypto/50",
          badgeBg: "bg-crypto/10 text-crypto",
          badgeLabel: "Crypto",
        }
      case "cash":
        return {
          bgGradient: "from-peso/10 to-transparent",
          borderHover: "hover:border-peso/50",
          badgeBg: "bg-peso/10 text-peso",
          badgeLabel: "Efectivo",
        }
      case "bank":
      default:
        return {
          bgGradient: "from-celeste/10 to-transparent",
          borderHover: "hover:border-celeste/50",
          badgeBg: "bg-celeste/10 text-celeste",
          badgeLabel: "Banco",
        }
    }
  }

  const styles = getTypeStyles()

  return (
    <motion.div
      style={{ willChange: 'transform' }}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.98] animate-fade-in",
        styles.borderHover,
        className
      )}
      {...props}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", styles.bgGradient)} />

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col space-y-4"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              </div>
            </div>
            <div className="h-8 w-36 rounded bg-muted animate-pulse" />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex flex-col h-full"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
                {subtitle && <p className="text-xs text-muted-foreground/80 mt-1">{subtitle}</p>}
              </div>
              <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest", styles.badgeBg)}>
                {styles.badgeLabel}
              </span>
            </div>

            <div className="mt-auto">
              <motion.h2 
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground"
              >
                {formatValue(amount, currency)}
              </motion.h2>
              <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full mt-2 inline-block">
                {currency}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
