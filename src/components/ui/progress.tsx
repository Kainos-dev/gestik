import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentProps<'div'> {
    value: number; // 0-100
}

function Progress({ value, className, ...props }: ProgressProps) {
    const pct = Math.min(100, Math.max(0, value));

    return (
        <div
            data-slot="progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className={cn('bg-muted relative h-2 w-full overflow-hidden rounded-full', className)}
            {...props}
        >
            <div
                data-slot="progress-indicator"
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

export { Progress };
