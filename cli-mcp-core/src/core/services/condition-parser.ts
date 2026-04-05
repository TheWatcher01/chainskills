/**
 * Condition parser — evaluates `@if` condition expressions.
 *
 * Parses simple comparison expressions like `$score > 50` or `$valid == true`
 * against a variable context. Used by the executor to handle `@if`/`@else` branching.
 *
 * Zero external dependencies — pure parsing logic.
 *
 * @module core/services/condition-parser
 */

import type { Result } from '#infra/errors.js';
import type { ValidationError } from '#infra/errors.js';
import { ok, err, validationError } from '#infra/errors.js';

/** Supported comparison operators. */
type Operator = '==' | '!=' | '>' | '<' | '>=' | '<=';

const OPERATORS: readonly Operator[] = ['>=', '<=', '!=', '==', '>', '<'];

/**
 * Evaluate a condition expression against a variable context.
 *
 * Supported forms:
 * - `$var == value`    (equality)
 * - `$var != value`    (inequality)
 * - `$var > 50`        (numeric comparisons)
 * - `$var >= 50`
 * - `$var < 100`
 * - `$var <= 100`
 * - `$var`             (truthy check)
 * - `!$var`            (falsy check)
 * - `$a > 0 && $b == true`  (logical AND — short-circuit)
 * - `$a > 0 || $b == true`  (logical OR — short-circuit)
 *
 * Operator precedence: `||` (lowest) < `&&` < comparison operators.
 *
 * Values can be:
 * - Numbers: `42`, `3.14`
 * - Booleans: `true`, `false`
 * - Strings: `"hello"`, `'hello'`
 * - Variables: `$other`
 *
 * @param expression - The condition string to evaluate.
 * @param context    - Variable values for `$name` resolution.
 * @returns `Result<boolean, ValidationError>` indicating the evaluation result.
 */
export function evaluateCondition(
    expression: string,
    context: Record<string, unknown>,
): Result<boolean, ValidationError> {
    const trimmed = expression.trim();

    if (trimmed.length === 0) {
        return err(
            validationError('EMPTY_CONDITION', 'Condition expression is empty'),
        );
    }

    // Logical OR (lowest precedence) — split and short-circuit
    if (trimmed.includes('||')) {
        const parts = splitLogical(trimmed, '||');
        if (parts.length > 1) {
            for (const part of parts) {
                const result = evaluateCondition(part.trim(), context);
                if (!result.ok) return result;
                if (result.value) return ok(true); // short-circuit
            }
            return ok(false);
        }
    }

    // Logical AND (higher precedence than OR) — split and short-circuit
    if (trimmed.includes('&&')) {
        const parts = splitLogical(trimmed, '&&');
        if (parts.length > 1) {
            for (const part of parts) {
                const result = evaluateCondition(part.trim(), context);
                if (!result.ok) return result;
                if (!result.value) return ok(false); // short-circuit
            }
            return ok(true);
        }
    }

    // Negation: !$var → falsy check
    if (trimmed.startsWith('!')) {
        const inner = trimmed.slice(1).trim();
        const value = resolveValue(inner, context);
        return ok(!value);
    }

    // Try to find a comparison operator
    for (const op of OPERATORS) {
        const idx = trimmed.indexOf(op);
        if (idx === -1) continue;

        const left = trimmed.slice(0, idx).trim();
        const right = trimmed.slice(idx + op.length).trim();

        if (left.length === 0 || right.length === 0) continue;

        const leftVal = resolveValue(left, context);
        const rightVal = resolveValue(right, context);

        return ok(compare(leftVal, op, rightVal));
    }

    // No operator found → truthy check: `$var`
    const value = resolveValue(trimmed, context);
    return ok(!!value);
}

/**
 * Split an expression on a logical operator, respecting quoted strings.
 * Returns the original array with 1 element if the operator is not found
 * outside of quotes.
 */
function splitLogical(expr: string, op: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i]!;

        if (ch === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        } else if (ch === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }

        if (
            !inSingleQuote &&
            !inDoubleQuote &&
            expr.slice(i, i + op.length) === op
        ) {
            parts.push(current);
            current = '';
            i += op.length - 1; // skip rest of operator
            continue;
        }

        current += ch;
    }

    parts.push(current);
    return parts;
}

/**
 * Resolve a value token to its actual value.
 *
 * - `$name` → context lookup
 * - `"string"` or `'string'` → string literal
 * - `true`/`false` → boolean
 * - numeric string → number
 * - anything else → string
 */
function resolveValue(
    token: string,
    context: Record<string, unknown>,
): unknown {
    // Variable reference
    if (token.startsWith('$')) {
        const name = token.slice(1);
        return resolvePathFromContext(name, context);
    }

    // Quoted string
    if (
        (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))
    ) {
        return token.slice(1, -1);
    }

    // Boolean
    if (token === 'true') return true;
    if (token === 'false') return false;

    // Number
    const num = Number(token);
    if (!Number.isNaN(num)) return num;

    // Fallback: raw string
    return token;
}

/**
 * Resolve a dotted path from context (e.g. `user.score` → context.user.score).
 */
function resolvePathFromContext(
    path: string,
    context: Record<string, unknown>,
): unknown {
    const segments = path.split('.');
    let current: unknown = context;

    for (const segment of segments) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[segment];
    }

    return current;
}

/**
 * Compare two values with the given operator.
 */
function compare(left: unknown, op: Operator, right: unknown): boolean {
    switch (op) {
        case '==':
            return left === right || String(left) === String(right);
        case '!=':
            return left !== right && String(left) !== String(right);
        case '>':
            return Number(left) > Number(right);
        case '<':
            return Number(left) < Number(right);
        case '>=':
            return Number(left) >= Number(right);
        case '<=':
            return Number(left) <= Number(right);
    }
}
