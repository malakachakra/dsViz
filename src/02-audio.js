// ---------- Audio analysis ----------
// Every band is measured against its own recent average, so a quiet stream and a loud one
// drive the visuals equally hard: ~1 means "normal for this song", 2+ means a hit.
const A = {
  bass: 0, mid: 0, treb: 0, bassA: 0, midA: 0, trebA: 0, beat: 0, kick: 0, vol: 0,
  hue: Math.random(), hueT: 0, bstep: 0, beats: 0, onBeat: false, onKick: false, onSwing: false,
  spec: new Float32Array(512), wave: new Float32Array(512), live: false, energy: 0,
  level: 0, raw: 0, quiet: 0          // what is actually arriving: meter 0..1, plain loudness, seconds of dead silence
};
A.hueT = A.hue;
const FFT = 2048;
let actx = null, analyser = null, srcNode = null, stream = null, demo = null;
const fdb = new Float32Array(FFT / 2), td = new Float32Array(FFT), mag = new Float32Array(FFT / 2), plog = new Float32Array(FFT / 2);
const avg = { b: 0, m: 0, t: 0, v: 0 };
const fluxLo = new Float32Array(48), fluxHi = new Float32Array(48);
let fluxI = 0, sinceKick = 1, sinceHit = 1, specMax = .3, waveGain = 1, primed = 0, eS = 0, eL = 0, swingCool = 0, inGain = 1;
// Loudness history in one-second buckets (quietest moment and average of each), 40 s deep.
const lvl = { mn: new Float32Array(40).fill(-1), av: new Float32Array(40), i: 0, cmin: 1e9, csum: 0, cn: 0, ct: 0 };
function resetLevels() { lvl.mn.fill(-1); lvl.i = 0; lvl.cmin = 1e9; lvl.csum = 0; lvl.cn = 0; lvl.ct = 0; inGain = 1; A.quiet = 0; }

function ensureCtx() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = FFT; analyser.smoothingTimeConstant = 0;
    analyser.minDecibels = -100; analyser.maxDecibels = 0;
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function stopSource() {
  if (demo) { demo.stop(); demo = null; }
  if (typeof player !== 'undefined' && !player.paused) player.pause();
  if (srcNode) { try { srcNode.disconnect(); } catch (e) {} srcNode = null; }
  if (stream) { stream.getTracks().forEach(tr => tr.stop()); stream = null; }
  try { analyser && analyser.disconnect(); } catch (e) {}
  A.live = false; primed = 0; resetLevels();
}
function stats(buf) { let m = 0, s = 0; for (let i = 0; i < buf.length; i++) m += buf[i]; m /= buf.length;
  for (let i = 0; i < buf.length; i++) s += (buf[i] - m) * (buf[i] - m); return [m, Math.sqrt(s / buf.length)]; }
const ease = (cur, to, rate, dt) => cur + (to - cur) * (1 - Math.exp(-rate * dt));

function analyze(dt) {
  A.onBeat = A.onKick = A.onSwing = false;
  if (!A.live || !analyser) { settle(dt); return; }
  analyser.getFloatFrequencyData(fdb); analyser.getFloatTimeDomainData(td);
  const hz = actx.sampleRate / FFT, N = FFT / 2;
  const iB0 = Math.max(1, Math.round(30 / hz)), iB1 = Math.round(160 / hz), iM1 = Math.round(2200 / hz), iT1 = Math.min(N - 1, Math.round(12000 / hz));
  let rms = 0; for (let i = 0; i < FFT; i += 2) rms += td[i] * td[i]; rms = Math.sqrt(rms / (FFT / 2));
  A.raw = rms; A.quiet = rms < 1e-5 ? A.quiet + dt : 0;
  const meter = Math.min(1, Math.max(0, (20 * Math.log10(rms + 1e-7) + 70) / 64)); A.level = ease(A.level, meter, meter > A.level ? 30 : 6, dt);
  // What counts as silence depends on the source: a captured tab is digitally silent, a microphone never is.
  // The threshold sits just above the quietest moment of the last 40 s, and never above an eighth of the usual level.
  lvl.cmin = Math.min(lvl.cmin, rms); lvl.csum += rms; lvl.cn++; lvl.ct += dt;
  let floor = lvl.cmin, peak = lvl.csum / lvl.cn;
  for (let j = 0; j < 40; j++) if (lvl.mn[j] >= 0) { if (lvl.mn[j] < floor) floor = lvl.mn[j]; if (lvl.av[j] > peak) peak = lvl.av[j]; }
  if (lvl.ct >= 1) { lvl.mn[lvl.i] = lvl.cmin; lvl.av[lvl.i] = lvl.csum / lvl.cn; lvl.i = (lvl.i + 1) % 40; lvl.cmin = 1e9; lvl.csum = 0; lvl.cn = 0; lvl.ct = 0; }
  const thr = Math.max(2e-5, Math.min(floor * 2.2, peak * .12));
  const gate = Math.min(1, Math.max(0, (rms - thr) / (thr * 1.5 + 1e-5)));
  // Bring every source to the same working level, so a faint microphone drives things as hard as a full-scale tab.
  const want = Math.min(2000, Math.max(.4, .12 / (peak + 1e-9)));
  inGain = ease(inGain, want, want < inGain ? 8 : 1.5, dt);
  const g = inGain, gdb = 20 * Math.log10(g);
  rms *= g;
  let b = 0, m = 0, tr = 0, fl = 0, fh = 0;
  for (let i = iB0; i <= iT1; i++) {
    const v = fdb[i] > -160 ? Math.pow(10, fdb[i] / 20) * g : 0; mag[i] = v;
    const lg = Math.log(1 + 2000 * v), d = lg - plog[i]; plog[i] = lg;
    if (i <= iB1) { b += v; if (d > 0) fl += d; }
    else if (i <= iM1) { m += v; if (d > 0) fh += d; }
    else { tr += v; if (d > 0) fh += d * .5; }
  }
  b /= (iB1 - iB0 + 1); m /= (iM1 - iB1); tr /= (iT1 - iM1); fl /= (iB1 - iB0 + 1); fh /= (iT1 - iB1);
  // A swing is the song changing gear: the last half second is much louder or quieter than the last few.
  eS = ease(eS, rms, 5, dt); eL = ease(eL, rms, .3, dt); swingCool -= dt;
  if (primed >= 1 && swingCool <= 0 && (eS > eL * 1.45 || eS < eL * .5)) { A.onSwing = true; swingCool = 5; }

  // Long averages: quick to catch up at the start of a track, slow afterwards.
  primed = Math.min(1, primed + dt * gate * .5);
  const rate = primed < 1 ? 3 : .35;
  avg.b = ease(avg.b, b, rate, dt); avg.m = ease(avg.m, m, rate, dt); avg.t = ease(avg.t, tr, rate, dt); avg.v = ease(avg.v, rms, rate, dt);
  const rel = (x, a) => Math.min(4, Math.pow(x / (a + 1e-7), .8) * gate);
  const nb = rel(b, avg.b), nm = rel(m, avg.m), nt = rel(tr, avg.t), I = CFG.intensity;
  // Intensity and the three band sliders scale the features themselves, so no scene can ignore them.
  A.bass = Math.max(0, 1 + (nb - 1) * 1.15 * (nb > 1 ? 1.25 : 1)) * gate * I * CFG.bass;
  A.mid = Math.max(0, 1 + (nm - 1) * 1.15) * gate * I * CFG.mid; A.treb = Math.max(0, 1 + (nt - 1) * 1.15) * gate * I * CFG.treb;
  A.bassA = ease(A.bassA, A.bass, A.bass > A.bassA ? 22 : 5, dt);
  A.midA = ease(A.midA, A.mid, A.mid > A.midA ? 18 : 4, dt);
  A.trebA = ease(A.trebA, A.treb, A.treb > A.trebA ? 25 : 6, dt);
  A.vol = ease(A.vol, Math.min(3, rms / (avg.v + 1e-6)) * gate * I, 10, dt);
  A.energy = ease(A.energy, gate * Math.min(2, (nb + nm + nt) / 3), .6, dt);

  // Onsets: spectral flux against its own last ~0.8 s.
  sinceKick += dt; sinceHit += dt;
  const [mL, sL] = stats(fluxLo), [mH, sH] = stats(fluxHi);
  const k = 1.5;
  if (gate > .5 && fl > mL + k * sL + .06 && fl > mL * 1.35 && sinceKick > .16) { A.onKick = A.onBeat = true; sinceKick = 0; sinceHit = 0; }
  else if (gate > .5 && fh > mH + (k + .4) * sH + .03 && fh > mH * 1.3 && sinceHit > .2) { A.onBeat = true; sinceHit = 0; }
  fluxLo[fluxI] = fl; fluxHi[fluxI] = fh; fluxI = (fluxI + 1) % fluxLo.length;
  if (A.onKick) { A.kick = CFG.punch; A.beat = CFG.punch; } else if (A.onBeat) A.beat = Math.max(A.beat, .7 * CFG.punch);
  if (A.onBeat) { A.beats++; A.hueT += .045 + Math.random() * .05; }
  decay(dt);

  // Spectrum row: log frequency, tilted so highs read, levelled against its own running peak.
  let mx = 0;
  for (let i = 0; i < 512; i++) {
    const f = 35 * Math.pow(16000 / 35, i / 511), x = f / hz, i0 = Math.min(N - 2, Math.floor(x)), fr = x - i0;
    const db = (fdb[i0] > -160 ? fdb[i0] : -160) * (1 - fr) + (fdb[i0 + 1] > -160 ? fdb[i0 + 1] : -160) * fr + gdb;
    let v = (db + 4.2 * Math.log2(f / 300) + 78) / 62; v = v < 0 ? 0 : v;
    if (v > mx) mx = v;
    v = Math.min(1.2, v / specMax) * gate; v *= v;
    A.spec[i] = v > A.spec[i] ? A.spec[i] + (v - A.spec[i]) * .65 : Math.max(v, A.spec[i] - dt * 1.6);
  }
  specMax = Math.max(.35, mx > specMax ? mx : specMax - dt * .04);

  // Waveform row: start at a rising zero crossing so the scope holds still, then level it.
  let st = 0; for (let i = 1; i < FFT - 520; i++) if (td[i - 1] < 0 && td[i] >= 0 && td[i + 6] > td[i]) { st = i; break; }
  let pk = 0; for (let i = 0; i < 512; i++) { const v = Math.abs(td[st + i]) * g; if (v > pk) pk = v; }
  waveGain = ease(waveGain, Math.min(14, .55 / Math.max(pk, .02)), pk * waveGain > .8 ? 30 : 1.2, dt);
  for (let i = 0; i < 512; i++) A.wave[i] = Math.max(-1, Math.min(1, td[st + i] * g * waveGain)) * gate;
}
function decay(dt) {
  A.beat *= Math.exp(-dt * 4.5); A.kick *= Math.exp(-dt * 6.5);
  A.hueT += dt * .008; A.hue = ease(A.hue, A.hueT, 5, dt); A.bstep = ease(A.bstep, A.beats, 9, dt);
}
function settle(dt) {   // no source: let everything relax to silence
  for (const k of ['bass', 'mid', 'treb', 'bassA', 'midA', 'trebA', 'vol', 'energy', 'level']) A[k] = ease(A[k], 0, 3, dt);
  for (let i = 0; i < 512; i++) { A.spec[i] *= .92; A.wave[i] *= .9; }
  decay(dt);
}

// Stand-in signal for automated checks: a 120 bpm pattern written straight into the features.
function fakeFeatures(time, dt) {
  A.onBeat = A.onKick = false; A.onSwing = (time % 9) < dt;
  const ph = (time * 2) % 1, bar = Math.floor(time * 2) % 4, k = Math.exp(-ph * 7), sn = (bar % 2 === 1) ? Math.exp(-ph * 9) : 0, hat = Math.exp(-((time * 4) % 1) * 12);
  if (ph < dt * 2) { A.onBeat = A.onKick = true; A.kick = A.beat = CFG.punch; A.beats++; A.hueT += .07; }
  const I = CFG.intensity;
  A.bass = (.55 + 2.3 * k) * I * CFG.bass; A.mid = (.8 + 1.3 * sn + .3 * Math.sin(time * 1.3)) * I * CFG.mid; A.treb = (.6 + 1.6 * hat * (.5 + .5 * Math.sin(time * .7))) * I * CFG.treb;
  A.bassA = ease(A.bassA, A.bass, 14, dt); A.midA = ease(A.midA, A.mid, 10, dt); A.trebA = ease(A.trebA, A.treb, 14, dt);
  A.vol = (.8 + .6 * k) * I; A.energy = 1; A.level = .6 + .3 * k; decay(dt);
  for (let i = 0; i < 512; i++) {
    const x = i / 511, n = .5 + .5 * Math.sin(i * 12.9898 + Math.floor(time * 30) * 78.233);
    A.spec[i] = Math.min(1, Math.exp(-x * 9) * (.3 + k) + .5 * Math.exp(-Math.pow((x - .45) / .15, 2)) * (.4 + sn + .3 * Math.sin(time * 3 + x * 20)) + .35 * x * hat * n + .08);
    A.wave[i] = Math.max(-1, Math.min(1, .55 * k * Math.sin(x * 9 + time * 30) + .25 * Math.sin(x * 37 + time * 11) * A.mid * .6 + .22 * hat * (n - .5) + .12 * Math.sin(x * 90 + time * 50)));
  }
}
