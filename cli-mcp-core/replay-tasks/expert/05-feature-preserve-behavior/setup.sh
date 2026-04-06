#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE/src"
mkdir -p "$WORKSPACE/tests"

# The formatter module with JSON support
cat > "$WORKSPACE/src/formatter.ts" << 'EOF'
export interface DataRecord {
    [key: string]: string | number | boolean | null;
}

export interface FormatOptions {
    pretty?: boolean;
    includeHeader?: boolean;
    dateFormat?: 'iso' | 'unix';
}

export function format(records: DataRecord[], options?: FormatOptions): string {
    const opts = { pretty: false, includeHeader: true, dateFormat: 'iso' as const, ...options };

    if (records.length === 0) return '[]';

    const processed = records.map(record => {
        const result: DataRecord = {};
        for (const [key, value] of Object.entries(record)) {
            if (value === null) {
                result[key] = null;
            } else if (typeof value === 'boolean') {
                result[key] = value;
            } else {
                result[key] = value;
            }
        }
        return result;
    });

    return opts.pretty
        ? JSON.stringify(processed, null, 2)
        : JSON.stringify(processed);
}

export function formatSingle(record: DataRecord, options?: FormatOptions): string {
    const opts = { pretty: false, dateFormat: 'iso' as const, ...options };
    return opts.pretty
        ? JSON.stringify(record, null, 2)
        : JSON.stringify(record);
}

export function parse(input: string): DataRecord[] {
    return JSON.parse(input) as DataRecord[];
}

export function getHeaders(records: DataRecord[]): string[] {
    if (records.length === 0) return [];
    const headers = new Set<string>();
    for (const record of records) {
        for (const key of Object.keys(record)) {
            headers.add(key);
        }
    }
    return [...headers].sort();
}

export function filterByField(
    records: DataRecord[],
    field: string,
    value: string | number | boolean | null,
): DataRecord[] {
    return records.filter(r => r[field] === value);
}

export function sortByField(
    records: DataRecord[],
    field: string,
    direction: 'asc' | 'desc' = 'asc',
): DataRecord[] {
    return [...records].sort((a, b) => {
        const va = a[field];
        const vb = b[field];
        if (va === null || va === undefined) return direction === 'asc' ? -1 : 1;
        if (vb === null || vb === undefined) return direction === 'asc' ? 1 : -1;
        if (va < vb) return direction === 'asc' ? -1 : 1;
        if (va > vb) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}
EOF

# 12 existing tests that MUST continue to pass
cat > "$WORKSPACE/tests/formatter.test.ts" << 'EOF'
import { describe, it, expect } from 'vitest';
import { format, formatSingle, parse, getHeaders, filterByField, sortByField } from '../src/formatter.js';

describe('format()', () => {
    it('should format empty array', () => {
        expect(format([])).toBe('[]');
    });

    it('should format single record', () => {
        const result = format([{ name: 'Alice', age: 30 }]);
        expect(result).toBe('[{"name":"Alice","age":30}]');
    });

    it('should format multiple records', () => {
        const result = format([{ a: 1 }, { a: 2 }]);
        const parsed = JSON.parse(result);
        expect(parsed).toHaveLength(2);
    });

    it('should support pretty printing', () => {
        const result = format([{ x: 1 }], { pretty: true });
        expect(result).toContain('\n');
        expect(result).toContain('  ');
    });

    it('should handle null values', () => {
        const result = format([{ name: 'Bob', score: null }]);
        expect(result).toContain('null');
    });

    it('should handle boolean values', () => {
        const result = format([{ active: true, deleted: false }]);
        expect(result).toContain('true');
        expect(result).toContain('false');
    });
});

describe('formatSingle()', () => {
    it('should format one record', () => {
        const result = formatSingle({ id: 1, name: 'Test' });
        expect(JSON.parse(result)).toEqual({ id: 1, name: 'Test' });
    });

    it('should support pretty printing', () => {
        const result = formatSingle({ id: 1 }, { pretty: true });
        expect(result).toContain('\n');
    });
});

describe('parse()', () => {
    it('should parse JSON array', () => {
        const result = parse('[{"a":1},{"a":2}]');
        expect(result).toHaveLength(2);
    });
});

describe('getHeaders()', () => {
    it('should extract sorted unique headers', () => {
        const result = getHeaders([{ b: 1, a: 2 }, { c: 3, a: 4 }]);
        expect(result).toEqual(['a', 'b', 'c']);
    });
});

describe('filterByField()', () => {
    it('should filter by exact value', () => {
        const data = [{ status: 'active' }, { status: 'inactive' }, { status: 'active' }];
        expect(filterByField(data, 'status', 'active')).toHaveLength(2);
    });
});

describe('sortByField()', () => {
    it('should sort ascending by default', () => {
        const data = [{ n: 3 }, { n: 1 }, { n: 2 }];
        const sorted = sortByField(data, 'n');
        expect(sorted.map(r => r.n)).toEqual([1, 2, 3]);
    });
});
EOF
