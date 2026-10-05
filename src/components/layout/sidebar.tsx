// src/components/layout/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Wrench, CreditCard, Receipt, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileNav } from './mobile-nav-context';

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Gestión', icon: LayoutDashboard },
    { href: '/clients', label: 'Clientes', icon: Users },
    { href: '/services', label: 'Servicios', icon: Wrench },
    { href: '/pagos', label: 'Cobros', icon: CreditCard },
    { href: '/gastos', label: 'Gastos', icon: Receipt },
    { href: '/gestion', label: 'Balance mensual', icon: TrendingUp },
];

export function Sidebar() {
    const pathname = usePathname();
    const { open, close } = useMobileNav();

    return (
        <>
            {/* Fondo oscuro atrás del menú, sólo en mobile mientras está abierto —
                tocarlo cierra el menú, igual que tocar afuera de cualquier drawer. */}
            {open && (
                <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={close} aria-hidden="true" />
            )}
            <aside
                className={cn(
                    // En mobile: panel fijo que entra/sale deslizando desde la
                    // izquierda (drawer). Desde "md" para arriba: vuelve a ser
                    // parte del flujo normal, siempre visible, como antes.
                    'fixed inset-y-0 left-0 z-50 w-60 shrink-0 border-r bg-background flex flex-col transition-transform duration-200 md:static md:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="h-16 flex items-center px-5 border-b">
                    <span className="font-semibold text-lg">Kainos Gestik</span>
                </div>

                <nav className="flex-1 p-3 space-y-1">
                    {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                        const active = pathname === href || pathname.startsWith(href + '/');
                        return (
                            <Link
                                key={href}
                                href={href}
                                onClick={close}
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
        </>
    );
}
