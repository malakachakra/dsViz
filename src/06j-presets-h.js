// ---------- 3.8.2 scenes, part 1: the signal itself, and two made of light ----------
// Four scenes here are built on the raw waveform and spectrum as physical things: a groove, a turned profile,
// strings, sand on a plate. Two more are glass and tungsten.

PRESETS.push({
  name: 'Vinyl', accent: '#f5d0fe', cam: .5, pitch: .082,
  // A record on a turntable, cut live. Each frame the stretch of groove that passed under the stylus takes the
  // audio the analyser heard this frame, so the side of the song is written into the vinyl as it plays. The platter
  // turns at one speed, as a record does; the stylus tracks inward one groove per turn (pitch), and when it reaches
  // the label the arm lifts, the disc is swapped for a clean one and a new side starts. A change in the song is the
  // gap between two tracks: a stretch of plain groove, then the next track in a new colour. A big kick skips a groove.
  warp: `vec3 warp(vec2 p){ return P(p)*DK(.9985)*smoothstep(.97,.95,length(p))*(1.-u1.x); }`,     // the grooves hold still in the buffer; the composite turns the disc, so they stay sharp. u1.x wipes it at the start and while the arm is up
  comp: `vec3 comp(vec2 p){
    float r=length(p), a=atan(p.y,p.x);
    vec3 c=vec3(.012,.010,.016)+vec3(.02,.015,.03)*fbm(p*3.);                      // the mat
    float disc=smoothstep(.955,.945,r), lab=smoothstep(.31,.30,r), hole=smoothstep(.035,.03,r);
    float fine=.5+.5*sin(r*640.+sin(a*3.)*.5);                                       // the pressed grooves
    float sheen=pow(abs(cos(a-u1.z)),36.)*.5+pow(abs(cos(a-u1.z+1.4)),6.)*.1;       // the light stays put while the grooves turn under it
    vec3 vin=vec3(.035,.03,.04)+vec3(.09,.08,.1)*fine*sheen*(1.+.6*treb);
    vec3 cut=P(rot(-u0.x)*p); vin+=cut*(.45+sheen*.8);                   // the groove the music cut, turned to where the platter is now
    vec3 label=pal(u1.w)*.4*(.75+.25*sin((a-u0.x)*5.+u1.w*20.))*smoothstep(.09,.12,r)+vec3(.04,.03,.03);
    label*=.8+.2*sin(r*180.);
    c=mix(c,vin,disc); c=mix(c,label,lab); c=mix(c,vec3(.0),hole);
    vec2 piv=vec2(aspect*.82,.82), nd=u0.zw, d=nd-piv; float L=length(d); vec2 dn=d/L;   // the tonearm
    vec2 rel=p-piv; float along=dot(rel,dn), perp=abs(dot(rel,vec2(-dn.y,dn.x)));
    float arm=smoothstep(.017,.011,perp)*step(-.02,along)*step(along,L);
    c=mix(c, vec3(.55,.55,.62)*(.55+.45*perp/.017)+vec3(.1)*sheen, arm);
    c=mix(c, vec3(.8,.78,.85), smoothstep(.052,.044,length(p-nd+dn*.03)));
    c=mix(c, vec3(.3,.3,.35), smoothstep(.07,.06,length(p-piv)));
    c+=glow(p)*.5;
    return c*vig(p); }`,
  init(S) { S.om = 1.15; S.rn = .9; S.ra = .9; S.side = 0; S.track = 0; S.lift = 0; S.gap = 0; S.ang = 1.25; S.rot = 0; S.u1[2] = .9; S.u1[3] = Math.random(); },
  update(S, dt) {
    S.rot += S.om * dt; S.u0[0] = S.rot;                                                  // one speed, always: a record does not slow down for a quiet verse
    S.u1[0] = S.t < .25 ? 1 : S.lift > 0 ? Math.min(.3, dt * 4) : 0;                       // arm up: the old side fades out, the next one starts on a clean disc
    if (S.lift > 0) { S.lift -= dt; if (S.lift <= 0) { S.rn = .9; S.side++; S.track = 0; S.u1[3] = Math.random(); } }
    else {
      S.rn -= dt * this.pitch * S.om / TAU;                                                // one groove inward per turn
      if (A.onSwing && S.gap <= 0) { S.gap = .7; S.track++; }                              // the song changes gear: the gap between two tracks
      if (A.onKick && A.bass > 2.5 && S.sk <= 0) { S.rn -= this.pitch; S.sk = 10; }      // a big kick, now and then: the stylus skips a groove
      if (S.rn < .33) S.lift = 2.5;                                                        // the label: lift, swap, new side
    }
    S.gap -= dt; S.sk = (S.sk || 0) - dt;
    S.ra += ((S.lift > 0 ? .9 : S.rn) - S.ra) * Math.min(1, dt * 3);                     // the arm moves, it does not teleport
    S.u0[2] = Math.cos(S.ang) * S.ra; S.u0[3] = Math.sin(S.ang) * S.ra;
  },
  draw(S, dt) {
    if (S.lift > 0) return;
    const r = S.rn, span = S.om * dt * 1.05, h = A.hue + S.side * .17 + S.track * .11, an = S.ang - S.rot, lv = .22 + .18 * Math.min(2, A.vol);   // where the stylus is, in the still buffer
    D.line(2, (i, u, p) => { const a = an - span * (1 - u); p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; palJS(h, p, .35); }, { w: .003, gain: .6, core: .3 });   // the groove itself
    if (S.gap > 0) return;                                                                 // between tracks: plain groove, nothing in it
    // The music in the groove is drawn the way a track's waveform is shown on a player: bars standing across the
    // groove, each as tall as that slice of the frame's audio is loud, close enough to read as one band, and never
    // taller than the gap to the next turn, so the record fills with the song's shape and the turns stay apart.
    const bars = 4, blk = 512 / bars | 0, cap = this.pitch * .42;
    for (let j = 0; j < bars; j++) {
      let e = 0; for (let k = 0; k < blk; k++) { const v = A.wave[j * blk + k]; e += v * v; }
      e = Math.min(1, Math.sqrt(e / blk) * 2.2);
      const a = an - span * (1 - (j + .5) / bars), hh = .004 + (cap - .004) * e, ca = Math.cos(a), sa = Math.sin(a);
      palJS(h + e * .25, tmpC);
      D.line(2, (i, u, p) => { const rr = r + (u * 2 - 1) * hh; p.x = ca * rr; p.y = sa * rr; p.r = tmpC.r; p.g = tmpC.g; p.b = tmpC.b; }, { w: .0034, gain: lv * (.6 + 1.4 * e), core: .6 });
    }
    if (A.onKick) { palJS(h + .5, tmpC); D.line(2, (i, u, p) => { const rr = r - u * .06; p.x = Math.cos(an) * rr; p.y = Math.sin(an) * rr; p.r = tmpC.r; p.g = tmpC.g; p.b = tmpC.b; }, { w: .004, gain: .6 * CFG.punch }); }   // the kick scratches across the grooves
  }
});

PRESETS.push({
  name: 'Lathe', accent: '#fbbf24', fit: false,
  // A vase being turned on a lathe. Its profile is the waveform: a cutting tool travels up and down the piece and
  // reshapes each row it passes to the sound right now, so the vase is always being re-cut; a kick re-cuts the
  // whole piece at once. The wood spins faster with the mids, chips fly from the tool, and the bench reflects it.
  sim: `vec4 sim(vec2 p){
    float y=p.y*.5+.5;
    vec4 s=X(vec2(0.,p.y));
    float sm=(X(vec2(0.,p.y+ax)).r+X(vec2(0.,p.y-ax)).r)*.5;
    float w=wav(fract(y*u1.x+u1.y));
    float base=.22+.1*sin(y*5.3+seed.x*9.)+.08*sin(y*11.+seed.y*7.)+.06*smoothstep(.0,.3,y)*smoothstep(1.,.8,y);
    float want=base+w*u0.y+spec(y*.8)*.07;
    float cut=smoothstep(u0.z,0.,abs(y-u0.x))*u0.w;                // the tool reshapes the rows it is touching
    float r=mix(s.r, want, max(cut, u1.z));                          // u1.z: a kick re-cuts everything
    r=mix(r, sm, .12);
    r=mix(r, want, u1.w);
    return vec4(clamp(r,.03,.6), 0., 0., 1.); }`,
  simSteps: 2,
  warp: `vec3 warp(vec2 p){ vec2 q=p+vec2(0.,-.004)*spd; return mix(P(q),B(q),.2)*DK(.86); }`,
  comp: `vec3 comp(vec2 p){
    vec3 bg=mix(vec3(.018,.013,.010), vec3(.07,.045,.03), smoothstep(-1.,1.,p.y))*(.8+.3*fbm(p*2.+vec2(mt*.02,0.)));
    float ylim=.84; vec2 pp=p; float refl=0.;
    if(p.y<-ylim){ pp.y=-2.*ylim-p.y; refl=1.; }                     // the bench top mirrors the piece
    float prof=X(vec2(0.,pp.y)).r*1.15, dprof=(X(vec2(0.,pp.y+.02)).r-X(vec2(0.,pp.y-.02)).r)*1.15/.04;
    float x=pp.x, inside=step(abs(x),prof)*step(abs(pp.y),ylim);
    float nx=clamp(x/max(prof,1e-3),-1.,1.), nz=sqrt(max(0.,1.-nx*nx));
    vec3 n=normalize(vec3(nx, -dprof*nz, nz));
    float u=atan(nx,nz)/PI+u2.x;                                      // around the spinning surface
    float grain=.55+.45*sin(pp.y*38.+5.*noise(vec2(u*6.,pp.y*2.5)+seed.xy*9.));
    vec3 wood=mix(vec3(.5,.26,.09), vec3(.85,.58,.3), grain)*(.8+.2*sin(u*40.+pp.y*25.));
    wood=mix(wood, wood*pal(hue+pp.y*.2)*1.6, .25);
    vec3 L1=normalize(vec3(.5,.6,.7)), L2=normalize(vec3(-.6,.2,.6));
    float dif=max(dot(n,L1),0.)*.9+max(dot(n,L2),0.)*.4*(.6+.5*bassA)+.07;
    float spc=pow(max(dot(reflect(-L1,n),vec3(0.,0.,1.)),0.),28.)*.55;
    vec3 v=wood*dif+vec3(spc)*(.7+.6*trebA);
    v*=1.-.55*smoothstep(ylim-.12,ylim,abs(pp.y));
    float tool=smoothstep(.035,0.,abs(pp.y-u0.x))*step(abs(x),prof+.03)*u0.w;
    v+=vec3(1.,.55,.2)*tool*(1.2+2.*kick);                            // the cut glows hot
    vec3 c=mix(bg, v*(1.-refl*.55), inside);
    if(refl>.5 && inside<.5) c*=.8;
    c+=P(p)*1.3+glow(p)*.9;                                           // chips and sparks
    return c*vig(p); }`,
  init(S) { S.ty = 0; S.dir = 1; S.spin = 0; S.snap = 0; S.chips = []; S.u1[0] = 1; S.u1[3] = 1; S.first = 0; },
  update(S, dt) {
    S.first += dt; S.u1[3] = S.first < .3 ? 1 : 0;
    const sp = (.22 + .25 * Math.min(2, A.energy)) * (1 + .5 * A.trebA);
    S.ty += S.dir * sp * dt; if (S.ty > .95) { S.ty = .95; S.dir = -1; } if (S.ty < .05) { S.ty = .05; S.dir = 1; }
    if (A.onKick) S.snap = Math.min(1.5, CFG.punch) * 1.5;
    S.snap *= Math.max(0, 1 - dt * 5);
    S.spin += dt * (1.5 + 2.5 * Math.min(2, A.midA) + 3 * A.kick);
    S.u0[0] = S.ty; S.u0[1] = .06 + .07 * Math.min(2.5, A.bassA); S.u0[2] = .09; S.u0[3] = 1;
    S.u1[1] = S.t * .13; S.u1[2] = Math.min(1, S.snap);
    S.u2[0] = S.spin;
  },
  draw(S, dt) {
    const y = S.ty * 2 - 1, n = Math.floor(1 + 3 * Math.min(2, A.trebA) + 12 * A.kick);
    for (let i = 0; i < n && S.chips.length < 160; i++) { const s = Math.random() < .5 ? -1 : 1; S.chips.push({ x: s * (.3 + .25 * Math.random()), y, vx: s * rnd(.4, 1.4), vy: rnd(.3, 1.3), life: rnd(.4, .9), h: Math.random() }); }
    const keep = [];
    for (const c of S.chips) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy -= 2.5 * dt; c.life -= dt; if (c.life > 0) { palJS(A.hue + .05 + c.h * .1, tmpC); D.sprite(c.x, c.y, .006 + .004 * c.h, 0, 1, .7, .35, 1.5 * c.life, 0, 0, .5, 1); keep.push(c); } }
    S.chips = keep;
  }
});

PRESETS.push({
  name: 'Harp', accent: '#a5b4fc', orbit: true,
  // Strings, each one a real vibrating string: the waveform drives one end, the wave runs up the string and back
  // at its own speed, so every string answers the music in its own way. Each string listens to its own slice of
  // the spectrum, a kick plucks them all in the middle, and a swing restrings the harp with a new count and fan.
  warp: `vec3 warp(vec2 p){ vec2 q=p+vec2(0.,-.0025)*spd; return mix(P(q),B(q),.12)*DK(.87); }`,
  comp: `vec3 comp(vec2 p){
    vec3 c=vec3(.012,.01,.02)+pal(hue+.5)*.05*(1.-smoothstep(.2,1.2,length(p*vec2(.7,1.))))*(.6+.4*bassA);
    c+=pal(hue+.2)*.03*fbm(p*2.+vec2(0.,-mt*.05));
    c+=P(p)*1.25+glow(p)*.9;
    return c*vig(p); }`,
  init(S) { S.N = 40; S.str = []; this.restring(S); S.pluck = 0; },
  restring(S) {
    const n = Math.round(rnd(9, 19)), asp = D.aspect, N = S.N, tilt = rnd(-.25, .25), fan = rnd(.2, .5);
    S.str = [];
    for (let k = 0; k < n; k++) {
      const u = n > 1 ? k / (n - 1) : .5, x0 = (u * 2 - 1) * asp * .78 - tilt * .3, y0 = -.9, x1 = (u * 2 - 1) * asp * .78 + tilt, y1 = .92 - fan * (1 - u) * (1 - u) * 2.2;
      S.str.push({ x0, y0, x1, y1, u: new Float32Array(N), v: new Float32Array(N), c: 14 + 28 * (1 - u), damp: .994 - .004 * u, band: .04 + u * .62, h: u });
    }
  },
  update(S, dt) {
    if (A.onSwing) this.restring(S);
    const sub = 2, h = Math.min(dt, 1 / 30) / sub, N = S.N, kickV = A.onKick ? 4 * Math.min(1.5, CFG.punch) : 0;
    for (const s of S.str) {
      const lv = sampleSpec(s.band), amp = .008 + .045 * Math.min(1.5, lv) * (.6 + .4 * Math.min(2, A.energy));
      if (kickV) for (let i = N * .35 | 0; i < N * .65; i++) s.v[i] += kickV * Math.sin((i - N * .35) / (N * .3) * Math.PI);
      for (let k = 0; k < sub; k++) {
        s.u[0] = sampleWave(s.band * .5 + (S.t * 2.3) % .4) * amp; s.u[N - 1] = 0;
        const c2 = s.c * s.c;
        for (let i = 1; i < N - 1; i++) s.v[i] = (s.v[i] + c2 * (s.u[i - 1] + s.u[i + 1] - 2 * s.u[i]) * h) * s.damp;
        for (let i = 1; i < N - 1; i++) { s.u[i] += s.v[i] * h; if (s.u[i] > .22 || s.u[i] < -.22) { s.u[i] *= .9; s.v[i] *= .5; } }
      }
    }
  },
  draw(S) {
    const N = S.N;
    for (const s of S.str) {
      const lv = sampleSpec(s.band), dx = s.x1 - s.x0, dy = s.y1 - s.y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, g = .35 + .9 * Math.min(1.5, lv) + .6 * A.kick;
      D.line(N, (i, u, p) => { const d = s.u[i]; p.x = s.x0 + dx * u + nx * d; p.y = s.y0 + dy * u + ny * d; palJS(A.hue + s.h * .45, p, 1); }, { w: .0035 + .004 * Math.min(1, lv) + .004 * A.kick, gain: g + 1.5 * A.kick, core: .9 });
    }
    const f = S.str[0], l = S.str[S.str.length - 1];
    D.line(2, (i, u, p) => { p.x = f.x0 + (l.x0 - f.x0) * u; p.y = f.y0; palJS(A.hue + .6, p, .6); }, { w: .012, gain: .4 + .5 * A.bassA, core: .3 });   // the soundboard beam
    D.line(24, (i, u, p) => { const k = u * (S.str.length - 1), a = S.str[Math.floor(k)], b = S.str[Math.min(S.str.length - 1, Math.ceil(k))], t = k - Math.floor(k); p.x = a.x1 + (b.x1 - a.x1) * t; p.y = a.y1 + (b.y1 - a.y1) * t; palJS(A.hue + .6, p, .6); }, { w: .009, gain: .35 + .4 * A.trebA, core: .3 });
  }
});

PRESETS.push({
  name: 'Cymatics', accent: '#fde68a', cam: .4,
  // Sand on a steel plate that the music vibrates: the grains are shaken off the moving parts and gather on the
  // still lines between them, the way a Chladni plate draws its figures. Which figure depends on the pitch that
  // dominates the spectrum, so the pattern re-forms as the song moves; a kick strikes the plate and the sand jumps.
  agents: { n: 65536,
    update: `float plate(vec2 q, float m, float n){ return cos(n*PI*q.x)*cos(m*PI*q.y)-cos(m*PI*q.x)*cos(n*PI*q.y); }
      float amp(vec2 p){ vec2 q=p/vec2(aspect,1.); return abs(mix(plate(q,u0.x,u0.y), plate(q,u1.x,u1.y), u1.z)); }
      vec4 agent(vec4 s, vec2 id){
        vec2 p=s.xy;
        float a=amp(p); vec2 e=vec2(.012,0.);
        vec2 g=vec2(amp(p+e.xy)-amp(p-e.xy), amp(p+e.yx)-amp(p-e.yx))/.024;
        float r1=hash(id*vec2(53.1,91.7)+fract(t*.73)*vec2(7.,3.)), r2=hash(id*vec2(17.9,41.3)+fract(t*.37)*vec2(5.,11.));
        vec2 jump=dir(r1*TAU)*sqrt(r2);
        float shake=u0.z*a*a+u0.w*(.3+.7*r2);                                        // the plate throws sand where it moves, and when struck
        p+=jump*shake*dt*1.6-g*a*u0.z*dt*.12;
        p=clamp(p, -vec2(aspect,1.)*.97, vec2(aspect,1.)*.97);
        return vec4(p,s.z,s.w); }`,
    deposit: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; col=vec3(.05); size=2.; }`,
    draw: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; col=vec3(1.,.93,.8)*(.45+.55*s.w); size=1.2+1.2*s.w; }` },
  sim: `vec4 sim(vec2 p){ return X(p)*.82; }`, simSteps: 1,
  warp: `vec3 warp(vec2 p){ return P(p)*DK(.5); }`,
  comp: `float plate(vec2 q, float m, float n){ return cos(n*PI*q.x)*cos(m*PI*q.y)-cos(m*PI*q.x)*cos(n*PI*q.y); }
  vec3 comp(vec2 p){
    vec2 q=p/vec2(aspect,1.);
    float a=abs(mix(plate(q,u0.x,u0.y), plate(q,u1.x,u1.y), u1.z));
    vec3 c=vec3(.045,.048,.055)*(.75+.35*fbm(p*4.+seed.xy*7.))*(.85+.3*smoothstep(1.,.0,length(p)));
    c+=pal(hue+.55)*a*a*.1*(.5+.8*trebA)+pal(hue+.55)*.06*u0.w;                       // the moving parts of the plate shimmer
    c+=P(p)*1.1+X(p).r*vec3(.55,.5,.42)*1.4+glow(p)*.5;                               // the sand, with its piles
    vec2 e=abs(p)/vec2(aspect,1.); c*=1.-.6*smoothstep(.96,1.,max(e.x,e.y));
    return c*vig(p); }`,
  init(S) { S.m = 3; S.n = 2; S.m2 = 4; S.n2 = 1; S.bl = 1; S.mark = -1; S.hold = 0; S.lastBin = 0; S.strike = 0; },
  update(S, dt) {
    // the dominant pitch picks the figure: a new one on a real change that holds, or every eighth beat
    let mx = 0, bin = 0; for (let i = 8; i < 300; i += 2) if (A.spec[i] > mx) { mx = A.spec[i]; bin = i; }
    S.hold = Math.abs(bin - S.lastBin) > 25 ? S.hold + dt : 0; if (S.hold > .35) S.lastBin = bin;
    const want = (S.hold > .35 && S.bl >= 1) || (A.onBeat && A.beats % 8 === 0 && A.beats !== S.mark && S.bl >= 1);
    if (want) { S.mark = A.beats; S.hold = 0; S.m = S.m2; S.n = S.n2; const m = 1 + Math.floor(bin / 300 * 6.99), n = 1 + Math.floor((bin * 7 + A.beats * 3) % 7); S.m2 = m; S.n2 = n === m ? (n % 7) + 1 : n; S.bl = 0; }
    S.bl = Math.min(1, S.bl + dt * .8);
    if (A.onKick) S.strike = Math.min(1.5, CFG.punch) * (.6 + .4 * Math.min(2, A.bass));
    S.strike *= Math.max(0, 1 - dt * 9);
    S.u0[0] = S.m; S.u0[1] = S.n; S.u0[2] = .7 + 1.1 * Math.min(2, A.energy) * (.5 + .5 * A.vol); S.u0[3] = S.strike;
    S.u1[0] = S.m2; S.u1[1] = S.n2; S.u1[2] = S.bl * S.bl * (3 - 2 * S.bl);
  },
  draw() {}
});

const SHARD_LIB = `
vec2 h2(vec2 p){ return vec2(hash(p), hash(p+19.7)); }
// Voronoi shards: returns (distance to the nearest edge, cell id) and the cell's centre.
vec2 shard(vec2 p, float sc, float sd, out vec2 cen){
  vec2 g=floor(p*sc), f=fract(p*sc); float d1=8., d2=8.; vec2 best=vec2(0.); float id=0.;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(float(i),float(j)); vec2 h=h2(g+o+sd); vec2 r=o+h-f; float d=dot(r,r);
    if(d<d1){ d2=d1; d1=d; best=g+o+h; id=hash(g+o+sd*3.1); } else if(d<d2) d2=d; }
  cen=best/sc; return vec2((sqrt(d2)-sqrt(d1))/sc, id); }
`;
PRESETS.push({
  name: 'Shatter', accent: '#bae6fd', cam: .7,
  // A pane of coloured glass that the music paints and a kick smashes: the picture breaks into shards that each
  // fly their own way from the point of impact and spin as they go, cracks glowing along the breaks. The louder
  // the kick, the more pieces. Between kicks the glass is repainted by the spectrum, ready to break again.
  warp: SHARD_LIB + `vec3 warp(vec2 p){
    vec2 cen; vec2 sh=shard(p, u0.z, u0.w, cen);
    vec2 away=cen-u1.xy; float L=length(away)+1e-3;
    vec2 vel=away/L*(.6+.9*hash(vec2(sh.y,sh.y*7.)))*u1.z+vec2(0.,-.3*u1.z*smoothstep(0.,1.,u1.w));   // out from the impact, then falling
    float spin=(hash(vec2(sh.y*3.,1.))-.5)*2.5*u1.z;
    vec2 q=cen+rot(-spin*dt)*(p-cen)-vel*dt;
    q=mix(p,q,spd);
    vec3 c=P(q)*DK(.985);
    c*=1.-smoothstep(.02,.0,sh.x)*u1.z*.9;                                           // the gaps between pieces
    return c; }`,
  comp: SHARD_LIB + `vec3 comp(vec2 p){
    vec2 cen; vec2 sh=shard(p, u0.z, u0.w, cen);
    vec3 c=P(p);
    float crack=smoothstep(.018,.0,sh.x)*u1.z;
    c=mix(c, ca(p,.006*u1.z), smoothstep(.0,.08,sh.x)*u1.z);                          // the edges of a shard split the light
    c+=pal(hue+.3)*crack*(1.5+2.*kick)+vec3(1.)*crack*.4;
    c+=glow(p)*.7+vec3(.01,.012,.02);
    float back=1.-smoothstep(.3,.0,lum(c));
    return c*vig(p); }`,
  init(S) { S.sd = Math.random() * 40; S.sc = 3; S.fly = 0; S.age = 9; S.ix = 0; S.iy = 0; S.pts = []; for (let i = 0; i < 40; i++) S.pts.push(Math.random()); },
  update(S, dt) {
    if (A.onKick) { const k = Math.min(2, A.bass); S.sd = Math.random() * 40; S.sc = 2 + 2.5 * k * Math.min(1.5, CFG.punch); S.fly = 1; S.age = 0; S.ix = rnd(-.6, .6) * D.aspect; S.iy = rnd(-.6, .6); S.la = rnd(0, TAU); S.ly = rnd(-.5, .5); }
    S.age += dt; S.fly *= Math.max(0, 1 - dt * 1.6);
    S.u0[2] = S.sc; S.u0[3] = S.sd; S.u1[0] = S.ix; S.u1[1] = S.iy; S.u1[2] = S.fly; S.u1[3] = S.age;
  },
  draw(S) {
    const asp = D.aspect, n = 40, lv = .25 + .5 * Math.min(2, A.energy);
    for (let i = 0; i < n; i++) {                                                     // the painting: stained light, each pane a slice of the spectrum
      const u = i / n, s = sampleSpec(u * .9), a = u * TAU + S.mt * .08, r = .28 + .55 * s * s;
      palJS(A.hue + u * .9 + S.pts[i] * .1, tmpC); D.sprite(Math.cos(a) * r * asp * .9, Math.sin(a) * r, .07 + .13 * s, a, tmpC.r, tmpC.g, tmpC.b, lv * (.3 + s), 0, 0, .9, 0);
    }
    const c = Math.cos(S.la || 0), s = Math.sin(S.la || 0), ly = S.ly || 0;   // the lead line across the pane, with the waveform in it; a new chord with every break
    D.line(240, (i, u, p) => { const w = sampleWave(u), x = (u * 2 - 1) * asp * 1.1, y = ly + w * (.1 + .12 * A.bassA); p.x = c * x - s * y; p.y = s * x + c * y; palJS(A.hue + .5 + u * .2, p, 1); }, { w: .006, gain: .5, core: .8 });
    if (A.onKick) D.sprite(S.ix, S.iy, .3 + .3 * A.bass, 0, 1, 1, 1, 1.2 * CFG.punch, 0, 0, 1, 1);
  }
});

PRESETS.push({
  name: 'Tungsten', accent: '#fdba74', fit: false, cam: .8, orbit: true,
  // One big old light bulb, in a dark room, seen from a camera that drifts around it. The filament is the waveform
  // itself, strung between the posts and glowing hotter the louder the song: dull orange at a whisper, white at a
  // shout. Heat rises off it inside the glass. A swing burns the filament out for a moment, and it comes back strung
  // in a new shape. The bulb is real glass, marched ray by ray: the 2D picture is the light inside it, the screw base
  // and the table below take its light, and the glass reflects the room.
  warp: `vec3 warp(vec2 p){ vec2 q=p+vec2(.0015*sin(p.y*20.+t*3.),-.0045)*spd; return mix(P(q),B(q),.3)*DK(.80); }`,
  comp: `#define SELF
  float smin(float a, float b, float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
  float sdBulb(vec3 q){                                                                  // the glass: a globe with a neck, the same shape the flat view had
    float body=length((q-vec3(0.,.14,0.))/vec3(1.,1.02,1.))-.6;
    float neck=max(length(q.xz)-.2-.05*smoothstep(-.3,-.6,q.y), max(q.y+.2, -.78-q.y));
    return smin(neck, body, .18); }
  float sdBase(vec3 q){ return max(length(q.xz)-.215-.012*sin(q.y*90.), abs(q.y+.88)-.10); }   // the screw cap, threads and all
  vec2 map(vec3 q){ float b=sdBulb(q), c=sdBase(q); return b<c ? vec2(b,0.) : vec2(c,1.); }
  vec3 nrm(vec3 q){ vec2 e=vec2(.004,-.004); return normalize(e.xyy*map(q+e.xyy).x+e.yyx*map(q+e.yyx).x+e.yxy*map(q+e.yxy).x+e.xxx*map(q+e.xxx).x); }
  vec3 room(vec3 r){ return vec3(.016,.011,.008)+vec3(.05,.035,.025)*smoothstep(.2,-.8,r.y)+vec3(.02,.025,.04)*smoothstep(.3,1.,r.y); }   // a dark room: a little warmth low down, a little cool above
  vec3 comp(vec2 p){
    float cy=cos(cam.x*1.8), sy=sin(cam.x*1.8), cp=cos(cam.y*1.3), sn=sin(cam.y*1.3);
    mat3 R=mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy)*mat3(1.,0.,0., 0.,cp,sn, 0.,-sn,cp);
    vec3 o3=R*vec3(0.,0.,2.6*cam.w), d3=R*normalize(vec3(rot(cam.z)*sp,-FOC));
    vec3 right=R*vec3(1.,0.,0.), up=R*vec3(0.,1.,0.), fwd=R*vec3(0.,0.,1.);
    vec3 light=mix(vec3(1.,.45,.1), vec3(1.,.9,.75), u0.x)*u0.x;                       // the filament's colour and how hard it burns
    vec3 L=vec3(0.,-.05,0.);                                                            // where the light comes from: the middle of the filament
    float dmin=length(cross(d3, vec3(0.,.1,0.)-o3));                                     // how close this ray passes the bulb: the haze of light in the room
    vec3 halo=light*.25/(1.+5.*dmin*dmin)*(1.+.4*kick);
    vec3 rm=room(d3);
    // what the ray meets: the bulb or its base (marched), else the table, else the room
    float bq=dot(o3,d3), disc=bq*bq-dot(o3,o3)+1.25*1.25, tt=0., d=1.; vec2 m=vec2(1.,0.);
    bool hit=false;
    if(disc>0.){ tt=max(-bq-sqrt(disc),0.);
      for(int i=0;i<48;i++){ m=map(o3+d3*tt); if(m.x<.003){ hit=true; break; } if(tt>5.) break; tt+=m.x*.9; } }
    vec3 c;
    if(hit){
      vec3 q=o3+d3*tt, n=nrm(q);
      float ndv=max(dot(n,-d3),0.), fres=pow(1.-ndv,3.);
      if(m.y<.5){                                                                      // glass
        vec3 rr=refract(d3,n,1./1.4);                                                    // the glass bends the view of what is inside
        float tp=-dot(q,fwd)/min(dot(rr,fwd),-1e-3); vec3 X=q+rr*tp;
        vec2 uv=vec2(dot(X,right), dot(X,up));                                           // the flat picture stands inside the bulb, facing us
        vec3 inner=P(uv)*.7+B(uv)*.55+glow(uv)*.6;
        float chord=2.*sqrt(max(0.,.6*.6-dot(q-vec3(0.,.14,0.),q-vec3(0.,.14,0.))*(1.-ndv*ndv)));   // path through the globe: the hot air glows along it
        inner+=light*.07*(1.+.4*chord)+B(uv)*.2*chord;
        vec3 refl=room(reflect(d3,n))*(.25+.75*fres)*2.;                                 // the room in the glass
        refl+=pow(max(dot(reflect(d3,n),normalize(R*vec3(-.5,.6,.7))),0.),60.)*.9;      // the window
        c=inner*(1.-.5*fres)+refl+light*.12*fres;                                        // the rim takes the filament's light
      } else {                                                                           // the screw base: metal, lit from above by the filament
        vec3 tl=L-q; float dl=length(tl); tl/=dl;
        float dif=max(dot(n,tl),0.)/(1.+3.*dl*dl), spc=pow(max(dot(reflect(-tl,n),-d3),0.),18.);
        vec3 metal=vec3(.55,.5,.44)*(.6+.4*sin(q.y*90.));
        c=metal*(light*dif*1.4+vec3(.03,.025,.02))+light*spc*.5+room(reflect(d3,n))*.3;
      }
    } else if(d3.y<-.02){                                                                // the table
      float ty=(-1.05-o3.y)/d3.y; vec3 X=o3+d3*ty;
      vec3 tl=L-X; float dl=length(tl); tl/=dl;
      float dif=max(tl.y,0.)/(1.+2.5*dl*dl)*smoothstep(.12,.5,length(X.xz));             // the base stands in its own light: a shadow straight below
      vec3 wood=vec3(.07,.045,.03)*(.7+.5*fbm(X.xz*3.+seed.xy*9.))*(.9+.2*sin(X.x*40.));
      c=wood*(light*dif*7.+vec3(.05,.04,.03))+halo*.6;
      c+=light*pow(max(dot(reflect(-tl,vec3(0.,1.,0.)),-d3),0.),40.)*.25/(1.+2.*dl*dl);   // the varnish catches the bulb
      c=mix(rm, c, exp(-ty*.08));
    } else c=rm+halo;
    return c*vig(p); }`,
  init(S) { S.lv = .3; S.shape = Math.floor(Math.random() * 4); S.dead = 0; S.flick = 1; },
  update(S, dt) {
    const want = Math.min(1, .2 + .5 * Math.min(1.5, A.vol) + .4 * A.kick + .2 * Math.min(1, A.level));
    S.lv += (want - S.lv) * Math.min(1, dt * (want > S.lv ? 25 : 6));
    if (A.onSwing && S.dead <= 0) S.dead = 1.4;
    if (S.dead > 0) { S.dead -= dt; if (S.dead <= 0) S.shape = (S.shape + 1 + Math.floor(Math.random() * 3)) % 4; }
    S.flick = .94 + .06 * Math.sin(S.t * 97) * Math.sin(S.t * 31);
    S.u0[0] = S.dead > 0 ? Math.max(0, .15 - S.dead * .1) : S.lv * S.flick;
  },
  draw(S) {
    const lv = S.u0[0], amp = .035 + .1 * Math.min(2.5, A.bassA) + .06 * A.kick, N = 300, sh = S.shape, r = 1, g = .35 + .55 * lv, b = .05 + .6 * lv * lv;
    D.line(2, (i, u, p) => { p.x = -.12; p.y = -.75 + u * .45; p.r = .4; p.g = .38; p.b = .36; }, { w: .006, gain: .5, core: .5 });   // the posts
    D.line(2, (i, u, p) => { p.x = .12; p.y = -.75 + u * .45; p.r = .4; p.g = .38; p.b = .36; }, { w: .006, gain: .5, core: .5 });
    if (S.dead > 1.1) return;                                                          // burnt out: nothing between the posts
    D.line(N, (i, u, p) => {
      const w = sampleWave(u);
      let x, y, nx, ny;
      if (sh === 0) { const k = u * 4, seg = Math.floor(k), f = k - seg; x = -.12 + .06 * seg; y = -.3 + (seg % 2 ? 1 - f : f) * .5 + (seg === 0 ? 0 : 0); if (seg >= 4) { x = .12; y = -.3; } nx = 1; ny = 0; }             // a W
      else if (sh === 1) { const a = u * TAU * 5; x = -.12 + u * .24; y = .05 + Math.sin(a) * .08; nx = 0; ny = 1; }                       // a coil
      else if (sh === 2) { const a = -Math.PI * .5 + u * TAU; x = Math.cos(a) * .12; y = .05 + Math.sin(a) * .3 - .3 * (1 - Math.abs(2 * u - 1)) * 0; nx = Math.cos(a); ny = Math.sin(a); if (u < .02 || u > .98) { x = (u < .5 ? -1 : 1) * .12; y = -.3; } }   // a loop
      else { const k = u * 3, seg = Math.floor(k), f = k - seg; x = -.12 + .08 * seg; y = -.3 + (seg % 2 ? f : 1 - f) * .5 * (seg === 0 ? f * 2 : 1); if (seg >= 3) { x = .12; y = -.3; } nx = 1; ny = 0; }   // an M
      p.x = x + nx * w * amp; p.y = y + ny * w * amp; p.r = r; p.g = g; p.b = b;
    }, { w: .006 + .003 * lv, gain: .25 + .75 * lv, core: 1 });
  }
});
