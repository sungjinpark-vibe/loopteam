/**
 * bgm.ts — F-BGM ambient loop (ADDENDUM-05 §5). Synthesised with the Web
 * Audio API only: zero audio files, zero licensing exposure (director's
 * condition "저작권 문제 없어야 함"; lifetown's ambience .wav files are
 * deliberately not ported — their generator script is missing, unverifiable).
 * Slow pentatonic arpeggio, two detuned oscillators, lowpass + feedback
 * delay — a village at rest, not a ringtone. Notes are scheduled ahead on
 * `ctx.currentTime`, never with per-note `setTimeout` (drifts, can't be
 * paused by suspending the context alone).
 */

// A minor pentatonic, low register — calm, no leading tone.
const SCALE_HZ = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
// Fixed melodic contour — deterministic on purpose (Math.random is banned
// outside src/platform/random.ts, rule R-6), and a fixed shape is calmer.
const PATTERN = [0, 2, 4, 3, 2, 5, 4, 2, 0, 3, 2, 1];
const STEP_SECONDS = 2.5; // 12 steps * 2.5s ≈ 30s loop
const LOOP_SECONDS = PATTERN.length * STEP_SECONDS;
const MASTER_GAIN = 0.05; // keep it ambient-quiet

export interface BgmHandle {
  setMuted(muted: boolean): void;
  dispose(): void;
}

function scheduleNote(ctx: AudioContext, dest: AudioNode, freqHz: number, at: number): void {
  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0.0001, at);
  noteGain.gain.linearRampToValueAtTime(0.8, at + 0.4); // gentle attack
  noteGain.gain.exponentialRampToValueAtTime(0.001, at + STEP_SECONDS * 1.8); // long release, overlaps next note
  noteGain.connect(dest);

  for (const [type, detuneCents] of [
    ["triangle", -4],
    ["sine", 5],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqHz, at);
    osc.detune.setValueAtTime(detuneCents, at);
    osc.connect(noteGain);
    osc.start(at);
    osc.stop(at + STEP_SECONDS * 2);
  }
}

function scheduleLoop(ctx: AudioContext, dest: AudioNode, startAt: number): void {
  PATTERN.forEach((scaleIndex, step) => scheduleNote(ctx, dest, SCALE_HZ[scaleIndex], startAt + step * STEP_SECONDS));
}

/** Wires the graph, schedules the first loop, and re-arms itself every `LOOP_SECONDS`. */
export function scheduleBgm(ctx: AudioContext, initialMuted: boolean): BgmHandle {
  const master = ctx.createGain();
  master.gain.value = initialMuted ? 0 : MASTER_GAIN;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;

  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.45;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.25;
  delay.connect(feedback);
  feedback.connect(delay);

  filter.connect(master);
  filter.connect(delay);
  delay.connect(master);
  master.connect(ctx.destination);

  let nextLoopAt = ctx.currentTime + 0.05;
  scheduleLoop(ctx, filter, nextLoopAt);
  const timer = setInterval(() => {
    nextLoopAt += LOOP_SECONDS;
    scheduleLoop(ctx, filter, nextLoopAt);
  }, LOOP_SECONDS * 1000);

  return {
    setMuted(muted) {
      master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime + 0.1);
    },
    dispose() {
      clearInterval(timer);
      master.disconnect();
      filter.disconnect();
      delay.disconnect();
      feedback.disconnect();
    },
  };
}
