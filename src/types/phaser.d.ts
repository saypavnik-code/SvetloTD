// phaser.d.ts — Minimal type stub for tsc --noEmit (no node_modules/phaser).
// Vite uses the real phaser at build time.
declare module 'phaser' {
  namespace Types {
    namespace Core { interface GameConfig { [k: string]: unknown } }
    namespace Math  { interface Vector2Like { x: number; y: number } }
  }
  namespace Textures { const FilterMode: { NEAREST: 0; LINEAR: 1 }; }
  namespace Scale { const FIT = 1; const CENTER_BOTH = 1; }
  namespace Input {
    class Pointer { x: number; y: number; button: number; }
    namespace Keyboard {
      const KeyCodes: {
        ONE:number; TWO:number; THREE:number; FOUR:number; FIVE:number;
        ESC:number; SPACE:number; DELETE:number; U:number; TAB:number; M:number;
      };
      interface Key {
        on(event:string, cb:()=>void): this;
        once(event:string, cb:()=>void): this;
      }
    }
    interface InputPlugin {
      on(event:string, cb:(arg:unknown)=>void): this;
      off(event:string, cb?:(arg:unknown)=>void): this;
      setDefaultCursor(c:string): void;
      keyboard: {
        addKey(code:number): Keyboard.Key;
        on(e:string, cb:(arg:unknown)=>void): void;
      } | null;
    }
  }
  namespace Math {
    function DegToRad(deg:number): number;
  }
  namespace Events {
    class EventEmitter {
      emit(event:string, ...args:unknown[]): boolean;
      on(event:string, fn:(...a:unknown[])=>void, ctx?:unknown): this;
      once(event:string, fn:(...a:unknown[])=>void, ctx?:unknown): this;
      off(event:string, fn?:(...a:unknown[])=>void, ctx?:unknown): this;
      removeAllListeners(event?:string): this;
    }
  }
  namespace GameObjects {
    class Graphics {
      setDepth(d:number): this; setPosition(x:number,y:number): this;
      setVisible(v:boolean): this; setAlpha(a:number): this;
      setScale(s:number): this; setInteractive(cfg?:unknown): this;
      clear(): this;
      fillStyle(c:number,a?:number): void;
      fillRect(x:number,y:number,w:number,h:number): void;
      fillRoundedRect(x:number,y:number,w:number,h:number,r:number): void;
      fillCircle(x:number,y:number,r:number): void;
      fillEllipse(x:number,y:number,w:number,h:number): void;
      fillPoints(pts:Types.Math.Vector2Like[],close?:boolean): void;
      lineStyle(w:number,c:number,a?:number): void;
      strokeRect(x:number,y:number,w:number,h:number): void;
      strokeRoundedRect(x:number,y:number,w:number,h:number,r:number): void;
      strokeCircle(x:number,y:number,r:number): void;
      strokePoints(pts:Types.Math.Vector2Like[],close?:boolean): void;
      beginPath(): void; moveTo(x:number,y:number): void;
      lineTo(x:number,y:number): void; strokePath(): void;
      destroy(): void;
    }
    class Text {
      x:number; y:number; width:number; height:number;
      setDepth(d:number): this; setPosition(x:number,y:number): this; setX(x:number): this;
      setVisible(v:boolean): this; setAlpha(a:number): this; setOrigin(x:number,y?:number): this;
      setInteractive(cfg?:unknown): this; setActive(v:boolean): this;
      setColor(c:string): this; setFontSize(s:string): this; setFontStyle(s:string): this;
      setText(t:string): this; setScale(s:number): this;
      on(event:string, cb:()=>void): this;
      removeAllListeners(e?:string): this;
    }
    class Zone {
      setDepth(d:number): this; setPosition(x:number,y:number): this;
      setSize(w:number,h:number): this;
      setOrigin(x:number,y?:number): this; setInteractive(cfg?:unknown): this;
      setVisible(v:boolean): this;
      on(event:string, cb:()=>void): this;
      removeAllListeners(e?:string): this;
      scaleX:number; scaleY:number;
    }
    class Container {
      setDepth(d:number): this; setVisible(v:boolean): this;
      setAlpha(a:number): this; setPosition(x:number,y:number): this;
      add(child:unknown): this; remove(child:unknown,destroy?:boolean): this;
      removeAll(destroy?:boolean): this;
      visible:boolean; alpha:number;
    }
    interface GameObjectFactory {
      graphics(cfg?:unknown): Graphics;
      text(x:number,y:number,t:string,style?:unknown): Text;
      container(x:number,y:number): Container;
      zone(x:number,y:number,w:number,h:number): Zone;
      existing<T>(obj:T): T;
    }
  }
  namespace Tweens {
    interface Tween { stop(): void; }
    interface TweenManager {
      add(cfg:unknown): Tween;
      killTweensOf(target:unknown): void;
    }
  }
  namespace Time {
    interface TimerEvent { remove(): void; }
    interface Clock {
      delayedCall(delay:number,cb:()=>void): TimerEvent;
    }
  }
  interface Camera {
    setBackgroundColor(c:number|string): void;
    fadeIn(d:number,...a:unknown[]): void;
    fadeOut(d:number,...a:unknown[]): void;
    once(e:string,cb:()=>void): void;
  }
  class Scene {
    readonly add:    GameObjects.GameObjectFactory;
    readonly cameras:{ main: Camera };
    readonly input:  Input.InputPlugin;
    readonly tweens: Tweens.TweenManager;
    readonly time:   Time.Clock;
    readonly textures: { setFilter(f:number): void };
    readonly scene:  { start(key:string, data?:unknown): void };
    readonly children: { list: GameObjects.Graphics[] };
    constructor(config: { key: string });
  }
  const AUTO: number;
  class Game { constructor(config: Types.Core.GameConfig) {} }
}

// Vite's import.meta.env
interface ImportMeta {
  readonly env: {
    readonly DEV:  boolean;
    readonly PROD: boolean;
    readonly MODE: string;
    readonly [key: string]: unknown;
  };
}
