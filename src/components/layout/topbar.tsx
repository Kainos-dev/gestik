// src/components/layout/topbar.tsx
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cerrarSesion } from '@/app/login/actions';

export function Topbar() {
    return (
        <header className="h-16 shrink-0 border-b bg-background flex items-center justify-between px-6">
            <div />
            <div className="flex items-center gap-3">
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