/**
 * Cancellation token for graceful operation abort.
 *
 * @module core/entities/cancellation-token
 */

export interface CancellationToken {
    isCancelled(): boolean;
    onCancelled(listener: () => void): void;
}

export class CancellationTokenSource {
    private _cancelled = false;
    private _listeners: Array<() => void> = [];

    get token(): CancellationToken {
        return {
            isCancelled: () => this._cancelled,
            onCancelled: (listener) => {
                if (this._cancelled) {
                    listener();
                } else {
                    this._listeners.push(listener);
                }
            },
        };
    }

    cancel(): void {
        if (this._cancelled) return;
        this._cancelled = true;
        for (const listener of this._listeners) {
            listener();
        }
    }
}
