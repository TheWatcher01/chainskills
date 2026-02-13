/**
 * Tests for the ExecutionEventEmitter: event registration, emission,
 * listener management.
 */

import { describe, it, expect } from 'vitest';
import { createEventEmitter } from '#core/ports/execution-events.port.js';
import type { ExecutionEvent } from '#core/ports/execution-events.port.js';

describe('createEventEmitter', () => {
    it('should create an emitter with on/off/emit methods', () => {
        const emitter = createEventEmitter();
        expect(typeof emitter.on).toBe('function');
        expect(typeof emitter.off).toBe('function');
        expect(typeof emitter.emit).toBe('function');
    });

    it('should deliver emitted events to listeners', () => {
        const emitter = createEventEmitter();
        const received: ExecutionEvent[] = [];

        emitter.on((event) => received.push(event));

        const event: ExecutionEvent = {
            type: 'workflow:start',
            timestamp: Date.now(),
            workflowName: 'test',
            totalSteps: 3,
            dryRun: false,
        };

        emitter.emit(event);
        expect(received).toHaveLength(1);
        expect(received[0]!.type).toBe('workflow:start');
    });

    it('should support multiple listeners', () => {
        const emitter = createEventEmitter();
        const received1: string[] = [];
        const received2: string[] = [];

        emitter.on((event) => received1.push(event.type));
        emitter.on((event) => received2.push(event.type));

        emitter.emit({
            type: 'step:start',
            timestamp: Date.now(),
            stepId: 's1',
            stepTitle: 'Step 1',
            stepIndex: 0,
            totalSteps: 1,
        });

        expect(received1).toHaveLength(1);
        expect(received2).toHaveLength(1);
    });

    it('should unregister a listener with off()', () => {
        const emitter = createEventEmitter();
        const received: string[] = [];

        const listener = (event: ExecutionEvent) => received.push(event.type);
        emitter.on(listener);

        emitter.emit({
            type: 'step:start',
            timestamp: Date.now(),
            stepId: 's1',
            stepTitle: 'Step 1',
            stepIndex: 0,
            totalSteps: 1,
        });
        expect(received).toHaveLength(1);

        emitter.off(listener);

        emitter.emit({
            type: 'step:end',
            timestamp: Date.now(),
            stepId: 's1',
            success: true,
            duration: 10,
        });
        expect(received).toHaveLength(1); // No new event
    });

    it('should handle emit with no listeners', () => {
        const emitter = createEventEmitter();
        // Should not throw
        expect(() =>
            emitter.emit({
                type: 'workflow:end',
                timestamp: Date.now(),
                workflowName: 'test',
                success: true,
                duration: 100,
            }),
        ).not.toThrow();
    });

    it('should deliver events in order', () => {
        const emitter = createEventEmitter();
        const types: string[] = [];

        emitter.on((event) => types.push(event.type));

        emitter.emit({
            type: 'workflow:start',
            timestamp: Date.now(),
            workflowName: 'test',
            totalSteps: 2,
            dryRun: false,
        });
        emitter.emit({
            type: 'step:start',
            timestamp: Date.now(),
            stepId: 's1',
            stepTitle: 'Step 1',
            stepIndex: 0,
            totalSteps: 2,
        });
        emitter.emit({
            type: 'step:end',
            timestamp: Date.now(),
            stepId: 's1',
            success: true,
            duration: 5,
        });
        emitter.emit({
            type: 'workflow:end',
            timestamp: Date.now(),
            workflowName: 'test',
            success: true,
            duration: 10,
        });

        expect(types).toEqual([
            'workflow:start',
            'step:start',
            'step:end',
            'workflow:end',
        ]);
    });

    it('should deliver loop:iteration events', () => {
        const emitter = createEventEmitter();
        const events: ExecutionEvent[] = [];

        emitter.on((event) => events.push(event));

        emitter.emit({
            type: 'loop:iteration',
            timestamp: Date.now(),
            stepId: 'loop-step',
            index: 2,
            total: 5,
            item: 'test-item',
        });

        expect(events).toHaveLength(1);
        const event = events[0]!;
        expect(event.type).toBe('loop:iteration');
        if (event.type === 'loop:iteration') {
            expect(event.index).toBe(2);
            expect(event.total).toBe(5);
            expect(event.item).toBe('test-item');
        }
    });

    it('should deliver parallel events', () => {
        const emitter = createEventEmitter();
        const events: ExecutionEvent[] = [];
        emitter.on((event) => events.push(event));

        emitter.emit({
            type: 'parallel:start',
            timestamp: Date.now(),
            stepIds: ['a', 'b', 'c'],
        });
        emitter.emit({
            type: 'parallel:end',
            timestamp: Date.now(),
            results: { a: { success: true }, b: { success: true }, c: { success: false, error: 'oops' } },
            duration: 50,
        });

        expect(events).toHaveLength(2);
        expect(events[0]!.type).toBe('parallel:start');
        expect(events[1]!.type).toBe('parallel:end');
    });

    it('should deliver error events', () => {
        const emitter = createEventEmitter();
        const errors: string[] = [];

        emitter.on((event) => {
            if (event.type === 'error') {
                errors.push(event.message);
            }
        });

        emitter.emit({
            type: 'error',
            timestamp: Date.now(),
            stepId: 'failing-step',
            message: 'Something went wrong',
        });

        expect(errors).toEqual(['Something went wrong']);
    });
});
