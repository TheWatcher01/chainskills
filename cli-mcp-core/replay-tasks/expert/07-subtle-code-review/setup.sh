#!/bin/bash
WORKSPACE="${1:-/tmp/replay-test}"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE/src"

cat > "$WORKSPACE/src/processor.ts" << 'EOF'
// Data processor — process incoming events and aggregate results

interface Event {
    id: string;
    type: string;
    value: number;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

interface AggregateResult {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    types: string[];
}

const processed = new Set<string>();
const listeners: Array<(result: AggregateResult) => void> = [];

// BUG 1: Type coercion — == instead of === for null check
export function isValidEvent(event: Event): boolean {
    if (event.id == null) return false;
    if (event.value == undefined) return false;
    if (typeof event.type !== 'string') return false;
    return true;
}

// BUG 2: Off-by-one — starts at 1 instead of 0, skips first event
export function processEvents(events: Event[]): AggregateResult {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    const types = new Set<string>();

    for (let i = 1; i < events.length; i++) {
        const event = events[i]!;
        if (!isValidEvent(event)) continue;
        if (processed.has(event.id)) continue;

        sum += event.value;
        if (event.value < min) min = event.value;
        if (event.value > max) max = event.value;
        types.add(event.type);
        processed.add(event.id);
    }

    const count = types.size;
    // BUG 3: Division by zero when no events match
    const avg = sum / count;

    const result: AggregateResult = {
        count,
        sum,
        avg,
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        types: [...types],
    };

    // BUG 4: Memory leak — listeners array never cleaned up
    for (const listener of listeners) {
        listener(result);
    }

    return result;
}

// BUG 5: Async function that doesn't await — the fetch result is lost
export async function fetchAndProcess(url: string): Promise<AggregateResult> {
    const events: Event[] = [];
    fetch(url).then(r => r.json()).then((data: Event[]) => {
        events.push(...data);
    });
    // Returns immediately with empty events array
    return processEvents(events);
}

export function addListener(fn: (result: AggregateResult) => void): void {
    listeners.push(fn);
}

export function reset(): void {
    processed.clear();
    // BUG 4 continued: doesn't clear listeners
}
EOF
