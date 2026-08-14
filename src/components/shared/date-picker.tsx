// src/components/shared/date-picker.tsx
'use client';

import { useState } from 'react';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatDate } from '@/lib/utils';

interface DatePickerProps {
    id?: string;
    value?: Date;
    onChange: (date: Date) => void;
    className?: string;
}

// Igual criterio que formatDate/calcularEstadoCargo/calcularEstadoRenovacion:
// una fecha "elegida" en un form se guarda como medianoche UTC del día
// seleccionado, sin importar la timezone de quien la eligió. Esto reproduce
// exactamente lo que el <input type="date"> nativo ya producía (z.coerce.date()
// sobre un string "YYYY-MM-DD" siempre da medianoche UTC).
function toUtcMidnight(date: Date): Date {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

// El Calendar (react-day-picker) trabaja con fechas "locales" para posicionar
// la grilla — convierte el valor UTC-medianoche guardado a un Date local con
// los mismos año/mes/día, leyendo los getters UTC (mismo criterio que el resto
// del código para no correrse un día en timezones negativas).
function toLocalForCalendar(date?: Date): Date | undefined {
    if (!date) return undefined;
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function DatePicker({ id, value, onChange, className }: DatePickerProps) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        className={cn('w-full justify-start font-normal', !value && 'text-muted-foreground', className)}
                    >
                        <CalendarIcon className="size-4" />
                        {value ? formatDate(value) : 'Seleccionar fecha'}
                    </Button>
                }
            />
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    locale={es}
                    selected={toLocalForCalendar(value)}
                    defaultMonth={toLocalForCalendar(value)}
                    onSelect={(date) => {
                        if (!date) return;
                        onChange(toUtcMidnight(date));
                        setOpen(false);
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
