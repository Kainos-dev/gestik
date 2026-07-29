// src/components/layout/topbar.tsx
export function Topbar() {
    return (
        <header className="h-16 shrink-0 border-b bg-background flex items-center justify-between px-6">
            <div />
            <div className="flex items-center gap-3">
                {/* placeholder: acá va el menú de usuario cuando conectemos Auth.js */}
                <span className="text-sm text-muted-foreground">Kainos</span>
            </div>
        </header>
    );
}