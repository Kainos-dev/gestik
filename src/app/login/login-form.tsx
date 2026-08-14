// src/app/login/login-form.tsx
'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { iniciarSesion } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
    const [state, formAction, isPending] = useActionState(iniciarSesion, undefined);
    const [pinVisible, setPinVisible] = useState(false);

    return (
        <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="pin">PIN de acceso</Label>
                <div className="relative">
                    <Input
                        id="pin"
                        name="pin"
                        type={pinVisible ? 'text' : 'password'}
                        autoFocus
                        autoComplete="off"
                        className="pr-9"
                    />
                    <button
                        type="button"
                        onClick={() => setPinVisible((v) => !v)}
                        aria-label={pinVisible ? 'Ocultar PIN' : 'Mostrar PIN'}
                        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                    >
                        {pinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Verificando...' : 'Ingresar'}
            </Button>
        </form>
    );
}
