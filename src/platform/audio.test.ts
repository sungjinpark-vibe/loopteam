/**
 * audio port tests — F-BGM (ADDENDUM-05 §5 / AC 9). jsdom has no
 * `AudioContext` at all, which is exactly the default (and most important)
 * test path: `browserAudio` must degrade to no-op behaviour without ever
 * constructing one. The second block stubs a minimal fake `AudioContext` on
 * `globalThis` to exercise the real driver's wiring.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { audio, browserAudio, noopAudio } from "./audio";

describe("audio port — no AudioContext available (default jsdom path)", () => {
  it("noopAudio never throws and does nothing observable", () => {
    expect(() => noopAudio.start()).not.toThrow();
    expect(() => noopAudio.setMuted(true)).not.toThrow();
    expect(() => noopAudio.stop()).not.toThrow();
  });

  it("browserAudio degrades to a no-op when AudioContext is absent — start/stop/setMuted never throw, and audio === browserAudio", () => {
    expect((globalThis as { AudioContext?: unknown }).AudioContext).toBeUndefined();
    expect(audio).toBe(browserAudio);
    expect(() => browserAudio.start()).not.toThrow();
    expect(() => browserAudio.setMuted(true)).not.toThrow();
    expect(() => browserAudio.setMuted(false)).not.toThrow();
    expect(() => browserAudio.stop()).not.toThrow();
    // idempotent — a second start/stop pair still must not throw
    expect(() => browserAudio.start()).not.toThrow();
    expect(() => browserAudio.stop()).not.toThrow();
    expect(() => browserAudio.stop()).not.toThrow();
  });
});

// --- fake AudioContext, just enough surface for src/bgm.ts's graph ---
function fakeParam() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
}
function fakeNode() {
  return { connect: () => {}, disconnect: () => {} };
}
class FakeAudioContext {
  currentTime = 0;
  state: "running" | "suspended" | "closed" = "suspended";
  destination = fakeNode();
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  createGain() {
    return { ...fakeNode(), gain: fakeParam() };
  }
  createBiquadFilter() {
    return { ...fakeNode(), type: "lowpass", frequency: fakeParam(), Q: fakeParam() };
  }
  createDelay() {
    return { ...fakeNode(), delayTime: fakeParam() };
  }
  createOscillator() {
    return { ...fakeNode(), type: "sine", frequency: fakeParam(), detune: fakeParam(), start() {}, stop() {} };
  }
}

describe("audio port — AudioContext available (fake driver)", () => {
  afterEach(() => {
    browserAudio.stop();
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
    vi.useRealTimers();
  });

  it("start() constructs the context and schedules bgm; setMuted() and stop() are honoured without throwing", () => {
    vi.useFakeTimers();
    (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext = FakeAudioContext as unknown as typeof AudioContext;

    expect(() => browserAudio.start()).not.toThrow();
    expect(() => browserAudio.setMuted(true)).not.toThrow();
    expect(() => browserAudio.setMuted(false)).not.toThrow();
    // idempotent start — calling again while already running must not throw or double-schedule
    expect(() => browserAudio.start()).not.toThrow();
    expect(() => browserAudio.stop()).not.toThrow();
    // idempotent stop
    expect(() => browserAudio.stop()).not.toThrow();
  });
});
