// src/lib/db.ts
import { Pool } from 'pg';

const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
    globalForDb.pool ??
    new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,          // conservador para serverless, igual que veníamos planeando
        ssl: { rejectUnauthorized: false }, // Neon/Supabase con pooler lo requieren en muchos casos
    });

if (process.env.NODE_ENV !== 'production') {
    globalForDb.pool = pool;
}