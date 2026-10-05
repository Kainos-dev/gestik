// src/components/layout/mobile-nav-context.tsx
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface MobileNavContextValue {
    open: boolean;
    toggle: () => void;
    close: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

// Estado compartido entre Sidebar y Topbar para el menú de mobile (abierto/
// cerrado) — son dos componentes hermanos en el layout, así que necesitan
// un estado en común en vez de pasarse props directamente.
export function MobileNavProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <MobileNavContext.Provider value={{ open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }}>
            {children}
        </MobileNavContext.Provider>
    );
}

export function useMobileNav() {
    const ctx = useContext(MobileNavContext);
    if (!ctx) throw new Error('useMobileNav debe usarse dentro de MobileNavProvider');
    return ctx;
}
