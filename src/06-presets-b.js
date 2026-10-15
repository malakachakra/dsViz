PRESETS.push({
  name: 'Solar Petals', accent: '#ff9f43',
  warp: `vec3 warp(vec2 p){
    float r=length(p), a=atan(p.y,p.x), n=floor(3.+seed.x*5.);
    float z=.976-.014*sin(a*n+mt*.4+r*2.)*(.4+.6*midA)-.035*kick;
    vec2 q=rot(.006*sin(mt*.17)+.004)*p*z;
    q=mix(p,q,spd);
    vec3 c=P(q);
    c=hueRot(c,-.012-.01*trebA);
    return c*DK(.925+.045*smoothstep(0.,.9,r)); }`,
  comp: `vec3 comp(vec2 p){ vec3 c=ca(p,.006+.02*beat)+glow(p)*.8; return c*vig(p); }`,
  init(S) { S.rings = []; },
  draw(S, dt) {
    const R = .15 + .05 * A.bassA + .08 * A.kick;
    D.line(240, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU + S.mt * .3, r = R + w * (.06 + .08 * A.midA); p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; palJS(A.hue + .08 * Math.sin(u * TAU * 2) + w * .1, p, 1); }, { w: .007, closed: true, gain: .6 });
    if (A.onKick && S.rings.length < 6) S.rings.push({ r: .12, l: Math.min(1.5, CFG.punch), h: A.hue + .45 });
    for (const g of S.rings) { g.r += dt * (1.1 + .5 * A.bassA); g.l -= dt * 1.1; palJS(g.h, tmpC); D.sprite(0, 0, g.r, 0, tmpC.r, tmpC.g, tmpC.b, .7 * Math.max(0, g.l), 0, .010 / g.r, .016 / g.r, 0); }
    S.rings = S.rings.filter(g => g.l > 0);
  }
});

PRESETS.push({
  name: 'Starforge', accent: '#b388ff', cam: 0, fit: false,
  warp: `vec3 warp(vec2 p){
    vec2 q=p*(1.-.006*kick);
    q=mix(p,q,spd);
    vec3 c=mix(P(q), B(q), .2);
    return hueRot(c,.004)*DK(.89); }`,
  comp: `vec3 comp(vec2 p){ vec3 c=P(p)*1.15+glow(p)*1.3; c+=vec3(.02,.01,.04)*(1.-length(p)*.4); return c*vig(p); }`,
  // A real galaxy: particles live in 3D on a disc, and the camera orbits it. Depth sets each star's size and brightness.
  init(S) { const n = 900; S.n = n; S.x = new Float32Array(n); S.y = new Float32Array(n); S.z = new Float32Array(n); S.vx = new Float32Array(n); S.vy = new Float32Array(n); S.vz = new Float32Array(n); S.k = new Float32Array(n); S.orb = Math.random() * TAU; S.dir = Math.random() < .5 ? -1 : 1;
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 1.5; S.x[i] = Math.cos(a) * r; S.z[i] = Math.sin(a) * r; S.y[i] = (Math.random() - .5) * .1; S.k[i] = Math.random(); } },
  draw(S, dt) {
    const amt = CFG.cam, swirl = (.5 + 1.1 * A.midA) * S.dir, push = A.onKick ? (1.8 + A.bass * .45) * CFG.punch : 0, pull = .35 + .25 * A.bassA;
    if (A.onKick) S.r0 = rnd(.2, 1.3);                                        // a kick throws the whole disc outward, and harder in one ring of it, so a density wave rolls out
    S.orb += dt * (.10 + .12 * Math.min(2, A.midA)) * S.dir * Math.min(1, amt + .2);
    const yaw = S.orb + (CAM.heading * .6 + CAM.yaw * 2.5) * amt, tilt = .6 + CAM.pitch * 1.8 * amt, roll = CAM.roll * 1.5 * amt, dist = 3.3 * (1 - (1 - CAM.dist) * 1.6 * Math.min(1, amt));
    const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll), f = 2.1;
    for (let i = 0; i < S.n; i++) {
      let x = S.x[i], y = S.y[i], z = S.z[i]; const r = Math.hypot(x, z) + 1e-4, k = S.k[i];
      const arm = Math.sin(Math.atan2(z, x) * 3 - r * 4 + S.mt * .4);     // three loose spiral arms
      const ax = (-z / r) * swirl * (.4 + .6 * k) / (.35 + r) - x / r * pull * (r - .25 - .6 * k) + (x / r) * arm * .25;
      const az = (x / r) * swirl * (.4 + .6 * k) / (.35 + r) - z / r * pull * (r - .25 - .6 * k) + (z / r) * arm * .25;
      const damp = Math.max(0, 1 - 2.2 * dt), ring = push ? Math.max(0, 1 - Math.abs(r - S.r0) / .3) * (.5 + k) : 0, all = .55 * (.3 + k) + ring;
      S.vx[i] = (S.vx[i] + ax * dt + (x / r) * push * all) * damp; S.vz[i] = (S.vz[i] + az * dt + (z / r) * push * all) * damp;
      S.vy[i] = (S.vy[i] - y * 9 * dt + (push ? (Math.random() - .5) * push * (.5 + ring) : 0)) * damp;      // the disc puffs up, the ring most, then it settles flat
      x += S.vx[i] * dt; y += S.vy[i] * dt; z += S.vz[i] * dt;
      if (r > 2.3) { const a = Math.random() * TAU; x = Math.cos(a) * .05; z = Math.sin(a) * .05; y = 0; S.vx[i] = S.vy[i] = S.vz[i] = 0; }
      S.x[i] = x; S.y[i] = y; S.z[i] = z;
      const x1 = cy * x + sy * z, z1 = -sy * x + cy * z, y2 = ct * y - st * z1, z2 = st * y + ct * z1, depth = dist - z2;
      if (depth < .25) continue;
      const sc = f / depth, px = x1 * sc, py = y2 * sc, sp = Math.hypot(S.vx[i], S.vz[i]), tw = Math.random() < .02 * A.trebA ? 3 : 1;
      palJS(A.hue + k * .22 + sp * .12, tmpC);
      D.sprite(cr * px + sr * py, -sr * px + cr * py, (.007 + .009 * k) * sc * (1 + .4 * Math.min(2, A.trebA)) * tw, 0, tmpC.r, tmpC.g, tmpC.b, (.2 + .4 * sp + .35 * A.beat) * Math.min(1.6, sc * sc * 1.6) * Math.min(1, .25 + r * 1.6) * tw, 0, 0, .9, 1);
    }
    const sc0 = f / dist; palJS(A.hue + .1, tmpC); D.sprite(0, 0, (.14 + .1 * A.bassA) * sc0, 0, tmpC.r, tmpC.g, tmpC.b, .05 + .06 * A.kick, 0, 0, 1, 1);
  }
});

PRESETS.push({
  name: 'Neon Horizon', accent: '#ff3d9a', panorama: true,     // in the dome, the sky is overhead and the ground below, so you can turn along the horizon
  warp: `vec3 warp(vec2 p){
    vec2 h=vec2(0.,.08);
    vec2 d=p-h; float z=.972-.03*kick-.006*(bassA-1.);
    float ny=max(abs(d.y)*z-.0035*(1.+.6*bassA), 0.);          // the ground rushes at you, faster on bass
    vec2 q=h+vec2(d.x*mix(z,1.,.3), sign(d.y)*ny);
    q=mix(p,q,spd);
    vec3 c=P(q);
    return hueRot(c,.004)*DK(.972-.012*smoothstep(.0,.9,abs(d.y))); }`,
  comp: `vec3 comp(vec2 p){
    float hz=.08, below=step(p.y,hz);
    vec2 q=p; q.x+=below*.006*sin(p.y*70.+t*3.)*(1.+bassA);
    vec3 c=P(q)+glow(q)*.8;
    float sr=length(p-vec2(0.,hz+.2)), sun=smoothstep(.36,.34,sr)*step(hz,p.y);
    float bars=smoothstep(.0,.02,sin((p.y-hz)*55.-t*.6)+.2+(p.y-hz)*3.);
    vec3 sc=mix(vec3(1.,.2,.5), vec3(1.,.85,.25), clamp((p.y-hz)/.5,0.,1.));
    c+=sc*sun*bars*(.35+.25*bassA+.5*kick);
    c+=sc*.10*exp(-sr*3.5)*(.5+.5*bassA);
    c*=mix(1., .85, below);
    return c*vig(p); }`,
  draw(S) {
    const asp = D.aspect, amp = .26 + .1 * A.bassA;
    for (const sg of [1, -1]) D.line(240, (i, u, p) => { const s = sampleSpec(.02 + mirrorU(u) * .92), e = Math.sin(u * Math.PI); p.x = (u * 2 - 1) * asp * .9; p.y = .08 + sg * (s * amp * e + .004); palJS(A.hue + .55 + s * .3 + (sg < 0 ? .08 : 0), p, (.2 + 1.1 * s) * e); }, { w: .006, gain: sg > 0 ? 1 : .8 });
    if (A.onKick) D.line(2, (i, u, p) => { p.x = (u * 2 - 1) * asp * 1.05; p.y = .055; p.r = 1; p.g = .35; p.b = .6; }, { w: .009, gain: 1.4 * Math.min(1.5, CFG.punch), core: .7 });   // a kick: a grid line lit at the horizon, which the ground then carries toward you
  }
});

PRESETS.push({
  name: 'Julia Garden', accent: '#7cf5ff',
  warp: `vec3 warp(vec2 p){
    vec2 z=rot(mt*.03)*p*.72;
    float cr=.62+.10*(bassA-1.)+.10*kick, ca_=mt*.09+seed.x*6.+bstep*.04;
    vec2 c0=cr*vec2(cos(ca_), sin(ca_*1.3+seed.y*6.));
    vec2 q=vec2(z.x*z.x-z.y*z.y, 2.*z.x*z.y)+c0;         // z*z + c: every frame is one more Julia iteration
    vec3 c=mix(P(q), B(q), .22);
    float m=smoothstep(3.2,2.2,length(q));
    return hueRot(c,.05+.03*trebA)*.90*m; }`,
  comp: `vec3 comp(vec2 p){ vec3 c=P(p)*1.2+glow(p)*1.0; return c*vig(p); }`,
  draw(S) {
    const R = .55 + .06 * A.bassA;
    D.line(260, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU + S.mt * .2, r = R + w * (.08 + .1 * A.midA); p.x = Math.cos(a) * r * 1.25; p.y = Math.sin(a) * r; palJS(A.hue + u * .5, p, .8 + .5 * A.beat); }, { w: .012 + .01 * A.kick, closed: true, gain: .8 });
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + S.mt * .5; palJS(A.hue + .5 + k * .1, tmpC); D.sprite(Math.cos(a) * .3, Math.sin(a) * .3, .03 + .04 * A.trebA, 0, tmpC.r, tmpC.g, tmpC.b, .6 * A.midA, 0, 0, .9, 1); }
  }
});

PRESETS.push({
  name: 'Silk Ribbons', accent: '#ff8fab',
  warp: `vec3 warp(vec2 p){
    vec2 q=p; q.y*=.984-.02*kick; q.x=q.x*.996+.005*sin(p.y*4.+mt*.5)*(.5+bassA);
    q=mix(p,q,spd);
    vec3 c=mix(P(q), B(q), .05);
    return hueRot(c,.006)*DK(.945-.03*smoothstep(.3,1.,abs(p.y))); }`,
  comp: `vec3 comp(vec2 p){ vec2 q=vec2(abs(p.x)-.02*sin(p.y*3.+mt*.3), p.y); vec3 c=P(q)*1.2+glow(q)*.9; return c*vig(p); }`,
  draw(S) {
    const asp = D.aspect;
    for (let k = 0; k < 5; k++) {
      const y0 = .22 * Math.sin(S.mt * (.21 + .05 * k) + k * 1.3), amp = (.08 + .13 * [A.bassA, A.midA, A.trebA, A.midA, A.bassA][k]) * (1 + .6 * A.kick), off = k * .09;
      D.line(200, (i, u, p) => { const w = sampleWave((u * .7 + off) % 1), e = Math.sin(u * Math.PI); p.x = (u * 1.15 - .1) * asp; p.y = y0 + w * amp * (.45 + .55 * e) + .07 * Math.sin(u * 5 + S.mt + k); palJS(A.hue + k * .07 + u * .1, p, .9); }, { w: .005 + .002 * k, gain: .5, core: .8 });
    }
  }
});
