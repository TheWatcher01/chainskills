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
