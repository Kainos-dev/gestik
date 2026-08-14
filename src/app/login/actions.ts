// src/app/login/actions.ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSessionToken, verifyPin, SESSION_COOKIE } from '@/lib/session';

// Delay artificial en intentos fallidos: sin esto, un script podría probar
// PINs a la velocidad de la red. No reemplaza un rate-limit real, pero para
// un PIN de 8 caracteres alfanuméricos alcanza como disuasivo.
function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function iniciarSesion(_prevState: { error?: string } | undefined, formData: FormData) {
    const pin = String(formData.get('pin') ?? '');

    const valido = await verifyPin(pin);
    if (!valido) {
        await delay(500);
        return { error: 'PIN incorrecto' };
    }

    const token = await createSessionToken();
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    });

    redirect('/dashboard');
}

export async function cerrarSesion() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    redirect('/login');
}
