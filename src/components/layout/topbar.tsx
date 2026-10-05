// src/components/layout/topbar.tsx
'use client';

import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cerrarSesion } from '@/app/login/actions';
import { useMobileNav } from './mobile-nav-context';

export function Topbar() {
    const { toggle } = useMobileNav();

    return (
        <header className="h-16 shrink-0 border-b bg-background flex items-center px-4 sm:px-6">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={toggle} aria-label="Abrir menú">
                <Menu className="h-5 w-5" />
            </Button>
            {/* ml-auto en vez de justify-between en el header: con el botón de
                menú oculto (md:hidden) en desktop, justify-between dejaría este
                bloque pegado a la izquierda al no haber nada más con qué
                "espaciarlo" — ml-auto lo manda a la derecha siempre. */}
            <div className="ml-auto flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Kainos</span>
                <form action={cerrarSesion}>
                    <Button variant="ghost" size="icon" type="submit" aria-label="Cerrar sesión">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </header>
    );
}
