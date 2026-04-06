#!/bin/bash
rm -rf /tmp/replay-test
mkdir -p /tmp/replay-test
cat > /tmp/replay-test/calculator.ts << 'TSEOF'
export function add(a: number, b: number): number {
    return a - b; // BUG: should be a + b
}

export function multiply(a: number, b: number): number {
    return a * b;
}

export function divide(a: number, b: number): number {
    return a / b; // BUG: no zero division check
}

export function average(numbers: number[]): number {
    const sum = numbers.reduce((s, n) => s + n, 0);
    return sum / numbers.length; // BUG: empty array = NaN
}
TSEOF
