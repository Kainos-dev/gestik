// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, SESSION_COOKIE } from '@/lib/session';

export async function proxy(request: NextRequest) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const autenticado = await isValidSessionToken(token);

    if (!autenticado) {
        const url = new URL('/login', request.url);
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

// Todo pasa por acá salvo /login, los assets estáticos, el favicon, y el
// cron (/api/cron/*, que se autentica con CRON_SECRET en vez de la cookie
// de sesión — Vercel lo llama server-to-server, sin PIN de por medio).
export const config = {
    matcher: ['/((?!login|api/cron|_next/static|_next/image|favicon.ico).*)'],
};
