// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions.ts — One owner for a group of EventBus subscriptions.
//
// WHY: EventBus is a process-wide singleton that outlives every scene, so a listener that is
// never removed keeps running (and keeps references to a dead scene) after a restart. Pairing
// every `EventBus.on` with a hand-written `EventBus.off` drifts apart as events are added.
// A component creates one Subscriptions object, registers through it, and calls dispose() once
// on shutdown: whatever was registered is exactly what gets removed.
//
// Listeners run in registration order. Register in the order the rules must run.
// ─────────────────────────────────────────────────────────────────────────────

import { EventBus, type GameEventKey } from './EventBus';

type Handler = (...args: unknown[]) => void;

interface Entry {
  readonly event: GameEventKey;
  readonly fn: Handler;
  readonly context: unknown;
}

export class Subscriptions {
  private readonly _entries: Entry[] = [];

  /** Number of live subscriptions held by this owner. */
  get size(): number { return this._entries.length; }

  on(event: GameEventKey, fn: Handler, context?: unknown): void {
    EventBus.on(event, fn, context);
    this._entries.push({ event, fn, context });
  }

  /** Remove everything registered through this owner, newest first. Safe to call repeatedly. */
  dispose(): void {
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const { event, fn, context } = this._entries[i];
      EventBus.off(event, fn, context);
    }
    this._entries.length = 0;
  }
}
