#!/bin/bash
WORKSPACE="${1:-$WORKSPACE}"
rm -rf $WORKSPACE
mkdir -p $WORKSPACE/src/{api,db,cache,auth,config,middleware,utils}

# Config
cat > $WORKSPACE/src/config/database.ts << 'EOF'
export const DB_CONFIG = {
    host: 'localhost',
    port: 5432,
    pool: { min: 2, max: 10 },
    timeout: 5000,
};
EOF

# Utils
cat > $WORKSPACE/src/utils/logger.ts << 'EOF'
export function log(level: string, msg: string, data?: unknown): void {
    console.log(`[${level}] ${msg}`, data ?? '');
}
EOF

cat > $WORKSPACE/src/utils/hash.ts << 'EOF'
export function hashId(id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
        h = ((h << 5) - h) + id.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h).toString(36);
}
EOF

# Auth middleware
cat > $WORKSPACE/src/middleware/auth.ts << 'EOF'
import { log } from '../utils/logger.js';

export function validateToken(token: string): { valid: boolean; userId?: string } {
    if (!token || token.length < 10) return { valid: false };
    log('debug', 'Token validated', { token: token.slice(0, 8) + '...' });
    return { valid: true, userId: token.split('.')[1] };
}
EOF

cat > $WORKSPACE/src/middleware/rateLimit.ts << 'EOF'
const requests = new Map<string, number[]>();

export function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const window = requests.get(ip) ?? [];
    const recent = window.filter(t => now - t < 60000);
    recent.push(now);
    requests.set(ip, recent);
    return recent.length <= 100;
}
EOF

# Database layer
cat > $WORKSPACE/src/db/connection.ts << 'EOF'
import { DB_CONFIG } from '../config/database.js';

let connectionCount = 0;

export async function getConnection(): Promise<{ id: number; query: (sql: string) => Promise<unknown> }> {
    connectionCount++;
    return {
        id: connectionCount,
        query: async (sql: string) => {
            await new Promise(r => setTimeout(r, Math.random() * 50));
            return { rows: [] };
        },
    };
}

export async function releaseConnection(conn: { id: number }): Promise<void> {
    connectionCount--;
}
EOF

cat > $WORKSPACE/src/db/users.ts << 'EOF'
import { getConnection, releaseConnection } from './connection.js';
import { log } from '../utils/logger.js';

export interface User {
    id: string;
    name: string;
    email: string;
    status: string;
}

export async function findUserById(id: string): Promise<User | null> {
    const conn = await getConnection();
    try {
        log('debug', `Querying user ${id}`);
        const result = await conn.query(`SELECT * FROM users WHERE id = '${id}'`);
        return { id, name: 'Test User', email: 'test@test.com', status: 'active' };
    } finally {
        await releaseConnection(conn);
    }
}
EOF

# THE BUG IS HERE: Cache with race condition
cat > $WORKSPACE/src/cache/store.ts << 'EOF'
import { log } from '../utils/logger.js';
import { hashId } from '../utils/hash.js';

interface CacheEntry {
    value: unknown;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
let isRefreshing = false;

export async function getCached(key: string): Promise<unknown | null> {
    const hashed = hashId(key);
    const entry = cache.get(hashed);

    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        // BUG: Race condition here - if two requests hit expired cache simultaneously,
        // both trigger invalidation. The second one deletes while first is refreshing,
        // causing the first to return null (the 3% error).
        if (!isRefreshing) {
            isRefreshing = true;
            cache.delete(hashed);
            isRefreshing = false;
        }
        return null;
    }

    return entry.value;
}

export async function setCached(key: string, value: unknown, ttlMs: number = 30000): Promise<void> {
    const hashed = hashId(key);
    cache.set(hashed, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidate(key: string): void {
    cache.delete(hashId(key));
}
EOF

# API handler
cat > $WORKSPACE/src/api/users.ts << 'EOF'
import { findUserById } from '../db/users.js';
import { getCached, setCached } from '../cache/store.js';
import { validateToken } from '../middleware/auth.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { log } from '../utils/logger.js';

export async function handleGetUser(
    userId: string,
    token: string,
    ip: string,
): Promise<{ status: number; body: unknown }> {
    // Rate limit
    if (!checkRateLimit(ip)) {
        return { status: 429, body: { error: 'Too many requests' } };
    }

    // Auth
    const auth = validateToken(token);
    if (!auth.valid) {
        return { status: 401, body: { error: 'Unauthorized' } };
    }

    try {
        // Try cache first
        const cached = await getCached(`user:${userId}`);
        if (cached) {
            log('debug', `Cache hit for user ${userId}`);
            return { status: 200, body: cached };
        }

        // Cache miss — fetch from DB
        log('debug', `Cache miss for user ${userId}`);
        const user = await findUserById(userId);
        if (!user) {
            return { status: 404, body: { error: 'User not found' } };
        }

        // Cache the result
        await setCached(`user:${userId}`, user);
        return { status: 200, body: user };
    } catch (err) {
        log('error', `Error fetching user ${userId}`, err);
        return { status: 500, body: { error: 'Internal server error' } };
    }
}
EOF

# Entry point
cat > $WORKSPACE/src/index.ts << 'EOF'
export { handleGetUser } from './api/users.js';
export { findUserById } from './db/users.js';
export { getCached, setCached, invalidate } from './cache/store.js';
export { validateToken } from './middleware/auth.js';
export { checkRateLimit } from './middleware/rateLimit.js';
EOF
