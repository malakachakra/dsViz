// ---------- Liquid scenes, part 1: carried by the fluid solver ----------
// force() pushes the fluid, draw() adds dye, and the warp shader moves the dye along the flow.
const rnd = (a, b) => a + Math.random() * (b - a);

PRESETS.push({
  name: 'Velvet Smoke', accent: '#c084fc', fluid: { vort: 9, damp: .45 },
  warp: `vec3 warp(vec2 p){
    vec2 q=p-V(p)*dt;
    vec3 c=mix(P(q), B(q), .015);
    return hueRot(c,.002)*DK(.9945-.003*trebA)/(1.+.010*lum(c)); }`,
  comp: `vec3 comp(vec2 p){
    vec2 e=vec2(.014,0.);
    vec2 g=vec2(lum(B(p+e.xy))-lum(B(p-e.xy)), lum(B(p+e.yx))-lum(B(p-e.yx)));
    vec3 c=P(p)*clamp(1.+dot(g,vec2(-.6,.7))*5., .45, 1.7);       // side light gives the smoke some body
    c+=glow(p)*.55+vec3(.010,.007,.026);
    return c*vig(p); }`,
  em(S, k) { const a = k * TAU / 3 + S.mt * .06, x = Math.cos(a) * D.aspect * .55, y = Math.sin(a) * .62, j = S.j ? S.j[k] : [0, 0], tx = .3 * Math.sin(S.mt * .23 + k * 2) + j[0], ty = .3 * Math.cos(S.mt * .19 + k * 3) + j[1], l = Math.hypot(tx - x, ty - y); return [x, y, (tx - x) / l, (ty - y) / l, [A.bassA, A.midA, A.trebA][k]]; },
  force(S, dt) {
    for (let k = 0; k < 3; k++) { const [x, y, dx, dy, lv] = this.em(S, k), a = (2.5 + 10 * lv) * dt; F.splat(x, y, dx * a, dy * a, .16); }
    if (A.onKick) {      // the kick is a gust out of the loudest jet, and all three jets swing to aim somewhere new, so the smoke trails out across the screen; they drift back over a few seconds
      const lv = [A.bassA, A.midA, A.trebA], k = lv.indexOf(Math.max(...lv)), [x, y, dx, dy] = this.em(S, k);
      F.burst(x + dx * .12, y + dy * .12, .8 + .35 * A.bass, .13, 10);
      S.j = [0, 1, 2].map(() => [rnd(-.7, .7) * D.aspect, rnd(-.7, .7)]);
    }
    if (S.j) for (const j of S.j) { j[0] *= Math.max(0, 1 - dt * .5); j[1] *= Math.max(0, 1 - dt * .5); }
    for (let i = Math.floor(A.trebA * 1.5 * Math.random()); i > 0; i--) { const a = rnd(0, TAU); F.splat(rnd(-1, 1) * D.aspect, rnd(-1, 1), Math.cos(a) * .35, Math.sin(a) * .35, .07); }
  },
  draw(S) {
    for (let k = 0; k < 3; k++) { const [x, y, , , lv] = this.em(S, k); palJS(A.hue + k * .28, tmpC); D.sprite(x, y, .08 + .04 * lv, 0, tmpC.r, tmpC.g, tmpC.b, .12 + .3 * lv, 0, 0, 1, 1); }
    const R = .10 + .04 * A.bassA;
    D.line(160, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU, r = R + w * .06; p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; palJS(A.hue + .2 + u * .15, p, 1); }, { w: .012, closed: true, gain: .10, core: .3 });
  }
});

PRESETS.push({
  name: 'Oil Slick', accent: '#34d399', fluid: { vort: 14, damp: .35 },
  warp: `vec3 warp(vec2 p){ vec2 q=p-V(p)*dt; vec3 c=mix(P(q), B(q), .01); return c*DK(.9975)/(1.+.006*lum(c)); }`,
  // The buffer holds film thickness; colour comes from interference, the way petrol on water does it.
  comp: `
  vec3 film(float th){ return .5+.5*cos(TAU*(th*vec3(1.,1.22,1.55)+vec3(0.,.08,.2)+hue)); }
  vec3 comp(vec2 p){
    vec2 e=vec2(.006,0.);
    float th=lum(P(p)), ths=lum(B(p));
    vec2 g=vec2(lum(P(p+e.xy))-lum(P(p-e.xy)), lum(P(p+e.yx))-lum(P(p-e.yx)));
    vec3 n=normalize(vec3(-g*5.,1.)), r=reflect(rd,n);
    float on=smoothstep(.02,.3,th);
    vec3 c=film(th*1.5+.2*ths)*on*(.5+.4*smoothstep(0.,1.2,th));
    c+=vec3(1.)*pow(max(dot(r,normalize(vec3(.3,.5,.8))),0.),50.)*.7*on;     // wet highlight
    c+=vec3(.05,.07,.10)*pow(1.-max(dot(-rd,n),0.),3.)+vec3(.006,.009,.016);  // dark water under it
    return c*vig(p); }`,
  init(S) { S.v = [0, 1, 2].map(k => ({ ph: rnd(0, TAU), sp: rnd(.15, .3) * (k % 2 ? -1 : 1) })); },
  pos(S, k) { const v = S.v[k], a = S.mt * v.sp + v.ph; return [Math.cos(a) * D.aspect * .5 * (.6 + .4 * Math.sin(a * .7 + k)), Math.sin(a * 1.3 + k) * .6]; },
  force(S, dt) {
    for (let k = 0; k < 3; k++) { const [x, y] = this.pos(S, k); F.swirl(x, y, (k % 2 ? -1 : 1) * (.6 + 4.5 * A.midA + 3 * A.kick) * dt, .16); }     // the whirlpools spin up on a kick
    if (A.onKick) { S.kx = rnd(-.6, .6) * D.aspect; S.ky = rnd(-.6, .6); F.burst(S.kx, S.ky, .9 + .4 * A.bass, .12, 10); F.swirl(S.kx, S.ky, (Math.random() < .5 ? -1 : 1) * .5 * CFG.punch, .2); }   // and the film folds around where the drop fell
    const a = S.mt * .11; F.splat(0, 0, Math.cos(a) * A.bassA * dt * .8, Math.sin(a) * A.bassA * dt * .8, 1.1);
  },
  draw(S) {
    for (let k = 0; k < 3; k++) { const [x, y] = this.pos(S, k), lv = [A.bassA, A.midA, A.trebA][k], a = .03 + .09 * lv; D.sprite(x, y, .06 + .03 * lv, 0, 1, 1, 1, a, 0, 0, 1, 1); }
    if (A.onKick) D.sprite(S.kx, S.ky, .13, 0, 1, 1, 1, .9 * CFG.punch, 0, 0, 1, 1);
  }
});

const POURS = [
  [[.02, .30, .38], [.95, .36, .52], [.98, .78, .32], [.95, .93, .88], [.05, .08, .22]],
  [[.10, .12, .40], [.20, .65, .85], [.96, .94, .90], [.92, .45, .20], [.03, .05, .12]],
  [[.35, .08, .30], [.95, .60, .25], [.98, .88, .70], [.15, .50, .48], [.06, .04, .10]]
];
PRESETS.push({
  name: 'Acrylic Pour', accent: '#f472b6', blend: 'over', fluid: { vort: 5, damp: 1.3 },
  warp: `vec3 warp(vec2 p){ vec2 q=p-V(p)*dt; return clamp(P(q),0.,1.5); }`,
  comp: `#define RAW
  vec3 comp(vec2 p){
    vec2 e=vec2(.004,0.);
    vec3 c=P(p);
    vec2 g=vec2(lum(P(p+e.xy))-lum(P(p-e.xy)), lum(P(p+e.yx))-lum(P(p-e.yx)));
    vec2 gs=vec2(lum(B(p+e.xy*6.))-lum(B(p-e.xy*6.)), lum(B(p+e.yx*6.))-lum(B(p-e.yx*6.)));
    vec3 n=normalize(vec3(-(g*2.5+gs*3.),1.));
    c*=1.-.3*smoothstep(0.,.14,length(g));                                 // ridges where two colours meet
    c=pow(c,vec3(.9))*(.95+.3*n.y)+pow(max(dot(reflect(rd,n),normalize(vec3(-.35,.5,.8))),0.),28.)*.3;   // wet varnish
    return clamp(c,0.,1.)*(.8+.2*vig(p)); }`,
  init(S) { S.pal = POURS[Math.floor(Math.random() * POURS.length)]; S.ci = 0; S.px = 0; S.py = 0; S.tx = 0; S.ty = 0; },
  force(S, dt) {
    if (A.onSwing || (A.onBeat && A.beats % 2 === 0)) { S.tx = rnd(-.7, .7) * D.aspect; S.ty = rnd(-.65, .65); }
    S.px += (S.tx - S.px) * dt * 3; S.py += (S.ty - S.py) * dt * 3;
    if (A.onBeat) F.burst(S.px, S.py, .8 + .4 * A.bass, .12, 12);
    const a = S.mt * .13 + A.bstep * .2; F.splat(0, 0, Math.cos(a) * A.bassA * dt * 1.2, Math.sin(a) * A.bassA * dt * 1.2, 1.3);   // tilt the canvas
    F.swirl(-S.px * .6, -S.py * .6, (.3 + 2.2 * A.midA) * dt, .22);
  },
  draw(S) {
    if (S.t < 3) { const b = S.pal[0]; D.sprite(0, 0, 4, 0, b[0], b[1], b[2], .05, 0, 0, .01, 0); }        // prime the canvas with a base coat
    if (A.onBeat) S.ci = (S.ci + 1) % S.pal.length;
    const c = S.pal[S.ci];
    D.sprite(S.px, S.py, A.onBeat ? .13 + .05 * A.bass : .04 + .02 * A.bassA, 0, c[0], c[1], c[2], A.onBeat ? 1 : .7, 0, 0, .15, 0);
    if (A.onKick) for (let k = 1; k < 4; k++) { const d = S.pal[(S.ci + k) % S.pal.length], a = rnd(0, TAU); D.sprite(S.px + Math.cos(a) * .3, S.py + Math.sin(a) * .3, rnd(.05, .09), 0, d[0], d[1], d[2], 1, 0, 0, .15, 0); }
    for (let i = Math.floor(A.trebA * 1.2 * Math.random()); i > 0; i--) { const d = S.pal[(S.ci + 2) % S.pal.length]; D.sprite(S.px + rnd(-.4, .4), S.py + rnd(-.4, .4), rnd(.006, .016), 0, d[0], d[1], d[2], .9, 0, 0, .3, 0); }
  }
});

PRESETS.push({
  name: 'Glass Tide', accent: '#7dd3fc', fluid: { vort: 10, damp: .5 },
  warp: `vec3 warp(vec2 p){ vec2 q=p-V(p)*dt; vec3 c=mix(P(q), B(q), .03); return c*DK(.993)/(1.+.01*lum(c)); }`,
  // The buffer is the thickness of a clear liquid; what you see is a wall of light bent through it.
  comp: `
  vec3 bg(vec2 q){
    float s=sin(q.x*2.2+q.y*1.3+mt*.15), s2=sin(q.x*7.-q.y*4.+mt*.3);
    vec3 c=mix(pal(hue+.06*s), pal(hue+.3), smoothstep(-1.1,1.1,q.y+.3*s))*(.16+.22*s*s);
    c+=mix(vec3(1.),pal(hue+.15),.4)*pow(.5+.5*sin(q.x*3.+q.y*1.6+1.+.4*s2),7.)*.5;      // soft light strips
    return c*(.6+.25*bassA); }
  vec3 comp(vec2 p){
    vec2 e=vec2(.012,0.);
    float h=lum(B(p))*.6+lum(P(p))*.4;
    vec2 g=vec2(lum(B(p+e.xy))-lum(B(p-e.xy)), lum(B(p+e.yx))-lum(B(p-e.yx)))*.6
          +vec2(lum(P(p+e.xy*.5))-lum(P(p-e.xy*.5)), lum(P(p+e.yx*.5))-lum(P(p-e.yx*.5)))*.4;
    vec2 off=g*2.4;
    vec3 c=vec3(bg(p-off*.88).r, bg(p-off).g, bg(p-off*1.14).b);          // each colour bends a little differently
    c=mix(c, c*(.55+pal(hue+.3)*.9), smoothstep(0.,1.2,h)*.5);
    vec3 n=normalize(vec3(-g*7.,1.));
    c+=pow(max(dot(reflect(rd,n),normalize(vec3(.3,.6,.75))),0.),60.)*1.3*smoothstep(.03,.3,h)+smoothstep(.02,.2,length(g))*.07;
    return c*vig(p); }`,
  force(S, dt) {
    for (let k = 0; k < 2; k++) { const a = S.mt * (.22 + .06 * k) + k * 3.1, x = Math.cos(a) * D.aspect * .45, y = Math.sin(a * 1.4) * .5; F.swirl(x, y, (k ? -1 : 1) * (.5 + 3.5 * A.midA) * dt, .2); F.splat(x, y, -Math.sin(a) * A.bassA * dt * 2.5, Math.cos(a * 1.4) * A.bassA * dt * 2.5, .2); }
    if (A.onKick) { S.kx = rnd(-.6, .6) * D.aspect; S.ky = rnd(-.6, .6); F.burst(S.kx, S.ky, .9 + .4 * A.bass, .14, 10); }
  },
  draw(S) {
    for (let k = 0; k < 2; k++) { const a = S.mt * (.22 + .06 * k) + k * 3.1, lv = k ? A.midA : A.bassA; D.sprite(Math.cos(a) * D.aspect * .45, Math.sin(a * 1.4) * .5, .09 + .04 * lv, 0, 1, 1, 1, .05 + .12 * lv, 0, 0, 1, 1); }
    if (A.onKick) D.sprite(S.kx, S.ky, .16, 0, 1, 1, 1, .8, 0, 0, 1, 1);
    for (let i = Math.floor(A.trebA * Math.random() * 1.3); i > 0; i--) D.sprite(rnd(-1, 1) * D.aspect, rnd(-1, 1), rnd(.02, .04), 0, 1, 1, 1, .5, 0, 0, 1, 1);
  }
});
