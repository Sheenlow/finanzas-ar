'use client'

import { authService } from '@/services/authService.client';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, ArrowRightLeft, Target, LogOut, PieChart, Home, Moon, Sun, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/UserMenu';
import { useTheme } from '@/components/ThemeProvider';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, mounted, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    await authService.signOut();
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Cuentas', href: '/accounts', icon: Wallet },
    { name: 'Consumos', href: '/transactions', icon: ArrowRightLeft },
    { name: 'Metas', href: '/goals', icon: Target },
    { name: 'Hogar', href: '/hogar', icon: Home },
    { name: 'Ayuda', href: '/ayuda', icon: HelpCircle },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-sm h-screen p-6 flex flex-col gap-6 rounded-r-3xl">
      <div className="flex items-center gap-2 px-2">
        <div className="p-2 border border-border rounded-xl">
            <PieChart size={20} />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">FINANZAS AR</h2>
      </div>
      
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
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
          );
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
  );
}

