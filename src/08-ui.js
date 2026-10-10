// ---------- Controls ----------
const startEl = $('start'), hud = $('hud'), msg = $('msg'), dash = $('dash'), tab = $('tab');
let idleTimer = 0, wake = null, uiClock = 0, hinted = false;
function say(text) { msg.textContent = text || ''; }
function showStart(text) { startEl.hidden = false; hud.hidden = true; tab.hidden = true; $('startClose').hidden = !A.live; say(text); }
function hideStart() { startEl.hidden = true; hud.hidden = false; tab.hidden = false; poke(); }
function poke() {
  hud.classList.remove('idle'); tab.classList.remove('idle'); document.body.classList.remove('nocursor'); clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (startEl.hidden && !dash.classList.contains('open') && (TOUCH || !hud.matches(':hover')) && !hud.contains(document.activeElement)) { hud.classList.add('idle'); tab.classList.add('idle'); document.body.classList.add('nocursor'); } }, 2800);   // a tap leaves a phone "hovering", so only a mouse holds the strip up
}
function explain(err) {
  if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) return 'Audio capture was declined or is blocked on this page. Open the downloaded file in Chrome or Edge to capture a tab, or play audio files here.';
  if (err && err.name === 'NotFoundError') return 'No audio input was found on this computer.';
  return (err && err.message) || 'That source could not be opened.';
}
async function choose(fn) {
  say('');
  try {
    const got = await fn();
    $('player').hidden = srcNode !== playerNode || !playerNode; started = true; hideStart(); syncSource();
    if (TOUCH && !hinted) { hinted = true; $('nameSub').textContent = 'Swipe for the next scene'; setTimeout(() => { if (cur) label(); }, 7000); }   // once, on a touch screen
    if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(w => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {});
    return got;
  } catch (err) { if (!(err && err.name === 'AbortError')) { if (startEl.hidden) showStart(explain(err)); else say(explain(err)); } }
}
$('srcTab').onclick = () => choose(useTab);
$('srcMic').onclick = () => choose(useMic);
$('srcDemo').onclick = () => choose(async () => useDemo());
$('srcFile').onchange = e => { const f = e.target.files; if (f && f.length) choose(async () => useFiles(f)); e.target.value = ''; };
$('pPlay').onclick = () => { if (player.paused) player.play().catch(() => {}); else player.pause(); };
$('pNext').onclick = () => playIndex(qi + 1);
$('bPrev').onclick = () => step(-1);
$('bNext').onclick = () => step(1);
$('bAuto').onclick = $('bAuto2').onclick = () => setAuto(!CFG.auto);
$('bSrc').onclick = () => showStart('');
$('startClose').onclick = hideStart;
$('bFull').onclick = fullscreen;
$('bDash').onclick = () => setDash(!dash.classList.contains('open'));
$('tab').onclick = () => setDash(true);
$('bLink').onclick = copyLink;
$('dashClose').onclick = () => setDash(false);
$('bSpaces').onclick = () => { CFG.spaces = !CFG.spaces; if (!CFG.spaces && cur.stage) cur.stage = 0; syncDash(); saveCfg(); };
$('bFavOnly').onclick = () => { CFG.favOnly = !CFG.favOnly; syncDash(); saveCfg(); };
$('bReset').onclick = () => { const keep = { fav: CFG.fav, hide: CFG.hide, micId: CFG.micId }; Object.assign(CFG, JSON.parse(JSON.stringify(DEFAULTS)), keep); setDetail(CFG.detail); syncDash(); saveCfg(); };   // the scene lists survive a reset
$('bClear').onclick = () => { CFG.fav = {}; CFG.hide = {}; syncDash(); saveCfg(); };
$('micPick').onchange = e => { CFG.micId = e.target.value; saveCfg(); choose(useMic); };
// Copy link: the address already names the scene and its space, so the link opens dsViz right there. Phones get the share sheet.
async function copyLink() {
  const b = $('bLink'), url = location.href;
  if (TOUCH && navigator.share) { try { await navigator.share({ title: 'dsViz', url }); } catch (e) {} return; }
  try { await navigator.clipboard.writeText(url); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy link'; }, 1500); }
  catch (e) { window.prompt('Copy this link', url); }
}
function setAuto(v) { CFG.auto = v; sinceSwitch = 0; syncDash(); saveCfg(); }
function setStage(i) { if (i && !cur.P.stages.includes(i)) return; cur.stage = i; label(); }
// Random and Default for one section of the drawer. Random stays inside each slider's own band (the last column of ROWS).
function sectionDefault(secId) { for (const r of ROWS) if (r[0] === secId) CFG[r[1]] = DEFAULTS[r[1]]; syncDash(); saveCfg(); }
function sectionRandom(secId) { for (const [sec, key, , , , stp, , , band] of ROWS) if (sec === secId && band) CFG[key] = +(Math.round((band[0] + Math.random() * (band[1] - band[0])) / stp) * stp).toFixed(3); syncDash(); saveCfg(); }
function setCam(on) { if (on) CFG.cam = CAM.lastAmt || 1; else { CAM.lastAmt = CFG.cam || 1; CFG.cam = 0; } syncDash(); saveCfg(); }
function setDash(open) { dash.classList.toggle('open', open); document.body.classList.toggle('dash-open', open); $('bDash').setAttribute('aria-pressed', String(open)); poke(); }
function fullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

// Settings drawer: sliders are built from this table so each one is a single line. The last column is the band Random picks from.
const pct = x => Math.round(x * 100) + '%', sec = x => (x >= 10 ? Math.round(x) : x.toFixed(1)) + ' s';
const ROWS = [
  ['secMusic', 'intensity', 'Intensity', 0, 2.5, .05, pct, 'How hard the music drives everything', [.6, 1.6]],
  ['secMusic', 'speed', 'Speed', .25, 2.5, .05, pct, 'How fast things flow and travel', [.5, 1.8]],
  ['secMusic', 'punch', 'Beat punch', 0, 2, .05, pct, 'How hard kicks and beats hit', [.5, 1.6]],
  ['secMusic', 'bass', 'Bass', 0, 2, .05, pct, 'How much the low end counts', [.5, 1.5]],
  ['secMusic', 'mid', 'Mids', 0, 2, .05, pct, 'How much the middle counts', [.5, 1.5]],
  ['secMusic', 'treb', 'Treble', 0, 2, .05, pct, 'How much the high end counts', [.5, 1.5]],
  ['secPic', 'bright', 'Brightness', .3, 1.3, .05, pct, 'Overall brightness. Lower it for a big screen in a dark room', [.7, 1.1]],
  ['secPic', 'trail', 'Trails', .5, 2.5, .05, pct, 'How long things linger before fading', [.6, 2]],
  ['secPic', 'glow', 'Glow', 0, 2, .05, pct, 'The soft bloom around bright areas', [.3, 1.8]],
  ['secPic', 'sat', 'Saturation', 0, 1.5, .05, pct, 'From greyscale to vivid', [.6, 1.4]],
  ['secPic', 'hueShift', 'Colour shift', 0, 1, .01, x => Math.round(x * 360) + '°', 'Rotate every colour around the wheel', [0, 1]],
  ['secCam', 'cam', 'Movement', 0, 2, .05, x => x === 0 ? 'Off' : pct(x), 'How far the camera swings, turns and travels. 0 locks it'],
  ['secScenes', 'sceneSec', 'Each scene', 10, 120, 5, sec, 'How long before Auto moves on'],
  ['secScenes', 'transSec', 'Crossfade', .5, 6, .1, sec, 'How long one scene takes to melt into the next']
];
function buildDash() {
  for (const [secId, key, name, min, max, stp, fmt, tip] of ROWS) {
    const row = document.createElement('label'), sp = document.createElement('span'), inp = document.createElement('input'), out = document.createElement('output');
    row.className = 'row'; row.title = tip; row.htmlFor = 's_' + key; sp.textContent = name;
    inp.type = 'range'; inp.id = 's_' + key; inp.min = min; inp.max = max; inp.step = stp;
    inp.oninput = () => { CFG[key] = +inp.value; out.textContent = fmt(CFG[key]); saveCfg(); };
    row.append(sp, inp, out); row._sync = () => { inp.value = CFG[key]; out.textContent = fmt(CFG[key]); };
    const s = $(secId), anchor = s.querySelector('.btns'); if (secId === 'secScenes') s.insertBefore(row, s.querySelector('.hint')); else if (anchor) s.insertBefore(row, anchor); else s.appendChild(row);
  }
  dash.querySelectorAll('[data-rand]').forEach(b => { b.onclick = () => sectionRandom(b.dataset.rand); });
  dash.querySelectorAll('[data-def]').forEach(b => { b.onclick = () => sectionDefault(b.dataset.def); });
  STAGES.forEach((name, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.title = i ? 'Show this scene as a ' + name.toLowerCase() : 'Show this scene flat'; b.onclick = () => setStage(i); $('spaceBtns').appendChild(b); });
  DETAIL.forEach(([name], i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = name; b.onclick = () => { setDetail(i); syncDash(); }; $('detailBtns').appendChild(b); });
  PRESETS.forEach((P, i) => {
    const li = document.createElement('li'), g = document.createElement('button'), f = document.createElement('button'), h = document.createElement('button');
    g.type = f.type = h.type = 'button'; g.className = 'go'; f.className = h.className = 'tg'; g.textContent = P.name; g.title = 'Show this scene now'; f.textContent = 'Fav'; h.textContent = 'Hide';
    g.onclick = () => go(i);
    f.onclick = () => { if (CFG.fav[P.name]) delete CFG.fav[P.name]; else { CFG.fav[P.name] = true; delete CFG.hide[P.name]; } syncDash(); saveCfg(); };
    h.onclick = () => { if (CFG.hide[P.name]) delete CFG.hide[P.name]; else { CFG.hide[P.name] = true; delete CFG.fav[P.name]; } syncDash(); saveCfg(); };
    li.append(g, f, h); li._sync = () => { f.setAttribute('aria-pressed', String(!!CFG.fav[P.name])); h.setAttribute('aria-pressed', String(!!CFG.hide[P.name])); li.classList.toggle('off', !!CFG.hide[P.name]); };
    $('sceneList').appendChild(li);
  });
}
function syncDash() {
  dash.querySelectorAll('.row').forEach(r => r._sync && r._sync());
  $('sceneList').querySelectorAll('li').forEach(li => li._sync());
  [...$('detailBtns').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === CFG.detail)));
  $('bAuto').setAttribute('aria-pressed', String(CFG.auto)); $('bAuto2').setAttribute('aria-pressed', String(CFG.auto));
  $('bSpaces').setAttribute('aria-pressed', String(CFG.spaces)); $('bFavOnly').setAttribute('aria-pressed', String(CFG.favOnly));
  if (cur) label();
}
function markScene() { [...$('sceneList').children].forEach((li, i) => li.classList.toggle('cur', !!cur && i === cur.i)); }
function syncSource() {
  $('micRow').hidden = sourceKind !== 'mic';
  $('inTxt').textContent = !A.live ? 'No source chosen yet.' : sourceKind === 'mic' ? 'Listening to: ' + micLabel : sourceKind === 'tab' ? 'Listening to: tab or system audio' : sourceKind === 'file' ? 'Playing: audio file' : 'Playing: demo beat';
}
const mB = $('mB'), mM = $('mM'), mT = $('mT'), mBeat = $('mBeat'), inBar = $('inBar'), note = $('note');
function meters(dt) {
  uiClock += dt;
  if (!hud.classList.contains('idle') && !hud.hidden) {
    const I = Math.max(.25, CFG.intensity) * 3;
    mB.style.transform = 'scaleY(' + Math.min(1, .04 + A.bassA / I).toFixed(3) + ')'; mM.style.transform = 'scaleY(' + Math.min(1, .04 + A.midA / I).toFixed(3) + ')';
    mT.style.transform = 'scaleY(' + Math.min(1, .04 + A.trebA / I).toFixed(3) + ')'; mBeat.style.transform = 'scale(' + (.3 + .9 * Math.min(1, A.beat)).toFixed(3) + ')';
  }
  if (dash.classList.contains('open')) inBar.style.transform = 'scaleX(' + A.level.toFixed(3) + ')';
  if (uiClock > .5) {     // twice a second is plenty for text
    uiClock = 0;
    const dead = A.live && A.quiet > 3;
    const text = !dead ? '' : sourceKind === 'mic' ? 'No sound is arriving from this microphone. Try another one under Settings.' : sourceKind === 'tab' ? 'No sound is arriving. Check that audio was shared and something is playing.' : '';
    if (note.textContent !== text) note.textContent = text;
  }
}
['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, poke, { passive: true }));
canvas.addEventListener('dblclick', fullscreen);
// A swipe across the picture changes scene (a mouse drag does the same).
let swX = 0, swY = 0, swOn = false;
canvas.addEventListener('pointerdown', e => { swX = e.clientX; swY = e.clientY; swOn = true; });
canvas.addEventListener('pointerup', e => { if (!swOn) return; swOn = false; const dx = e.clientX - swX, dy = e.clientY - swY; if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy) && startEl.hidden) step(dx < 0 ? 1 : -1); });
canvas.addEventListener('pointercancel', () => { swOn = false; });
// Someone edited the address: follow it.
window.addEventListener('hashchange', () => { const h = fromHash(); if (h && cur && (h.i !== cur.i || h.stage !== (cur.stage || 0))) { go(h.i, true); cur.stage = h.stage; label(); } });
window.addEventListener('keydown', e => {
  const tag = e.target && e.target.tagName;
  if (tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'file')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowright' || (k === ' ' && e.target === document.body)) { step(1); e.preventDefault(); }
  else if (k === 'arrowleft') step(-1);
  else if (k === 'f') fullscreen();
  else if (k === 'l' || k === 'a') setAuto(!CFG.auto);
  else if (k === 'c') setCam(CFG.cam === 0);
  else if (k === 'q') { setDetail(CFG.detail + 1); syncDash(); }
  else if (k === 'd') setDash(!dash.classList.contains('open'));
  else if (k === 'v') cycleStage();
  else if (k === 'r') sectionRandom('secPic');
  else if (k === 's' && startEl.hidden) showStart('');
  else if (k === 'escape') { if (dash.classList.contains('open')) setDash(false); else if (!startEl.hidden && A.live) hideStart(); }
  else if (k >= '0' && k <= '9') { const n = k === '0' ? 9 : +k - 1; if (n < PRESETS.length) go(n); }
});
// Drop audio files anywhere.
let dragDepth = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('drop').hidden = false; });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('drop').hidden = true; } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; $('drop').hidden = true; const f = e.dataTransfer && e.dataTransfer.files; if (f && f.length) choose(async () => useFiles(f)); });

// ---------- Boot ----------
// Phones cannot capture another app's audio, so the microphone leads there; iPhones have no fullscreen either.
if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) { $('srcTab').hidden = true; const m = $('srcMic'); m.classList.add('main'); m.querySelector('small').textContent = 'Listens to the room. Play the music on a speaker nearby.'; m.parentNode.prepend(m); }
if (!document.documentElement.requestFullscreen) $('bFull').hidden = true;
if (!gl) {
  say('This browser has no WebGL2, which the visualizer needs. A current Chrome, Edge or Firefox will run it.');
  document.querySelector('.sources').hidden = true;
} else {
  try {
    for (let i = PRESETS.length - 1; i >= 0; i--) if ((!HDR && (PRESETS[i].fluid || PRESETS[i].sim)) || (!AGENTS.ok && PRESETS[i].agents)) PRESETS.splice(i, 1);   // the simulations need float render targets
    build(); buildDash(); capH = CFG.detail === 0 ? AUTO_CAP : DETAIL[CFG.detail][1]; resize();
    const h = fromHash(), p = pool();                                                   // a link that names a scene opens on it
    if (h) { go(h.i, true); cur.stage = h.stage; label(); } else go(p[Math.floor(Math.random() * p.length)], true);
    syncDash();
    last = performance.now(); requestAnimationFrame(tick);
  } catch (err) { console.error(err); say('The graphics setup failed on this device: ' + err.message); }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); showStart('The graphics context was lost. Reload the page to restart.'); });
}
// Hook for automated checks: steps the renderer on a stand-in signal with no real audio.
window.__viz = {
  names: PRESETS.map(p => p.name), A, CAM, CFG, get cur() { return cur; },
  step(n, dt) { testMode = true; dt = dt || 1 / 60; resize(); for (let i = 0; i < n; i++) { clock += dt; fakeFeatures(clock, dt); render(dt); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); },
  go(i, stage) { go(i, true); if (stage != null) { cur.stage = stage; label(); } }, cut(i) { go(i, false); }, live() { testMode = false; }, sync: () => syncDash()
};
