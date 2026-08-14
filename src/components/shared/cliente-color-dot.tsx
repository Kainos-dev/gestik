// src/components/shared/cliente-color-dot.tsx
export function ClienteColorDot({ color, nombre }: { color?: string; nombre?: string }) {
    if (!color) return null;
    return (
        <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            title={nombre}
        />
    );
}
