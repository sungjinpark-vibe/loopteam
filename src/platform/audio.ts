/**
 * audio port — F-BGM (ADDENDUM-05 §5), mirrors haptics.ts / analytics.ts.
 * jsdom has no `AudioContext`; `browserAudio.start()` checks for it lazily
 * (not at module load) and no-ops when absent, so this file is stubbable in
 * tests exactly like the other two ports and never throws.
 *
 * `browserAudio` also owns the two browser-policy concerns F-BGM needs: an
 * `AudioContext` can't play before a user gesture on mobile, so `start()`
 * arms a one-shot listener on `window` that resumes the context on the first
 * pointer/touch/key interaction anywhere in the app; and a backgrounded tab
 * should not hum, so it also tracks `visibilitychange` for as long as it's
 * running. Both listeners are torn down in `stop()`.
 */
import { scheduleBgm, type BgmHandle } from "../bgm";

export interface AudioPort {
  start(): void;
  stop(): void;
  setMuted(muted: boolean): void;
}

export const noopAudio: AudioPort = {
  start: () => {},
  stop: () => {},
  setMuted: () => {},
};

function getAudioContextCtor(): typeof AudioContext | undefined {
  return (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
}

function createBrowserAudio(): AudioPort {
  let ctx: AudioContext | null = null;
  let handle: BgmHandle | null = null;
  let muted = false;
  let cleanupListeners: (() => void) | null = null;

  function resumeOnGesture(): void {
    const resume = () => void ctx?.resume();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];
    events.forEach((type) => window.addEventListener(type, resume, { once: true }));
    const onVisibility = () => {
      if (!ctx) return;
      if (document.visibilityState === "hidden") void ctx.suspend();
      else void ctx.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    cleanupListeners = () => {
      events.forEach((type) => window.removeEventListener(type, resume));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  return {
    start() {
      if (handle) return; // idempotent
      const Ctx = getAudioContextCtor();
      if (!Ctx) return; // no AudioContext (jsdom / unsupported) — behave as no-op
      ctx = new Ctx();
      resumeOnGesture();
      handle = scheduleBgm(ctx, muted);
    },
    stop() {
      handle?.dispose();
      handle = null;
      cleanupListeners?.();
      cleanupListeners = null;
      void ctx?.suspend();
    },
    setMuted(next) {
      muted = next;
      handle?.setMuted(next);
    },
  };
}

export const browserAudio: AudioPort = createBrowserAudio();

export const audio: AudioPort = browserAudio;
