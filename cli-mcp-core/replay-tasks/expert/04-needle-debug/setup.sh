#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE/src/api" "$WORKSPACE/src/db" "$WORKSPACE/src/models" "$WORKSPACE/src/utils" "$WORKSPACE/src/middleware" "$WORKSPACE/src/services" "$WORKSPACE/src/config"

cat > "$WORKSPACE/src/config/app.ts" << 'EOF'
export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_SORT = 'created_at';
EOF

cat > "$WORKSPACE/src/models/item.ts" << 'EOF'
export interface Item {
    id: string;
    name: string;
    price: number;
    category: string;
    created_at: string;
    updated_at: string;
}
EOF

cat > "$WORKSPACE/src/utils/sanitize.ts" << 'EOF'
export function sanitizeString(s: string): string {
    return s.replace(/[<>"'&]/g, '');
}
export function sanitizeNumber(n: unknown): number {
    const num = Number(n);
    return isNaN(num) ? 0 : num;
}
EOF

cat > "$WORKSPACE/src/utils/sort.ts" << 'EOF'
const ALLOWED_SORTS = ['name', 'price', 'created_at', 'updated_at'];
export function validateSort(field: string): string {
    return ALLOWED_SORTS.includes(field) ? field : 'created_at';
}
EOF

cat > "$WORKSPACE/src/middleware/validate.ts" << 'EOF'
export function validatePagination(page: unknown, size: unknown): { page: number; size: number } {
    const p = Math.max(1, Number(page) || 1);
    const s = Math.min(100, Math.max(1, Number(size) || 20));
    return { page: p, size: s };
}
EOF

cat > "$WORKSPACE/src/db/connection.ts" << 'EOF'
export async function query(sql: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
    return { rows: [] };
}
EOF

# THE BUG IS HERE: off-by-one in offset calculation
cat > "$WORKSPACE/src/db/items.ts" << 'EOF'
import { query } from './connection.js';
import type { Item } from '../models/item.js';

export async function findItems(
    page: number,
    pageSize: number,
    sort: string = 'created_at',
    filter?: string,
): Promise<{ items: Item[]; total: number }> {
    // BUG: offset should be (page - 1) * pageSize, not page * pageSize
    // When page=1, offset=20 instead of 0, skipping first 20 items
    // When page=2, offset=40 instead of 20
    // This causes items at position 20-39 to appear on BOTH page 1 and page 2
    // (page 1 shows 20-39, page 2 shows 40-59, but the query for page 1
    //  actually starts at offset 20 not 0)
    const offset = page * pageSize;

    let where = '';
    const params: unknown[] = [];
    if (filter) {
        where = 'WHERE category = $1';
        params.push(filter);
    }

    const countResult = await query(`SELECT COUNT(*) FROM items ${where}`, params);
    const dataResult = await query(
        `SELECT * FROM items ${where} ORDER BY ${sort} LIMIT ${pageSize} OFFSET ${offset}`,
        params,
    );

    return {
        items: dataResult.rows as Item[],
        total: Number((countResult.rows[0] as { count: number })?.count ?? 0),
    };
}
EOF

cat > "$WORKSPACE/src/services/itemService.ts" << 'EOF'
import { findItems } from '../db/items.js';
import { validateSort } from '../utils/sort.js';
import type { Item } from '../models/item.js';

export async function getItems(
    page: number,
    pageSize: number,
    sort: string,
    filter?: string,
): Promise<{ items: Item[]; total: number; pages: number }> {
    const validSort = validateSort(sort);
    const result = await findItems(page, pageSize, validSort, filter);
    return {
        ...result,
        pages: Math.ceil(result.total / pageSize),
    };
}
EOF

cat > "$WORKSPACE/src/api/items.ts" << 'EOF'
import { getItems } from '../services/itemService.js';
import { validatePagination } from '../middleware/validate.js';
import { sanitizeString } from '../utils/sanitize.js';

export async function handleListItems(query: {
    page?: string;
    size?: string;
    sort?: string;
    category?: string;
}): Promise<{ status: number; body: unknown }> {
    const { page, size } = validatePagination(query.page, query.size);
    const sort = query.sort ?? 'created_at';
    const filter = query.category ? sanitizeString(query.category) : undefined;

    const result = await getItems(page, size, sort, filter);
    return {
        status: 200,
        body: {
            items: result.items,
            pagination: {
                page,
                size,
                total: result.total,
                pages: result.pages,
            },
        },
    };
}
EOF

cat > "$WORKSPACE/src/index.ts" << 'EOF'
export { handleListItems } from './api/items.js';
export { getItems } from './services/itemService.js';
export { findItems } from './db/items.js';
EOF
