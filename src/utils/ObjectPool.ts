// ObjectPool.ts — Generic pool. Stage 8: added _allItems tracking.

export interface Poolable { reset(): void; }

export class ObjectPool<T extends Poolable> {
  private readonly _pool:     T[] = [];
  private readonly _active:   T[] = [];  // currently checked out
  private readonly _factory:  () => T;
  private _created = 0;
  private _peak    = 0;

  constructor(factory: () => T, prewarm = 0) {
    this._factory = factory;
    for (let i=0; i<prewarm; i++) { this._pool.push(this._factory()); this._created++; }
  }

  get(): T {
    const obj = this._pool.length > 0 ? this._pool.pop()! : (() => { this._created++; return this._factory(); })();
    this._active.push(obj);
    if (this._active.length > this._peak) this._peak = this._active.length;
    return obj;
  }

  release(obj: T): void {
    obj.reset();
    const i = this._active.indexOf(obj);
    if (i !== -1) this._active.splice(i, 1);
    this._pool.push(obj);
  }

  /** Currently active (checked out) items */
  get activeItems(): T[] { return this._active; }
  get activeCount():  number { return this._active.length; }
  get totalCreated(): number { return this._created; }
  get peakActive():   number { return this._peak; }
  clear(): void { this._pool.length = 0; this._active.length = 0; }
}
