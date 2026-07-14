'use client'

import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

interface Props {
  botConfig: { link_token: string } | null
  botLink: { telegram_user_id: number } | null
}

export function BotBanner({ botConfig, botLink }: Props) {
  if (botLink) {
    return (
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-card border border-border border-l-4 border-l-emerald-500 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Bot de Telegram vinculado</p>
            <p className="text-xs text-muted-foreground mt-0.5">Telegram ID: {botLink.telegram_user_id}</p>
            <a href="https://t.me/FinanzasArBot" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1 inline-block">
              @FinanzasArBot · t.me/FinanzasArBot
            </a>
          </div>
        </div>
      </motion.section>
    )
  }

  if (botConfig?.link_token) {
    return (
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-card border border-border border-l-4 border-l-indigo-500 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <span className="text-2xl">🤖</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Vinculá tu bot de Telegram</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registrá gastos por chat y recibí resúmenes al instante
            </p>
            <a
              href={`https://t.me/FinanzasArBot?start=${botConfig.link_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Vincular en Telegram
            </a>
            <a href="https://t.me/FinanzasArBot" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-2 inline-block">
              @FinanzasArBot · t.me/FinanzasArBot
            </a>
          </div>
        </div>
      </motion.section>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border border-l-4 border-l-amber-500 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🤖</span>
        <div>
          <p className="text-sm font-semibold text-foreground">Bot de Telegram</p>
          <p className="text-xs text-muted-foreground mt-0.5">Usá el comando /config para empezar.</p>
          <a href="https://t.me/FinanzasArBot" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1 inline-block">
            @FinanzasArBot · t.me/FinanzasArBot
          </a>
        </div>
      </div>
    </motion.section>
  )
}
