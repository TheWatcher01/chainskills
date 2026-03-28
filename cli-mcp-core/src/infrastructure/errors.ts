/**
 * Result pattern — discriminated union for business-flow error handling.
 *
 * Usage:
 * ```ts
 * const result: Result<Workflow, ParseError> = ok(workflow);
 * if (result.ok) result.value // Workflow
 * else result.error           // ParseError
 * ```
 *
 * @module infrastructure/errors
 */

// ─── Result<T, E> ────────────────────────────────────────────────────────────

/** Successful outcome wrapping a value. */
export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}

/** Failed outcome wrapping an error. */
export interface Err<E> {
    readonly ok: false;
    readonly error: E;
}

/** Discriminated union — either a success (`Ok<T>`) or a failure (`Err<E>`). */
export type Result<T, E> = Ok<T> | Err<E>;

/** Create a successful result. */
export function ok<T>(value: T): Ok<T> {
    return { ok: true, value };
}

/** Create a failed result. */
export function err<E>(error: E): Err<E> {
    return { ok: false, error };
}

// ─── Result Utilities ────────────────────────────────────────────────────────

/** Check if a Result is Ok. */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.ok;
}

/** Check if a Result is Err. */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return !result.ok;
}

/** Transform the success value of a Result. */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.ok ? ok(fn(result.value)) : result;
}

/** Transform and flatten the success value of a Result. */
export function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
    return result.ok ? fn(result.value) : result;
}

/** Transform the error value of a Result. */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.ok ? result : err(fn(result.error));
}

/** Unwrap the success value or return a default. */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return result.ok ? result.value : defaultValue;
}

/** Unwrap the success value or compute a default from the error. */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
    return result.ok ? result.value : fn(result.error);
}

/** Pattern match on a Result — exhaustive handling of both branches. */
export function match<T, E, U>(result: Result<T, E>, handlers: { ok: (value: T) => U; err: (error: E) => U }): U {
    return result.ok ? handlers.ok(result.value) : handlers.err(result.error);
}

// ─── Domain Error Types ──────────────────────────────────────────────────────

/** Base interface for all chainskills domain errors. */
export interface ChainskillsError {
    readonly code: string;
    readonly message: string;
}

/** Error during workflow parsing. */
export interface ParseError extends ChainskillsError {
    readonly line?: number;
    readonly column?: number;
}

/** Error during workflow semantic validation. */
export interface ValidationError extends ChainskillsError {
    readonly path?: string;
}

/** Error during workflow execution. */
export interface ExecutionError extends ChainskillsError {
    readonly stepId?: string;
}

/** Error during skill / import resolution. */
export interface ResolveError extends ChainskillsError {
    readonly ref?: string;
}

/** Error during tool invocation (@call). */
export interface ToolError extends ChainskillsError {
    readonly tool?: string;
    readonly method?: string;
}

// ─── Error Factories ─────────────────────────────────────────────────────────

/** Create a `ParseError`. */
export function parseError(
    code: string,
    message: string,
    line?: number,
    column?: number,
): ParseError {
    return { code, message, line, column };
}

/** Create a `ValidationError`. */
export function validationError(
    code: string,
    message: string,
    path?: string,
): ValidationError {
    return { code, message, path };
}

/** Create an `ExecutionError`. */
export function executionError(
    code: string,
    message: string,
    stepId?: string,
): ExecutionError {
    return { code, message, stepId };
}

/** Create a `ResolveError`. */
export function resolveError(
    code: string,
    message: string,
    ref?: string,
): ResolveError {
    return { code, message, ref };
}

/** Create a `ToolError`. */
export function toolError(
    code: string,
    message: string,
    tool?: string,
    method?: string,
): ToolError {
    return { code, message, tool, method };
}

// ─── Async Result Utilities ─────────────────────────────────────────────────

/** Wrap an async operation into a Result, catching errors. */
export async function tryAsync<T, E>(
    fn: () => Promise<T>,
    mapError: (err: unknown) => E,
): Promise<Result<T, E>> {
    try {
        return ok(await fn());
    } catch (e) {
        return err(mapError(e));
    }
}

/** Collect an array of Results into a Result of array. Fails on first error. */
export function allOk<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const r of results) {
        if (!r.ok) return r;
        values.push(r.value);
    }
    return ok(values);
}
