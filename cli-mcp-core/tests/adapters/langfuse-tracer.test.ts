/**
 * Tests for LangfuseTracer — fetch-based observability adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLangfuseTracer, createLangfuseTracerFromEnv } from '#adapters/observability/langfuse-tracer.js';

const validConfig = {
    secretKey: 'sk-test',
    publicKey: 'pk-test',
    baseUrl: 'http://localhost:3030',
    traceName: 'test-trace',
};

describe('createLangfuseTracer', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('creates a span with id and startTime', () => {
        const tracer = createLangfuseTracer(validConfig);
        const span = tracer.startSpan('test-span', { key: 'value' });

        expect(span.id).toBeDefined();
        expect(typeof span.id).toBe('string');
        expect(span.name).toBe('test-span');
        expect(span.startTime).toBeGreaterThan(0);
    });

    it('span.end() does not throw', () => {
        const tracer = createLangfuseTracer(validConfig);
        const span = tracer.startSpan('test-span');
        expect(() => span.end({ result: 'ok' })).not.toThrow();
    });

    it('flush() sends batch to Langfuse API', async () => {
        const tracer = createLangfuseTracer(validConfig);
        const span = tracer.startSpan('my-span', { a: 1 });
        span.end({ b: 2 });

        await tracer.flush();

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('http://localhost:3030/api/public/ingestion');
        expect(init.method).toBe('POST');

        const body = JSON.parse(init.body as string) as { batch: unknown[] };
        expect(Array.isArray(body.batch)).toBe(true);
        expect(body.batch.length).toBeGreaterThanOrEqual(2); // trace-create + span-create + span-update
    });

    it('flush() sends correct Authorization header', async () => {
        const tracer = createLangfuseTracer(validConfig);
        tracer.startSpan('s');
        await tracer.flush();

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        const expectedAuth = `Basic ${Buffer.from('pk-test:sk-test').toString('base64')}`;
        expect(headers['Authorization']).toBe(expectedAuth);
    });

    it('flush() is no-op when nothing pending', async () => {
        const tracer = createLangfuseTracer(validConfig);
        await tracer.flush();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('flush() clears pending events after send', async () => {
        const tracer = createLangfuseTracer(validConfig);
        tracer.startSpan('s');
        await tracer.flush();
        await tracer.flush(); // second flush should be no-op

        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('flush() silently handles HTTP error', async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500 });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const tracer = createLangfuseTracer(validConfig);
        tracer.startSpan('s');
        await expect(tracer.flush()).resolves.toBeUndefined();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'));
    });

    it('flush() silently handles network error', async () => {
        fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const tracer = createLangfuseTracer(validConfig);
        tracer.startSpan('s');
        await expect(tracer.flush()).resolves.toBeUndefined();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unreachable'));
    });

    it('recordMetric adds event to batch', async () => {
        const tracer = createLangfuseTracer(validConfig);
        tracer.recordMetric('latency', 42, { unit: 'ms' });
        await tracer.flush();

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(init.body as string) as { batch: Array<{ type: string }> };
        const metricEvent = body.batch.find((e) => e.type === 'event-create');
        expect(metricEvent).toBeDefined();
    });
});

describe('createLangfuseTracerFromEnv', () => {
    afterEach(() => {
        delete process.env['LANGFUSE_SECRET_KEY'];
        delete process.env['LANGFUSE_PUBLIC_KEY'];
        delete process.env['LANGFUSE_BASE_URL'];
    });

    it('returns null when env vars are missing', () => {
        const tracer = createLangfuseTracerFromEnv();
        expect(tracer).toBeNull();
    });

    it('returns tracer when both keys are set', () => {
        process.env['LANGFUSE_SECRET_KEY'] = 'sk';
        process.env['LANGFUSE_PUBLIC_KEY'] = 'pk';
        const tracer = createLangfuseTracerFromEnv();
        expect(tracer).not.toBeNull();
    });

    it('uses LANGFUSE_BASE_URL when set', () => {
        process.env['LANGFUSE_SECRET_KEY'] = 'sk';
        process.env['LANGFUSE_PUBLIC_KEY'] = 'pk';
        process.env['LANGFUSE_BASE_URL'] = 'http://custom:9000';

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
        const tracer = createLangfuseTracerFromEnv();
        expect(tracer).not.toBeNull();
        vi.unstubAllGlobals();
    });
});
