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

// Todo pasa por acá salvo /login, los assets estáticos y el favicon.
export const config = {
    matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
