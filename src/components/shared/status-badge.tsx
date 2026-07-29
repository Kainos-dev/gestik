// src/components/shared/status-badge.tsx
import { Badge } from '@/components/ui/badge';
import { ESTADO_STYLES } from '@/lib/constants';

interface StatusBadgeProps {
    value: string;
}

export function StatusBadge({ value }: StatusBadgeProps) {
    const style = ESTADO_STYLES[value] ?? { label: value, className: 'bg-muted text-muted-foreground' };

    return (
        <Badge variant="outline" className={style.className}>
            {style.label}
        </Badge>
    );
}