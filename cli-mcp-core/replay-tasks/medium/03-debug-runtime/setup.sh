#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE"
cat > "$WORKSPACE/cache.ts" << 'TSEOF'
// Bug: this cache has a memory leak and a race condition
export class Cache<T> {
    private store = new Map<string, { value: T; expiresAt: number }>();

    set(key: string, value: T, ttlMs: number): void {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
        // BUG 1: never cleans up expired entries → memory leak
    }

    get(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        // BUG 2: doesn't check expiration
        return entry.value;
    }

    // BUG 3: size() counts expired entries
    size(): number {
        return this.store.size;
    }

    // BUG 4: has() doesn't check expiration
    has(key: string): boolean {
        return this.store.has(key);
    }

    delete(key: string): boolean {
        return this.store.delete(key);
    }

    clear(): void {
        this.store.clear();
    }
}
TSEOF
