#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE/src/core" "$WORKSPACE/src/adapters" "$WORKSPACE/src/cli"

cat > "$WORKSPACE/src/core/event.ts" << 'TSEOF'
export interface Event {
    readonly id: string;
    readonly type: string;
    readonly payload: Record<string, unknown>;
    readonly timestamp: string;
}
TSEOF

cat > "$WORKSPACE/src/core/event-store.port.ts" << 'TSEOF'
import type { Event } from './event.js';

export interface EventStore {
    append(event: Event): void;
    query(type?: string, since?: string): Event[];
    count(): number;
}
TSEOF

cat > "$WORKSPACE/src/adapters/memory-event-store.ts" << 'TSEOF'
import type { EventStore } from '../core/event-store.port.js';
import type { Event } from '../core/event.js';

export function createMemoryEventStore(): EventStore {
    const events: Event[] = [];
    return {
        append(event) { events.push(event); },
        query(type, since) {
            let result = [...events];
            if (type) result = result.filter(e => e.type === type);
            if (since) result = result.filter(e => e.timestamp >= since);
            return result;
        },
        count() { return events.length; },
    };
}
TSEOF
