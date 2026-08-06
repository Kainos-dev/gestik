// src/components/layout/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Wrench, CreditCard, Receipt, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/clients', label: 'Clientes', icon: Users },
    { href: '/services', label: 'Servicios', icon: Wrench },
    { href: '/pagos', label: 'Pagos', icon: CreditCard },
    { href: '/gastos', label: 'Gastos', icon: Receipt },
    { href: '/gestion', label: 'Gestion', icon: TrendingUp },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-60 shrink-0 border-r bg-background flex flex-col">
            <div className="h-16 flex items-center px-5 border-b">
                <span className="font-semibold text-lg">Kainos Suite</span>
            </div>

            <nav className="flex-1 p-3 space-y-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                active
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}