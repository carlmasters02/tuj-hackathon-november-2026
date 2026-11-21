/** A small, warm plucked voice for the composer. Web Audio only; nothing is downloaded. */
let ctx: AudioContext | null = null;

export function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function pluck(hz: number, when = audio().currentTime, dur = 0.45, gain = 0.18) {
  const ac = audio();
  const out = ac.createGain();
  out.gain.setValueAtTime(0, when);
  out.gain.linearRampToValueAtTime(gain, when + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(hz * 6, when);
  lp.frequency.exponentialRampToValueAtTime(hz * 1.5, when + dur);
  for (const [type, detune, g] of [["triangle", 0, 1], ["sine", 1200, 0.25]] as const) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.detune.value = detune;
    const og = ac.createGain();
    og.gain.value = g;
    o.connect(og).connect(lp);
    o.start(when);
    o.stop(when + dur + 0.05);
  }
  lp.connect(out).connect(ac.destination);
}
