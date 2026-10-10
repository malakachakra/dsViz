// ---------- Scenes ----------
// Each scene is three things: a warp shader (how last frame is bent before the new one is drawn on it),
// a draw step (what the music adds this frame), and a composite shader (how the buffer becomes the picture).
const TAU = Math.PI * 2;
const COMP_LIB = `
#define FOC 2.4
vec2 sp; vec3 ro, rd; float camFade, hitT;      // screen point, camera ray, edge fade, ray length to the picture
float vig(vec2 p){ return smoothstep(1.6,.3,length(sp/vec2(aspect,1.))); }
vec3 glow(vec2 p){ vec3 g=B(p); return g*smoothstep(.04,.8,lum(g))*look.w; }
vec3 ca(vec2 p, float k){ vec2 d=p*k; return vec3(P(p+d).r, P(p).g, P(p-d).b); }
`;
const mirrorU = u => 1 - Math.abs(2 * u - 1);
const PRESETS = [];

PRESETS.push({
  name: 'Plasma Tide', accent: '#ff6ad5',
  warp: `vec3 warp(vec2 p){
    vec2 f=vec2(fbm(p*1.3+vec2(0.,mt*.15)+seed.xy*10.), fbm(p*1.3+vec2(5.2,-mt*.13)+seed.zw*10.))-.47;
    vec2 q=rot(.004*sin(mt*.3)+.012*(midA-1.))*p*(1.-.010-.035*kick);
    q+=f*(.018+.03*bassA);
    q=mix(p,q,spd);
    vec3 c=P(q), b=B(q);
    c+=(c-b)*.24;                         // unsharp feedback: edges grow into cell-like filaments
    c=hueRot(max(c,0.), .012+.025*trebA);
    return c*DK(.972)/(1.+.16*lum(c)); }`,
  comp: `vec3 comp(vec2 p){ vec3 c=P(p)*1.1+glow(p)*.8; return c*vig(p); }`,
  draw(S) {
    const R = .40 + .09 * A.bassA + .14 * A.kick, amp = .10 + .14 * A.midA;
    D.line(300, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU + S.t * .15, r = R + w * amp; p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; palJS(A.hue + u * .3 + w * .15, p, 1.2); }, { w: .010 + .012 * A.kick, closed: true, gain: .7 });
    for (let k = 0; k < 3; k++) { const a = S.mt * (.5 + k * .13) + k * 2.1, r = .75 + .25 * Math.sin(S.mt * .37 + k), lv = [A.bassA, A.midA, A.trebA][k]; palJS(A.hue + .33 * k + .5, tmpC); D.sprite(Math.cos(a) * r * D.aspect * .7, Math.sin(a) * r * .8, .02 + .035 * lv, 0, tmpC.r, tmpC.g, tmpC.b, .5 * lv, 0, 0, .9, 1); }
  }
});

PRESETS.push({
  name: 'Event Horizon', accent: '#5ad1ff',
  warp: `vec3 warp(vec2 p){
    float r=length(p), a=atan(p.y,p.x);
    float z=.962-.055*kick-.012*(bassA-1.);
    vec2 q=rot(.010+.02*(midA-1.)+.012*sin(mt*.21))*p*z;
    q+=.004*vec2(cos(a*3.+mt), sin(a*3.+mt))*trebA;
    q=mix(p,q,spd);
    vec3 c=P(q);
    c=hueRot(c, .014);
    return c*DK(.90+.07*smoothstep(0.,.7,r)); }`,
  comp: `vec3 comp(vec2 p){ vec3 c=ca(p, .010+.03*beat)+glow(p)*.7; return c*vig(p); }`,
  init(S) { S.sides = 3 + Math.floor(Math.random() * 4); },
  draw(S) {
    const base = .13 + .03 * A.bassA;
    D.line(256, (i, u, p) => { const s = sampleSpec(mirrorU(u) * .85), a = u * TAU + A.bstep * .35, r = base + s * .30 * (.5 + .5 * A.bassA); p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; palJS(A.hue + s * .45, p, .35 + 1.2 * s); }, { w: .007, closed: true, gain: .7 });
    if (A.onKick) S.flash = Math.min(1.6, CFG.punch); S.flash = (S.flash || 0) * .7;
    if (S.flash > .05) { palJS(A.hue + .5, tmpC); D.sprite(0, 0, .2 + .05 * (1 - S.flash), A.bstep * .6, tmpC.r, tmpC.g, tmpC.b, 1.4 * S.flash, S.sides, .03, .05, 0); }
    palJS(A.hue + .15, tmpC); D.sprite(0, 0, .04 + .02 * A.bassA, 0, tmpC.r, tmpC.g, tmpC.b, .10 * A.trebA, 0, 0, 1, 1);
  }
});

PRESETS.push({
  name: 'Prism Cathedral', accent: '#ffd166',
  warp: `vec3 warp(vec2 p){
    vec2 q=rot(.005+.012*(midA-1.))*p*(1.010+.03*kick);
    q+=.003*sin(p.yx*5.+mt*.7)*bassA;
    q=mix(p,q,spd);
    vec3 c=mix(P(q), B(q), .04);
    return hueRot(c,.01)*DK(.968); }`,
  comp: `vec3 comp(vec2 p){
    float n=floor(5.+seed.x*4.), seg=TAU/n, r=length(p);
    float a=atan(p.y,p.x)+mt*.04+bstep*.05; a=abs(mod(a,seg)-seg*.5);
    vec2 k=r*vec2(cos(a),sin(a))*.8+vec2(.12,.02);
    vec3 c=P(k)+glow(k)*.9;
    return c*vig(p); }`,
  draw(S) {
    const y0 = .16 + .08 * Math.sin(S.mt * .23), amp = .08 + .12 * A.midA;
    D.line(220, (i, u, p) => { const w = sampleWave(u); p.x = -.1 + u * 1.5; p.y = y0 + u * .35 + w * amp; palJS(A.hue + u * .35, p, 1.1); }, { w: .009, gain: .85 });
    const cx = .55 + .2 * Math.sin(S.mt * .31), cy = .22 + .1 * Math.cos(S.mt * .27), sc = .12 + .07 * A.bassA;
    D.line(160, (i, u, p) => { const a = sampleWave(u * .6), b = sampleWave(u * .6 + .12); p.x = cx + a * sc; p.y = cy + b * sc; palJS(A.hue + .5 + u * .2, p, 1); }, { w: .005, gain: .3 });
    if (A.onBeat) { S.bx = .25 + Math.random() * .8; S.by = Math.random() * .4; S.bl = Math.min(1.5, CFG.punch); S.bs = 3 + Math.floor(Math.random() * 4); }
    S.bl = (S.bl || 0) * .8;
    if (S.bl > .05) { palJS(A.hue + .25, tmpC); D.sprite(S.bx, S.by, .05 + .1 * (1 - S.bl), S.mt, tmpC.r, tmpC.g, tmpC.b, 1.6 * S.bl, S.bs, .04, .08, 0); }
  }
});

PRESETS.push({
  name: 'Aurora Veil', accent: '#6dffb0',
  warp: `vec3 warp(vec2 p){
    vec2 q=p; q.y-=.006+.007*bassA+.02*kick;
    q.x+=.006*sin(p.y*3.+mt*.6)+.004*sin(p.y*7.-mt*.9)*trebA;
    q.x*=.997;
    q=mix(p,q,spd);
    vec3 c=mix(P(q), B(q), .05);
    c=hueRot(c,.0035);
    return c*DK(.987-.012*smoothstep(.1,1.,p.y))*step(-1.,q.y); }`,
  comp: `vec3 comp(vec2 p){
    vec3 c=P(p)*1.5+glow(p)*1.2;
    c+=vec3(.008,.014,.04)*(1.-p.y)*.6;
    return c*vig(p); }`,
  draw(S) {
    const asp = D.aspect;
    D.line(260, (i, u, p) => { const s = sampleSpec(.03 + mirrorU(u) * .9); p.x = (u * 2 - 1) * asp * 1.02; p.y = -.78 + s * .42 + .03 * Math.sin(u * 9 + S.mt); const ray = .35 + .65 * Math.pow(.5 + .5 * Math.sin(u * 61 + 3 * Math.sin(u * 17 + S.mt * .5)), 2); palJS(A.hue + .1 * Math.sin(u * 5 + S.mt * .2) + s * .22, p, (.1 + 1.5 * s) * ray); }, { w: .016, gain: 1, core: .5 });
    const n = Math.floor(A.trebA * 2.5 * Math.random() + (A.onBeat ? 5 : 0));
    for (let k = 0; k < n; k++) D.sprite((Math.random() * 2 - 1) * asp, -.2 + Math.random() * 1.2, .004 + Math.random() * .008, 0, .8, .95, 1, 1.5, 0, 0, .9, 1);
  }
});

PRESETS.push({
  name: 'Ink Bloom', accent: '#e4572e',
  warp: `vec3 warp(vec2 p){
    vec2 n=vec2(fbm(p*1.6+seed.xy*9.+vec2(0.,mt*.08)), fbm(p*1.6+seed.zw*9.+vec2(mt*.07,3.)))-.47;
    vec2 q=p*(1.-.004-.022*kick)+n*(.010+.022*bassA);
    q=mix(p,q,spd);
    vec3 c=P(q), b=B(q);
    c=mix(c,b,.05); c+=(c-b)*.10;
    c=max(c,0.); return c*DK(.991-.004*trebA)/(1.+.035*lum(c)); }`,
  // Subtractive: the buffer holds pigment density, the paper shows through what is left.
  comp: `#define RAW
  vec3 comp(vec2 p){
    vec3 ink=P(p)+B(p)*.3;
    vec3 paper=vec3(.93,.915,.88)-.035*fbm(p*38.)-.03*fbm(p*2.5+3.);
    vec3 c=paper*exp(-ink*1.5);
    return c*(.82+.18*vig(p)); }`,
  draw(S) {
    const pig = [[.92, .86, .42], [.12, .78, .86], [.82, .42, .1]], lv = [A.bassA, A.midA, A.trebA];
    for (let k = 0; k < 3; k++) {
      const a = S.mt * (.35 + .11 * k) + k * 2.2 + A.bstep * .25, r = (.25 + .22 * k) * (.7 + .3 * Math.sin(S.mt * .2 + k * 1.7));
      const e = Math.max(0, lv[k] - .35);
      D.sprite(Math.cos(a) * r * 1.5, Math.sin(a) * r, .05 + .07 * e, 0, pig[k][0], pig[k][1], pig[k][2], .30 * e, 0, 0, .8, .5);
    }
    const R = .16 + .05 * A.bassA + .1 * A.kick;
    D.line(200, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU - S.mt * .1, r = R + w * .12; p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; p.r = p.g = p.b = .15 + .5 * A.kick; }, { w: .004 + .004 * A.kick, closed: true, gain: .22, core: .5 });
  }
});
