import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MobileNavProvider } from '@/components/layout/mobile-nav-context';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <MobileNavProvider>
            <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                    <Topbar />
                    <main className="flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6">{children}</main>
                </div>
            </div>
        </MobileNavProvider>
    );
}
