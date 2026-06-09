'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Wallet, ArrowRightLeft, Target, Home, Menu, X, PieChart, Moon, Sun, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserMenu } from '@/components/UserMenu'
import { authService } from '@/services/authService'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { theme, mounted, toggleTheme } = useTheme()

  const handleSignOut = async () => {
    await authService.signOut()
    router.push('/login')
    router.refresh()
  }

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Cuentas', href: '/accounts', icon: Wallet },
    { name: 'Consumos', href: '/transactions', icon: ArrowRightLeft },
    { name: 'Metas', href: '/goals', icon: Target },
    { name: 'Hogar', href: '/hogar', icon: Home },
    { name: 'Ayuda', href: '/ayuda', icon: HelpCircle },
  ]

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 bg-card border border-border rounded-xl shadow-sm hover:bg-muted transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r border-border p-6 flex flex-col gap-6 rounded-r-3xl shadow-xl animate-slide-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 border border-border rounded-xl">
                  <PieChart size={20} />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">FINANZAS AR</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all rounded-xl",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4", isActive ? "text-primary-foreground" : "text-foreground")} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            <div className="space-y-1">
              <UserMenu />
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded-xl"
                >
                  {mounted ? (
                    theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
                  ) : (
                    <span className="w-4 h-4" />
                  )}
                  {mounted ? (theme === 'dark' ? 'Modo claro' : 'Modo oscuro') : 'Tema'}
                </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
