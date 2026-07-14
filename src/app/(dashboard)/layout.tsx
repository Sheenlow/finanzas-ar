import { Sidebar } from '@/components/layout/Sidebar';
import { SessionTimeout } from '@/components/SessionTimeout';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import { UserProvider } from '@/components/UserProvider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-xl focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Saltar al contenido principal
      </a>
      <div className="flex h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <MobileSidebar />
        <main id="main-content" className="flex-1 overflow-auto pt-14 sm:pt-16 lg:p-0">{children}</main>
        <SessionTimeout />
      </div>
    </UserProvider>
  );
}
