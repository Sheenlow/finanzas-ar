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
      <div className="flex h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <MobileSidebar />
        <main className="flex-1 overflow-auto pt-14 sm:pt-16 lg:p-0">{children}</main>
        <SessionTimeout />
      </div>
    </UserProvider>
  );
}
