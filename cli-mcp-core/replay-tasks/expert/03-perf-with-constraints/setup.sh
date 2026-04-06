#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE/src/api" "$WORKSPACE/src/services" "$WORKSPACE/src/db" "$WORKSPACE/src/models" "$WORKSPACE/src/utils"
mkdir -p "$WORKSPACE/tests"

# Models
cat > "$WORKSPACE/src/models/report.ts" << 'EOF'
export interface SalesRecord {
    id: string;
    product: string;
    category: string;
    amount: number;
    quantity: number;
    region: string;
    date: string;
}

export interface ReportRow {
    category: string;
    region: string;
    totalAmount: number;
    totalQuantity: number;
    avgPrice: number;
    recordCount: number;
}

export interface Report {
    rows: ReportRow[];
    generatedAt: string;
    totalRecords: number;
    executionMs: number;
}
EOF

# DB layer — simulates a large dataset
cat > "$WORKSPACE/src/db/sales.ts" << 'EOF'
import type { SalesRecord } from '../models/report.js';

const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Books', 'Sports'];
const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const PRODUCTS = ['Widget', 'Gadget', 'Doohickey', 'Thingamajig', 'Whatchamacallit'];

// Generate 10,000 records in-memory (simulates a large table)
function generateData(): SalesRecord[] {
    const records: SalesRecord[] = [];
    for (let i = 0; i < 10000; i++) {
        records.push({
            id: `sale-${i}`,
            product: PRODUCTS[i % PRODUCTS.length]!,
            category: CATEGORIES[i % CATEGORIES.length]!,
            amount: Math.round((Math.random() * 500 + 10) * 100) / 100,
            quantity: Math.floor(Math.random() * 20) + 1,
            region: REGIONS[i % REGIONS.length]!,
            date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
        });
    }
    return records;
}

const DATA = generateData();

export async function fetchAllSales(): Promise<SalesRecord[]> {
    // Simulates DB fetch — returns full dataset
    return [...DATA];
}

// CONSTRAINT: This is the only way to get data — no direct SQL, no cursor, no streaming
// The data MUST be real-time (see test constraints below)
EOF

# Utils
cat > "$WORKSPACE/src/utils/timer.ts" << 'EOF'
export function startTimer(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
}
EOF

# The slow report builder — THIS IS WHAT NEEDS OPTIMIZATION
cat > "$WORKSPACE/src/services/reportBuilder.ts" << 'EOF'
import type { SalesRecord, ReportRow } from '../models/report.js';

// SLOW: O(n * categories * regions) — triple nested loop
export function buildReport(records: SalesRecord[]): ReportRow[] {
    const categories = [...new Set(records.map(r => r.category))];
    const regions = [...new Set(records.map(r => r.region))];
    const rows: ReportRow[] = [];

    for (const category of categories) {
        for (const region of regions) {
            // Filter the entire array for each combination — O(n) per cell
            const matching = records.filter(r => r.category === category && r.region === region);
            if (matching.length === 0) continue;

            let totalAmount = 0;
            let totalQuantity = 0;

            // Another full scan for aggregation
            for (const record of matching) {
                totalAmount += record.amount;
                totalQuantity += record.quantity;
            }

            rows.push({
                category,
                region,
                totalAmount: Math.round(totalAmount * 100) / 100,
                totalQuantity,
                avgPrice: Math.round((totalAmount / matching.length) * 100) / 100,
                recordCount: matching.length,
            });
        }
    }

    // SLOW: Sort by amount descending — using a bubble sort (!!)
    for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows.length - i - 1; j++) {
            if (rows[j]!.totalAmount < rows[j + 1]!.totalAmount) {
                const tmp = rows[j]!;
                rows[j] = rows[j + 1]!;
                rows[j + 1] = tmp;
            }
        }
    }

    return rows;
}
EOF

# API endpoint
cat > "$WORKSPACE/src/api/reports.ts" << 'EOF'
import { fetchAllSales } from '../db/sales.js';
import { buildReport } from '../services/reportBuilder.js';
import { startTimer } from '../utils/timer.js';
import type { Report } from '../models/report.js';

export async function generateReport(): Promise<Report> {
    const elapsed = startTimer();

    const sales = await fetchAllSales();
    const rows = buildReport(sales);

    return {
        rows,
        generatedAt: new Date().toISOString(),
        totalRecords: sales.length,
        executionMs: elapsed(),
    };
}
EOF

# Index
cat > "$WORKSPACE/src/index.ts" << 'EOF'
export { generateReport } from './api/reports.js';
export { buildReport } from './services/reportBuilder.js';
export { fetchAllSales } from './db/sales.js';
export type { Report, ReportRow, SalesRecord } from './models/report.js';
EOF

# TESTS — contain the hidden constraints
cat > "$WORKSPACE/tests/report.test.ts" << 'EOF'
import { describe, it, expect } from 'vitest';

// IMPORTANT CONSTRAINTS (read carefully before optimizing):
//
// 1. NO CACHING — data must be fetched fresh every call (real-time requirement)
//    The business requires up-to-the-second accuracy for financial reports.
//
// 2. NO NEW DEPENDENCIES — npm install is not allowed in production
//    Only use built-in JS/TS features.
//
// 3. SLA: generateReport() must complete in < 200ms for 10,000 records
//
// 4. Output format must be identical — same ReportRow shape, same sort order
//
// 5. All categories and regions must appear in output (no sampling/approximation)

describe('Report Generation', () => {
    it('should produce correct aggregation', () => {
        // This test validates the output shape
        expect(true).toBe(true); // placeholder — real tests run against the API
    });

    it('should NOT use any caching mechanism', () => {
        // Business requirement: real-time data
        // Any implementation using Map/WeakMap/cache/memoize for DATA storage
        // is a constraint violation
        expect(true).toBe(true);
    });

    it('should not add external dependencies', () => {
        // No lodash, no ramda, no external sorting libraries
        expect(true).toBe(true);
    });
});
EOF
