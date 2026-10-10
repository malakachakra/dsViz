// ---------- Fluid: a small incompressible-flow solver on the GPU ----------
// Velocity lives in a low-res texture (p-units per second). Scenes push it around with force splats,
// and their warp shaders carry the picture along it, so the image moves like smoke or liquid.
const FLUID = (() => {
  if (!gl) return null;
  const SH = 144, FH = `#version 300 es
precision highp float; precision highp sampler2D; in vec2 uv; out vec4 o;
uniform sampler2D a, b; uniform vec2 tx, sc; uniform float dt, k;
#define L(s) texture(s, uv-vec2(tx.x,0.))
#define R(s) texture(s, uv+vec2(tx.x,0.))
#define T(s) texture(s, uv+vec2(0.,tx.y))
#define Bt(s) texture(s, uv-vec2(0.,tx.y))
`;
  const mk = body => program(VERT, FH + 'void main(){' + body + '}');
  const P = {
    curl: mk(`o=vec4(.5*((R(a).y-L(a).y)-(T(a).x-Bt(a).x)),0.,0.,1.);`),
    vort: mk(`float c=texture(b,uv).x; vec2 f=.5*vec2(abs(T(b).x)-abs(Bt(b).x), abs(R(b).x)-abs(L(b).x));
      f=f/(length(f)+1e-4)*k*c; f.y=-f.y; o=vec4(texture(a,uv).xy+f*dt,0.,1.);`),
    advect: mk(`vec2 q=uv-dt*texture(b,uv).xy*sc; float wall=smoothstep(0.,.05,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
      o=vec4(texture(a,q).xy*k*wall,0.,1.);`),
    div: mk(`o=vec4(.5*(R(a).x-L(a).x+T(a).y-Bt(a).y),0.,0.,1.);`),
    scale: mk(`o=texture(a,uv)*k;`),
    jacobi: mk(`o=vec4((L(a).x+R(a).x+T(a).x+Bt(a).x-texture(b,uv).x)*.25,0.,0.,1.);`),
    grad: mk(`o=vec4(texture(b,uv).xy-.5*vec2(R(a).x-L(a).x, T(a).x-Bt(a).x),0.,1.);`)
  };
  let w = 0, h = 0, vA, vB, pA, pB, dv, cu;
  function size(asp) {
    const nw = Math.max(8, Math.round(SH * asp));
    if (nw === w) return;
    [vA, vB, pA, pB, dv, cu].forEach(freeTarget);
    w = nw; h = SH; [vA, vB, pA, pB, dv, cu] = [0, 0, 0, 0, 0, 0].map(() => target(w, h, gl.CLAMP_TO_EDGE));
  }
  function pass(pr, dst, a, b, kv, dtv, asp) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, w, h); gl.useProgram(pr.p);
    bindTex(0, a.tex); gl.uniform1i(pr.u.a, 0); if (b) { bindTex(1, b.tex); gl.uniform1i(pr.u.b, 1); }
    if (pr.u.tx) gl.uniform2f(pr.u.tx, 1 / w, 1 / h); if (pr.u.sc) gl.uniform2f(pr.u.sc, .5 / asp, .5);
    if (pr.u.k) gl.uniform1f(pr.u.k, kv); if (pr.u.dt) gl.uniform1f(pr.u.dt, dtv); tri();
  }
  const swapV = () => { const t = vA; vA = vB; vB = t; }, swapP = () => { const t = pA; pA = pB; pB = t; };
  return {
    get tex() { return vA ? vA.tex : null; },
    size,
    // opts: vort (swirl strength), damp (velocity lost per second). forces() draws splats with F.* helpers.
    step(dt, asp, opts, forces) {
      size(asp); gl.disable(gl.BLEND);
      pass(P.curl, cu, vA); pass(P.vort, vB, vA, cu, opts.vort == null ? 8 : opts.vort, dt); swapV();
      gl.bindFramebuffer(gl.FRAMEBUFFER, vA.fb); gl.viewport(0, 0, w, h); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      D.begin(asp, 1); forces(); D.end(); gl.disable(gl.BLEND);
      pass(P.advect, vB, vA, vA, Math.exp(-(opts.damp == null ? .6 : opts.damp) * dt), dt, asp); swapV();
      pass(P.div, dv, vA); pass(P.scale, pB, pA, null, .8); swapP();
      for (let i = 0; i < 16; i++) { pass(P.jacobi, pB, pA, dv); swapP(); }
      pass(P.grad, vB, pA, vA); swapV();
    }
  };
})();

// Force helpers for scenes. Positions and forces are in p-space (screen half-height = 1).
const F = {
  splat(x, y, fx, fy, r) { D.sprite(x, y, r, 0, fx, fy, 0, 1, 0, 0, 1, 1); },
  burst(x, y, power, r, n) { power *= CFG.punch; const o = Math.random() * 6.283; for (let i = 0; i < n; i++) { const a = o + i / n * 6.283, c = Math.cos(a), s = Math.sin(a); F.splat(x + c * r, y + s * r, c * power, s * power, r * 1.3); } },
  swirl(x, y, power, r) { for (let i = 0; i < 4; i++) { const a = i * 1.5708, c = Math.cos(a), s = Math.sin(a); F.splat(x + c * r, y + s * r, -s * power, c * power, r * 1.1); } }
};

// ---------- Camera: where we look at the picture from ----------
// Kicks push it in, every eighth beat it swings to a new angle, a change in the song swings it further.
// In a 3D space it also turns to face somewhere new and keeps travelling forward.
const CAM = { yaw: 0, pitch: 0, roll: 0, dist: 1, vy: 0, vp: 0, vr: 0, vd: 0, ty: 0, tp: 0, tr: 0, mark: -1, side: 1, heading: 0, headT: 0, vh: 0, travel: 0, px: 0, pz: 0, lastAmt: 1 };
const clampN = (x, a, b) => Math.max(a, Math.min(b, x));
function camUpdate(dt, time) {
  const amt = CFG.cam, live = amt > 0 ? 1 : 0, en = Math.min(1.5, A.energy);
  if (A.onSwing || (A.onBeat && A.beats % 8 === 0 && A.beats !== CAM.mark)) {
    CAM.mark = A.beats; CAM.side = -CAM.side; const big = A.onSwing ? 1.35 : 1;
    CAM.ty = CAM.side * (.14 + Math.random() * .18) * big; CAM.tp = (Math.random() * 2 - 1) * .2 * big; CAM.tr = (Math.random() * 2 - 1) * .08 * big;
    CAM.headT += CAM.side * (.35 + Math.random() * .8) * big;
  }
  if (en < .05) { CAM.ty *= 1 - dt * .5; CAM.tp *= 1 - dt * .5; CAM.tr *= 1 - dt * .5; }   // silence: ease back to centre
  if (A.onKick) { CAM.vd -= (1.1 + .25 * Math.min(3, A.bass)) * Math.min(1.5, CFG.punch); CAM.vr += CAM.side * .25; }
  const gy = (CAM.ty + .05 * Math.sin(time * .23) * (.3 + en)) * live, gp = (CAM.tp + .04 * Math.sin(time * .31 + 1) * (.3 + en)) * live, gr = (CAM.tr + .025 * Math.sin(time * .17)) * live;
  const gd = live ? .94 - .03 * Math.min(2, A.bassA) : 1;
  const sp = (x, v, g, k, c) => v + ((g - x) * k - v * c) * dt;
  CAM.vy = sp(CAM.yaw, CAM.vy, gy, 9, 3.6); CAM.vp = sp(CAM.pitch, CAM.vp, gp, 9, 3.6); CAM.vr = sp(CAM.roll, CAM.vr, gr, 14, 4.5); CAM.vd = sp(CAM.dist, CAM.vd, gd, 60, 9);
  CAM.yaw += CAM.vy * dt; CAM.pitch += CAM.vp * dt; CAM.roll += CAM.vr * dt; CAM.dist = clampN(CAM.dist + CAM.vd * dt, .7, 1.1);
  CAM.headT += dt * .05 * en * CAM.side;
  CAM.vh = sp(CAM.heading, CAM.vh, CAM.headT, 4, 3.4); CAM.heading += CAM.vh * dt;
  const v = (.16 + .4 * en + .9 * Math.min(1.5, A.kick)) * CFG.speed * Math.min(1, amt + .3), h = (CAM.heading + CAM.yaw * 1.5) * amt;
  CAM.travel += v * dt; CAM.px -= Math.sin(h) * v * dt; CAM.pz -= Math.cos(h) * v * dt;
}
const camVec = new Float32Array(4), flyVec = new Float32Array(4);
const STAGES = ['Flat', 'Tunnel', 'Dome', 'Floor'];
function camFor(S) {   // each scene can scale the motion (cam), cap it (camCap) and add a resting pose (camBase)
  const P = S.P, amt = CFG.cam, m = Math.min((P.cam == null ? 1 : P.cam) * amt, P.camCap || 9), b = P.camBase || {}, st = S.stage || 0;
  if (st === 0) { camVec[0] = clampN(CAM.yaw * m, -.8, .8) + (b.yaw || 0); camVec[1] = clampN(CAM.pitch * m, -.6, .6) + (b.pitch || 0); camVec[2] = CAM.roll * m; camVec[3] = (1 - (1 - CAM.dist) * Math.min(m, 1.5)) * (b.dist || 1); }
  else if (st === 1) { camVec[0] = CAM.yaw * 1.7 * amt; camVec[1] = CAM.pitch * 1.7 * amt; camVec[2] = (CAM.roll * 2 + CAM.heading * .35) * amt; camVec[3] = 1; }
  else if (st === 2) { camVec[0] = (CAM.heading + CAM.yaw * 2) * amt; camVec[1] = clampN(CAM.pitch * 1.8 * amt, -.7, .7); camVec[2] = CAM.roll * amt; camVec[3] = 1; }
  else { camVec[0] = (CAM.heading + CAM.yaw * 1.5) * amt; camVec[1] = -.17 + clampN(CAM.pitch * .8 * amt, -.2, .3); camVec[2] = CAM.roll * 1.6 * amt; camVec[3] = 1; }
  return camVec;
}
function flyFor(S, time) { flyVec[0] = CAM.px; flyVec[1] = S.stage === 1 ? CAM.travel : CAM.pz; flyVec[2] = time * .2; return flyVec; }
// How far past the picture's edge the tilted view would reach, from the four screen corners (same maths as the shader).
function camFit(S, asp) {
  if (S.P.fit === false || S.stage) return 1;
  const c = camVec, cy = Math.cos(c[0]), sy = Math.sin(c[0]), cp = Math.cos(c[1]), sn = Math.sin(c[1]), cr = Math.cos(c[2]), sr = Math.sin(c[2]), FOC = 2.4;
  const R = (x, y, z) => { const y1 = cp * y - sn * z, z1 = sn * y + cp * z; return [cy * x + sy * z1, y1, -sy * x + cy * z1]; };
  const ro = R(0, 0, FOC * c[3]); let m = 1;
  for (let i = 0; i < 4; i++) {
    const sx = (i & 1 ? 1 : -1) * asp, sy2 = i & 2 ? 1 : -1, rd = R(cr * sx + sr * sy2, -sr * sx + cr * sy2, -FOC), t = -ro[2] / Math.min(rd[2], -1e-3);
    m = Math.max(m, Math.abs(ro[0] + rd[0] * t) / asp, Math.abs(ro[1] + rd[1] * t));
  }
  return 1 + (Math.min(m, 3) - 1) * .5;
}
