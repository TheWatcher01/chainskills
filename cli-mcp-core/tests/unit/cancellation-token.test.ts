/**
 * Tests for CancellationToken.
 */

import { describe, it, expect } from 'vitest';
import { CancellationTokenSource } from '../../src/core/entities/cancellation-token.js';

describe('CancellationToken', () => {
    it('should initially not be cancelled', () => {
        const source = new CancellationTokenSource();
        expect(source.token.isCancelled()).toBe(false);
    });

    it('should be cancelled after cancel() is called', () => {
        const source = new CancellationTokenSource();
        source.cancel();
        expect(source.token.isCancelled()).toBe(true);
    });

    it('should notify listeners when cancelled', () => {
        const source = new CancellationTokenSource();
        let notified = false;

        source.token.onCancelled(() => {
            notified = true;
        });

        source.cancel();
        expect(notified).toBe(true);
    });

    it('should immediately call listener if already cancelled', () => {
        const source = new CancellationTokenSource();
        source.cancel();

        let notified = false;
        source.token.onCancelled(() => {
            notified = true;
        });

        expect(notified).toBe(true);
    });

    it('should not cancel twice', () => {
        const source = new CancellationTokenSource();
        let callCount = 0;

        source.token.onCancelled(() => {
            callCount++;
        });

        source.cancel();
        source.cancel(); // Second call should be no-op

        expect(callCount).toBe(1);
    });
});
