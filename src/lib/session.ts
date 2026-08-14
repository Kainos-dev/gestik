// src/lib/session.ts
// Auth minimalista: un PIN compartido por todo el equipo (no hay usuarios
// individuales) y una cookie de sesión firmada con HMAC. Usa Web Crypto
// (crypto.subtle) en vez de node:crypto porque este módulo corre tanto en
// Node (server actions) como en el Edge runtime del middleware.
export const SESSION_COOKIE = 'gestik_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

const encoder = new TextEncoder();

async function getKey() {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('Falta la variable de entorno SESSION_SECRET');
    return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify',
    ]);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(b64url: string): ArrayBuffer {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), '=');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

async function hmac(data: string): Promise<ArrayBuffer> {
    const key = await getKey();
    return crypto.subtle.sign('HMAC', key, encoder.encode(data));
}

export async function createSessionToken(): Promise<string> {
    const expiresAt = (Date.now() + SESSION_DURATION_MS).toString();
    const signature = await hmac(expiresAt);
    return `${expiresAt}.${bufferToBase64Url(signature)}`;
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
    if (!token) return false;
    const [expiresAt, signatureB64] = token.split('.');
    if (!expiresAt || !signatureB64) return false;
    if (Date.now() > Number(expiresAt)) return false;

    try {
        const key = await getKey();
        const signature = base64UrlToBuffer(signatureB64);
        return await crypto.subtle.verify('HMAC', key, signature, encoder.encode(expiresAt));
    } catch {
        return false;
    }
}

// Compara el PIN ingresado contra SITE_PIN sin filtrar el largo/contenido
// por timing: en vez de comparar los strings directo, compara los HMAC de
// ambos (digest de largo fijo) byte a byte sin salir antes de tiempo.
export async function verifyPin(pinIngresado: string): Promise<boolean> {
    const pinCorrecto = process.env.SITE_PIN;
    if (!pinCorrecto) throw new Error('Falta la variable de entorno SITE_PIN');

    const [a, b] = await Promise.all([hmac(pinIngresado), hmac(pinCorrecto)]);
    const bytesA = new Uint8Array(a);
    const bytesB = new Uint8Array(b);
    let diff = 0;
    for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
    return diff === 0;
}
