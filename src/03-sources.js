// ---------- Audio sources ----------
const RAW_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
let sourceKind = '', micLabel = '';
function attachStream(s) {
  ensureCtx(); stopSource(); stream = s;
  srcNode = actx.createMediaStreamSource(s); srcNode.connect(analyser);   // analysed only, never played back
  A.live = true;
  s.getAudioTracks()[0].addEventListener('ended', () => { if (stream === s) { stopSource(); showStart('The shared audio stopped. Choose a source to carry on.'); } });
}
async function useTab() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('This browser cannot capture tab or system audio. Try Chrome or Edge on a computer.');
  sessionType('auto');
  const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1, width: 320, height: 180, displaySurface: 'window' }, audio: RAW_AUDIO, systemAudio: 'include', selfBrowserSurface: 'exclude' });   // opens on the Window pane; the "Share audio" box is the browser's and cannot be pre-ticked
  if (!s.getAudioTracks().length) { s.getTracks().forEach(tr => tr.stop()); throw new Error('That share had no audio. Try again and tick the "Share audio" box at the bottom of the dialog before confirming.'); }
  attachStream(s); sourceKind = 'tab';
  return 'Tab / system audio';
}
// iPad and iPhone: opening the microphone normally switches the whole device to "play and record", and iOS pauses
// whatever Spotify or Music was playing. Safari's Audio Session API can ask for an "ambient" session instead, which
// lets other apps keep playing; Apple's own rules say that session has no microphone input, so if it comes up deaf
// the mic is reopened the normal way and the attempt is not repeated. There is no third option on iOS: nothing a
// web page can do opens the mic there without one of the two giving way.
const MIX = !!(navigator.audioSession && TOUCH);
function sessionType(t) { try { if (navigator.audioSession) navigator.audioSession.type = t; } catch (e) {} }
async function useMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot open the microphone here.');
  // Echo and noise filtering stay off (they strip music), but the browser may level the mic: asking for it fully
  // raw gave a dead-quiet signal on some Windows audio drivers.
  const want = id => ({ audio: Object.assign({ echoCancellation: false, noiseSuppression: false, autoGainControl: true }, id ? { deviceId: { exact: id } } : {}) });
  const mixing = MIX && CFG.mixApps;
  sessionType(mixing ? 'ambient' : 'auto');
  let s;
  try { s = await navigator.mediaDevices.getUserMedia(want(CFG.micId)); }
  catch (err) { if (!CFG.micId || (err.name !== 'OverconstrainedError' && err.name !== 'NotFoundError')) throw err; CFG.micId = ''; s = await navigator.mediaDevices.getUserMedia(want('')); }
  attachStream(s); sourceKind = 'mic'; micLabel = s.getAudioTracks()[0].label || 'Microphone';
  listMics(s.getAudioTracks()[0].getSettings().deviceId);
  if (mixing) {      // watch the first ten seconds: exact digital silence for 2.5 s means the mixed session gave no input
    let left = 20;
    const watch = setInterval(() => {
      if (stream !== s || --left < 0) { clearInterval(watch); return; }
      if (A.quiet < 2.5) return;
      clearInterval(watch); CFG.mixApps = false; saveCfg();
      useMic().then(() => { if (typeof syncSource === 'function') syncSource(); }).catch(() => {});
    }, 500);
  }
  return 'Microphone';
}
async function listMics(current) {      // device names are only readable once permission has been given
  const sel = document.getElementById('micPick'); if (!sel) return;
  try {
    const mics = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
    sel.textContent = '';
    mics.forEach((d, i) => { const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || 'Microphone ' + (i + 1); if (d.deviceId === current) o.selected = true; sel.appendChild(o); });
  } catch (e) {}
}

// File playback: one <audio> element, a simple queue.
const player = new Audio(); player.preload = 'auto';
let playerNode = null, queue = [], qi = 0, playerUrl = null;
function playIndex(i) {
  if (!queue.length) return;
  qi = (i + queue.length) % queue.length;
  if (playerUrl) URL.revokeObjectURL(playerUrl);
  playerUrl = URL.createObjectURL(queue[qi]); player.src = playerUrl;
  player.play().catch(() => {});
  document.getElementById('track').textContent = queue[qi].name.replace(/\.[^.]+$/, '');
}
player.addEventListener('ended', () => playIndex(qi + 1));
player.addEventListener('play', () => { document.getElementById('pPlay').textContent = 'Pause'; });
player.addEventListener('pause', () => { document.getElementById('pPlay').textContent = 'Play'; });
function useFiles(files) {
  const list = [...files].filter(f => /^(audio|video)\//.test(f.type) || /\.(mp3|m4a|aac|flac|wav|ogg|opus|webm|mp4)$/i.test(f.name));
  if (!list.length) throw new Error('None of those were audio files the browser can play.');
  sessionType('auto'); ensureCtx(); stopSource();
  if (!playerNode) playerNode = actx.createMediaElementSource(player);
  srcNode = playerNode; srcNode.connect(analyser); analyser.connect(actx.destination);
  queue = list; A.live = true; sourceKind = 'file'; playIndex(0);
  return list.length > 1 ? list.length + ' files' : 'File';
}

// Demo: a small generative loop, so the reaction is visible with nothing else playing.
function useDemo() {
  sessionType('auto'); ensureCtx(); stopSource();
  const out = actx.createGain(); out.gain.value = .5; out.connect(analyser); analyser.connect(actx.destination); srcNode = out;
  const nbuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate), nd = nbuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const env = (g, t0, peak, dur) => { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + .004); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur); };
  const noise = (t0, type, freq, peak, dur) => { const n = actx.createBufferSource(); n.buffer = nbuf; n.loop = true; const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = actx.createGain(); env(g, t0, peak, dur); n.connect(f).connect(g).connect(out); n.start(t0, Math.random()); n.stop(t0 + dur + .05); };
  const tone = (t0, type, f0, f1, peak, dur, cut) => { const o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * .6); const g = actx.createGain(); env(g, t0, peak, dur); let n = o; if (cut) { const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t0); f.frequency.exponentialRampToValueAtTime(cut * .25, t0 + dur); f.Q.value = 6; o.connect(f); n = f; } n.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + .05); };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12), step = 60 / 124 / 4;
  const bassLine = [33, 33, 45, 33, 36, 36, 48, 36, 29, 29, 41, 29, 31, 31, 43, 38], chords = [[57, 60, 64], [60, 64, 67], [53, 57, 60], [55, 59, 62]], arp = [0, 1, 2, 1, 2, 1, 0, 2];
  let n = 0, next = actx.currentTime + .08;
  const timer = setInterval(() => {
    while (next < actx.currentTime + .15) {
      const s = n % 16, bar = Math.floor(n / 16), sec = Math.floor(bar / 4) % 4, full = sec !== 2, ch = chords[bar % 4];
      if (s % 4 === 0 && (full || bar % 4 === 3)) tone(next, 'sine', 160, 42, 1.0, .32);
      if (s % 8 === 4 && full) { noise(next, 'bandpass', 1900, .55, .16); tone(next, 'triangle', 220, 160, .25, .1); }
      if (s % 2 === 1 || (sec === 3 && s % 4 === 2)) noise(next, 'highpass', 7500, sec === 0 ? .12 : .2, s % 4 === 3 ? .09 : .04);
      if (s % 2 === 0 || sec === 3) tone(next, 'sawtooth', hz(bassLine[(bar % 4) * 4 + (s >> 2)]), hz(bassLine[(bar % 4) * 4 + (s >> 2)]), full ? .34 : .2, step * 1.7, 700);
      if (sec > 0) tone(next, 'square', hz(ch[arp[s % 8]] + 12), hz(ch[arp[s % 8]] + 12), .1, step * 2.4, 2600 + 1400 * Math.sin(n * .05));
      if (s === 0) ch.forEach((m, i) => tone(next, 'sawtooth', hz(m) * (1 + (i - 1) * .004), hz(m), .09, step * 15.5, 1500));
      n++; next += step;
    }
  }, 25);
  demo = { stop() { clearInterval(timer); out.disconnect(); } };
  A.live = true; sourceKind = 'demo';
  return 'Demo beat';
}
