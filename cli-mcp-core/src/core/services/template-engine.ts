/**
 * Template engine — pure `$variable` substitution service.
 *
 * Replaces `$name` and `${name}` placeholders in text with values
 * from a context dictionary. Supports nested access (`$obj.prop`).
 *
 * Zero external dependencies — pure string operations.
 *
 * @module core/services/template-engine
 */

/**
 * Substitute `$variable` references in `text` using values from `context`.
 *
 * Supported syntaxes:
 * - `$name`        → simple variable
 * - `${name}`      → braced variable
 * - `$obj.prop`    → dot-access on objects
 * - `${obj.prop}`  → braced dot-access
 *
 * Unresolved variables are left as-is (no error, no removal).
 *
 * @param text    - The template string containing `$` placeholders.
 * @param context - A key-value map of variable values.
 * @returns The text with resolved placeholders.
 *
 * @example
 * ```ts
 * substituteVariables('Hello $name!', { name: 'World' });
 * // → 'Hello World!'
 *
 * substituteVariables('${user.email}', { user: { email: 'a@b.c' } });
 * // → 'a@b.c'
 * ```
 */
export function substituteVariables(
    text: string,
    context: Record<string, unknown>,
): string {
    // Match ${dotted.path} and $dotted.path patterns
    // Braced form: ${...} — greedy inside braces
    // Bare form: $word(.word)* — stops at non-identifier chars
    return text.replace(
        /\$\{([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)}/g,
        (match, path: string) => {
            const value = resolvePath(path, context);
            return value !== undefined ? String(value) : match;
        },
    ).replace(
        /\$([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)/g,
        (match, path: string) => {
            const value = resolvePath(path, context);
            return value !== undefined ? String(value) : match;
        },
    );
}

/**
 * Resolve a dotted path (e.g. `user.email`) against a nested context object.
 *
 * @returns The resolved value, or `undefined` if any segment is missing.
 */
function resolvePath(
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
 * Extract all `$variable` references from a text string.
 *
 * Returns unique variable names (without the `$` prefix).
 *
 * @param text - The text to scan for variable references.
 * @returns Array of unique variable names found.
 */
export function extractVariables(text: string): readonly string[] {
    const variables = new Set<string>();

    // Braced form: ${path}
    for (const match of text.matchAll(
        /\$\{([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)}/g,
    )) {
        const name = match[1];
        if (name) variables.add(name.split('.')[0]!);
    }

    // Bare form: $path
    for (const match of text.matchAll(
        /\$([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)/g,
    )) {
        const name = match[1];
        if (name) variables.add(name.split('.')[0]!);
    }

    return [...variables];
}
