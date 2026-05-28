// ObjectPool.ts — Generic pool. Stage 8: added _allItems tracking.
export class ObjectPool {
    constructor(factory, prewarm = 0) {
        Object.defineProperty(this, "_pool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "_active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        }); // currently checked out
        Object.defineProperty(this, "_factory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_created", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "_peak", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this._factory = factory;
        for (let i = 0; i < prewarm; i++) {
            this._pool.push(this._factory());
            this._created++;
        }
    }
    get() {
        const obj = this._pool.length > 0 ? this._pool.pop() : (() => { this._created++; return this._factory(); })();
        this._active.push(obj);
        if (this._active.length > this._peak)
            this._peak = this._active.length;
        return obj;
    }
    release(obj) {
        obj.reset();
        const i = this._active.indexOf(obj);
        if (i !== -1)
            this._active.splice(i, 1);
        this._pool.push(obj);
    }
    /** Currently active (checked out) items */
    get activeItems() { return this._active; }
    get activeCount() { return this._active.length; }
    get totalCreated() { return this._created; }
    get peakActive() { return this._peak; }
    clear() { this._pool.length = 0; this._active.length = 0; }
}
