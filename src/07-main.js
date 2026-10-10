// ---------- Renderer ----------
const $ = id => document.getElementById(id);
const AUXH = 270;
let W = 0, H = 0, fbA = null, fbB = null, auxA = null, auxB = null, bloom = [], capH = 1080, slow = 0, frameMs = 16, curDt = 1 / 60;
let cur = null, old = null, trans = 1, sinceSwitch = 0, bag = [], testMode = false, clock = 0, last = 0, started = false;
const UNI = ['t', 'mt', 'bass', 'mid', 'treb', 'bassA', 'midA', 'trebA', 'beat', 'kick', 'vol', 'hue', 'bstep'];
const DETAIL = [['Auto', 1080], ['720p', 720], ['1080p', 1080], ['1440p', 1440], ['Full', 4320]];
// Which 3D spaces suit which scene (1 tunnel, 2 dome, 3 floor). Scenes not listed are either flat or already 3D.
const SPACES = { 'Plasma Tide': [1, 2], 'Prism Cathedral': [2, 3], 'Aurora Veil': [2], 'Ink Bloom': [3], 'Solar Petals': [1], 'Julia Garden': [1, 2, 3], 'Silk Ribbons': [1],
  'Velvet Smoke': [2], 'Oil Slick': [3], 'Acrylic Pour': [3], 'Glass Tide': [1], 'Pool Floor': [3], 'Quicksilver': [3], 'Petri': [2, 3], 'Maelstrom': [3, 1], 'Hall of Mirrors': [2] };
let downProg, upProg;

function build() {
  downProg = program(VERT, BLUR_DOWN); upProg = program(VERT, BLUR_UP);
  for (const P of PRESETS) {
    P.warpProg = program(VERT, HEAD + P.warp + WARP_MAIN); P.compProg = program(VERT, HEAD + COMP_LIB + P.comp + COMP_MAIN);
    if (P.sim) P.simProg = program(VERT, HEAD + P.sim + SIM_MAIN);
    P.stages = SPACES[P.name] || [];
  }
}
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3), cw = Math.max(2, canvas.clientWidth * dpr), ch = Math.max(2, canvas.clientHeight * dpr), s = Math.min(1, capH / ch);
  const w = Math.round(cw * s), h = Math.round(ch * s);
  if (w === W && h === H) return;
  const nA = target(w, h, gl.MIRRORED_REPEAT), nB = target(w, h, gl.MIRRORED_REPEAT);
  if (fbA) {   // carry the picture across a resize instead of cutting to black
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbA.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, nA.fb);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    freeTarget(fbA); freeTarget(fbB); bloom.forEach(freeTarget);
  }
  fbA = nA; fbB = nB; W = w; H = h; canvas.width = w; canvas.height = h; bloom = [];
  for (let i = 0, bw = w, bh = h; i < 5; i++) { bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1); bloom.push(target(bw, bh, gl.MIRRORED_REPEAT)); }   // mirrored like the picture, so glow has no seam where a space wraps
  const aw = Math.max(8, Math.round(AUXH * w / h));
  if (!auxA || auxA.w !== aw) { freeTarget(auxA); freeTarget(auxB); auxA = target(aw, AUXH, gl.MIRRORED_REPEAT); auxB = target(aw, AUXH, gl.MIRRORED_REPEAT); }
  FLUID.size(w / h);
}
function bindTex(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
function useScene(prog, S, prevTex, blurTex) {
  gl.useProgram(prog.p); const u = prog.u, frn = Math.min(curDt * 60, 2.5);
  bindTex(0, prevTex); bindTex(1, blurTex); bindTex(2, audTex); bindTex(3, FLUID.tex); bindTex(4, auxA.tex);
  gl.uniform1i(u.prev, 0); gl.uniform1i(u.blur, 1); gl.uniform1i(u.aud, 2); gl.uniform1i(u.velT, 3); gl.uniform1i(u.auxT, 4);
  gl.uniform2f(u.res, W, H); gl.uniform1f(u.aspect, W / H); gl.uniform4fv(u.seed, S.seed);
  gl.uniform1f(u.dt, curDt * CFG.speed); gl.uniform1f(u.ax, 2 / AUXH);
  gl.uniform1f(u.spd, CFG.speed * frn); gl.uniform1f(u.dkx, frn / CFG.trail);     // Speed and Trails reach every warp shader here
  gl.uniform4fv(u.cam, camFor(S)); gl.uniform1f(u.fit, camFit(S, W / H)); gl.uniform1i(u.stage, S.stage || 0); gl.uniform4fv(u.fly, flyFor(S, clock));
  gl.uniform4f(u.look, CFG.bright, CFG.sat, CFG.hueShift, CFG.glow);
  for (const k of UNI) if (u[k]) gl.uniform1f(u[k], k === 't' ? S.t : k === 'mt' ? S.mt : A[k]);
}
function pickStage(P) { return CFG.spaces && CFG.cam > 0 && P.stages.length && Math.random() < .55 ? P.stages[Math.floor(Math.random() * P.stages.length)] : 0; }
function makeState(P) { const S = { P, t: 0, mt: Math.random() * 60, seed: [Math.random(), Math.random(), Math.random(), Math.random()], stage: pickStage(P) }; if (P.init) P.init(S); return S; }
function label() {
  $('nameTxt').textContent = cur.P.name;
  $('nameSub').textContent = 'Scene ' + (cur.i + 1) + ' of ' + PRESETS.length + (cur.stage ? ' · ' + STAGES[cur.stage] : '');
  const b = $('bSpace'); if (b) { b.disabled = !cur.P.stages.length; b.textContent = 'Space: ' + STAGES[cur.stage || 0]; }
}
function go(i, instant) {
  i = (i + PRESETS.length) % PRESETS.length;
  old = instant ? null : cur; trans = instant ? 1 : 0; cur = makeState(PRESETS[i]); cur.i = i; sinceSwitch = 0;
  label(); document.documentElement.style.setProperty('--accent', cur.P.accent);
  if (typeof markScene === 'function') markScene();
}
function cycleStage() { const list = [0].concat(cur.P.stages); cur.stage = list[(list.indexOf(cur.stage || 0) + 1) % list.length]; label(); }
// Auto and Next/Prev skip hidden scenes; with "Favourites only" on they stay within the starred ones.
function pool() {
  let p = PRESETS.map((_, i) => i).filter(i => !CFG.hide[PRESETS[i].name]);
  if (CFG.favOnly) { const f = p.filter(i => CFG.fav[PRESETS[i].name]); if (f.length) p = f; }
  return p.length ? p : PRESETS.map((_, i) => i);
}
function step(dir) { const p = pool(); let k = p.indexOf(cur.i); if (k < 0) k = dir > 0 ? -1 : 0; go(p[(k + dir + p.length) % p.length]); }
function nextRandom() {
  const p = pool(); bag = bag.filter(i => p.includes(i) && i !== cur.i);
  if (!bag.length) { bag = p.filter(i => i !== cur.i); bag.sort(() => Math.random() - .5); }
  if (bag.length) go(bag.pop());
}
function setBlend(S) { gl.enable(gl.BLEND); if (S.P.blend === 'over') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFunc(gl.ONE, gl.ONE); }

function render(dt) {
  const k = old ? Math.min(1, trans) : 1, e = k * k * (3 - 2 * k), asp = W / H, drive = .35 + .3 * Math.min(6, A.bassA + A.midA + A.trebA), sdt = dt * CFG.speed;
  curDt = dt;
  for (const S of old ? [cur, old] : [cur]) { S.t += dt; S.mt += sdt * drive; }
  camUpdate(dt, clock);
  audData.set(A.spec, 0); audData.set(A.wave, 512);
  bindTex(2, audTex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 2, gl.RED, gl.FLOAT, audData);

  // 0. simulations the scenes lean on: fluid velocity, and the low-res buffer for ripples and growth
  const fs = cur.P.fluid ? cur : (old && old.P.fluid ? old : null);
  if (fs) FLUID.step(sdt, asp, fs.P.fluid, () => fs.P.force(fs, sdt));
  const ss = cur.P.sim ? cur : (old && old.P.sim ? old : null);
  if (ss) for (let i = 0, n = Math.max(1, Math.min(18, Math.round((ss.P.simSteps || 2) * CFG.speed))); i < n; i++) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, auxB.fb); gl.viewport(0, 0, auxB.w, auxB.h); gl.disable(gl.BLEND);
    useScene(ss.P.simProg, ss, fbA.tex, bloom[1].tex); tri();
    if (i === 0 && ss.P.simDraw) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); D.begin(asp, 1); ss.P.simDraw(ss, sdt); D.end(); }
    const t = auxA; auxA = auxB; auxB = t;
  }
  // 1. bend last frame
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbB.fb); gl.viewport(0, 0, W, H); gl.disable(gl.BLEND);
  useScene(cur.P.warpProg, cur, fbA.tex, bloom[1].tex); tri();
  if (old) { gl.enable(gl.BLEND); gl.blendColor(0, 0, 0, 1 - e); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); useScene(old.P.warpProg, old, fbA.tex, bloom[1].tex); tri(); }
  // 2. add this frame's sound
  setBlend(cur); D.begin(asp, e); cur.P.draw(cur, sdt); D.end();
  if (old) { setBlend(old); D.begin(asp, 1 - e); old.P.draw(old, sdt); D.end(); }
  // 3. blur pyramid: bloom for the composite, and the soft copy the warp shaders read next frame
  gl.disable(gl.BLEND); gl.useProgram(downProg.p); gl.uniform1i(downProg.u.prev, 0);
  let src = fbB;
  for (const b of bloom) { gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb); gl.viewport(0, 0, b.w, b.h); bindTex(0, src.tex); gl.uniform2f(downProg.u.px, 1 / src.w, 1 / src.h); tri(); src = b; }
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(upProg.p); gl.uniform1i(upProg.u.prev, 0);
  for (let i = bloom.length - 2; i >= 0; i--) { const b = bloom[i], s = bloom[i + 1]; gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb); gl.viewport(0, 0, b.w, b.h); bindTex(0, s.tex); gl.uniform2f(upProg.u.px, .5 / s.w, .5 / s.h); tri(); }
  // 4. picture, seen from the camera
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.BLEND);
  useScene(cur.P.compProg, cur, fbB.tex, bloom[0].tex); tri();
  if (old) { gl.enable(gl.BLEND); gl.blendColor(0, 0, 0, 1 - e); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); useScene(old.P.compProg, old, fbB.tex, bloom[0].tex); tri(); gl.disable(gl.BLEND); }
  const tmp = fbA; fbA = fbB; fbB = tmp;
  if (old) { trans += dt / CFG.transSec; if (trans >= 1) old = null; }
}

function tick(now) {
  requestAnimationFrame(tick);
  if (testMode) return;
  const raw = (now - last) / 1000; last = now;
  const dt = Math.min(1 / 20, Math.max(1 / 240, raw));
  resize(); clock += dt; sinceSwitch += dt;
  if (started) analyze(dt); else fakeFeatures(clock, dt);
  if (CFG.auto && !old && ((sinceSwitch > CFG.sceneSec * .8 && A.onKick) || sinceSwitch > CFG.sceneSec * (A.live ? 1.2 : 1.5))) nextRandom();
  render(dt); meters(dt);
  // On Auto detail, drop internal resolution if this machine cannot hold ~45 fps.
  frameMs += (raw * 1000 - frameMs) * .05;
  if (CFG.detail === 0 && frameMs > 23 && raw < .2) { if (++slow > 150 && capH > 540) { capH = Math.round(capH * .8); slow = 0; frameMs = 16; } } else slow = Math.max(0, slow - 2);
}
function setDetail(i) { CFG.detail = (i + DETAIL.length) % DETAIL.length; capH = DETAIL[CFG.detail][1]; slow = 0; frameMs = 16; saveCfg(); }
