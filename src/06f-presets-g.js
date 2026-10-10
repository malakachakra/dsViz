// ---------- 3.5 scenes, part 2: lightning, an oscilloscope, a fractal dive, a loom ----------

PRESETS.push({
  name: 'Lichtenberg', accent: '#c7d2fe',
  // Lightning grown branch by branch in JS: each live tip steps forward with a jitter, leans toward its target,
  // and sometimes splits. The channel it leaves glows in the buffer and fades. Kicks launch bolts from the sky,
  // treble sends sprites crawling in from the sides, and when a bolt grounds the clouds light up.
  warp: `vec3 warp(vec2 p){
    vec2 q=p+vec2(.0008*sin(p.y*3.+mt*.3), -.0012);
    vec3 c=mix(P(q), B(q), .22);
    return hueRot(c,.004)*DK(.905); }`,
  comp: `vec3 comp(vec2 p){
    float fl=u0.x; vec2 fp=u0.yz;
    float n=fbm(p*vec2(1.1,2.2)+vec2(mt*.03,seed.x*9.))*.7+fbm(p*vec2(3.,5.)+vec2(-mt*.05,seed.y*7.))*.3;
    float cloud=smoothstep(.25,.75,n);
    float lit=exp(-length(p-fp)*1.6)*fl;                                                  // the strike lights the cloud from where it is
    vec3 sky=mix(vec3(.010,.012,.03), vec3(.05,.055,.09), cloud)*(1.+.6*bassA*cloud)*(1.-.5*smoothstep(-.2,1.,p.y)*(1.-cloud));
    vec3 c=sky+mix(vec3(.6,.65,1.), pal(hue+.62), .4)*lit*(.5+.9*cloud)*1.6;
    vec3 bolt=P(p); c+=bolt*1.6+glow(p)*1.4*mix(vec3(.7,.75,1.), pal(hue+.62), .4);
    c+=vec3(.9,.92,1.)*fl*.08;                                                             // the whole sky flickers
    return c*vig(p); }`,
  init(S) { S.tips = []; S.flash = 0; S.fx = 0; S.fy = .3; S.pend = 0; },
  spawn(S, x, y, tx, ty, w, life, h) { if (S.tips.length < 120) S.tips.push({ x, y, px: x, py: y, a: Math.atan2(ty - y, tx - x), tx, ty, w, life, h, age: 0 }); },
  update(S, dt) {
    const asp = D.aspect;
    S.flash *= Math.max(0, 1 - dt * 7);
    if (A.onKick) { const x = rnd(-.8, .8) * asp, n = 1 + (A.bass > 1.8 ? 1 : 0); for (let i = 0; i < n; i++) this.spawn(S, x + rnd(-.1, .1), 1.05, x + rnd(-.5, .5) * asp, rnd(-1.1, -.6), 1, 1, A.hue + rnd(-.05, .05)); }
    if (Math.random() < dt * (.3 + 2.2 * Math.min(2, A.trebA))) { const sd = Math.random() < .5 ? -1 : 1; this.spawn(S, sd * asp * 1.02, rnd(-.6, .9), sd * asp * rnd(-.2, .5), rnd(-.9, .8), .35, .5, A.hue + .5); }
    if (A.onBeat && Math.random() < .35) this.spawn(S, rnd(-.9, .9) * asp, rnd(-.3, .9), rnd(-.5, .5) * asp, -1.1, .55, .7, A.hue + .25);
    S.u0[0] = S.flash; S.u0[1] = S.fx; S.u0[2] = S.fy;
  },
  draw(S, dt) {
    const asp = D.aspect, step = (.045 + .03 * Math.min(2, A.trebA)) * (CFG.speed * .5 + .5), keep = [];
    for (const t of S.tips) {
      const n = Math.max(1, Math.round(dt * 60 * (t.w > .6 ? 2 : 1)));
      for (let k = 0; k < n && t.life > 0; k++) {
        const want = Math.atan2(t.ty - t.y, t.tx - t.x), d = Math.atan2(Math.sin(want - t.a), Math.cos(want - t.a));
        t.a += d * .18 + rnd(-.7, .7) * (1.1 - .4 * t.w);
        t.px = t.x; t.py = t.y; t.x += Math.cos(t.a) * step * (.6 + .5 * t.w); t.y += Math.sin(t.a) * step * (.6 + .5 * t.w); t.life -= .035; t.age++;
        palJS(t.h, tmpC); const g = (1.6 + 2.2 * t.w) * (.6 + .4 * Math.min(2, A.trebA));
        D.line(2, (i, u, p) => { p.x = i ? t.x : t.px; p.y = i ? t.y : t.py; p.r = tmpC.r * .5 + .5; p.g = tmpC.g * .5 + .5; p.b = tmpC.b * .4 + .6; }, { w: .0025 + .004 * t.w, gain: g, core: .5 + .5 * t.w });
        if (Math.random() < .09 * (1 + A.trebA) && S.tips.length < 120 && t.w > .15) S.tips.push({ x: t.x, y: t.y, px: t.x, py: t.y, a: t.a + rnd(.4, 1.) * (Math.random() < .5 ? -1 : 1), tx: t.tx, ty: t.ty, w: t.w * .5, life: t.life * .6, h: t.h, age: 0 });
        if (Math.hypot(t.x - t.tx, t.y - t.ty) < .08 || t.y < -1.05 || Math.abs(t.x) > asp * 1.1) {
          if (t.w > .7) { S.flash = Math.max(S.flash, 1.2 * CFG.punch); S.fx = t.x; S.fy = Math.max(t.y, -.9); D.sprite(t.x, t.y, .25, 0, .8, .85, 1, 1.2, 0, 0, 1, 1); }
          t.life = 0;
        }
      }
      if (t.life > 0) keep.push(t);
    }
    S.tips = keep;
  }
});

PRESETS.push({
  name: 'Cathode', accent: '#4ade80',
  // An oscilloscope in X-Y mode. The beam traces a Lissajous figure whose ratio changes every eight beats, and the
  // waveform shakes the beam along the way. Green phosphor that lingers, scanlines, a curved tube, and a sync roll
  // when the beat hits.
  warp: `vec3 warp(vec2 p){
    vec2 q=p; q.y+=u0.x; q.x+=.003*sin(p.y*40.+t*30.)*u0.y;              // the picture rolls and tears after a beat
    vec3 c=mix(P(q), B(q), .12);
    return c*vec3(.86,.93,.88)*DK(.86); }`,
  comp: `vec3 comp(vec2 p){
    vec2 q=stage==0 ? p*(1.+.06*dot(p,p)) : p;                              // the glass is curved; in a space the phosphor is the wall itself, no tube
    vec2 e=abs(q)/vec2(aspect,1.);
    float tube=stage==0 ? smoothstep(1.02,.96,max(e.x,e.y))*smoothstep(1.4,1.1,length(e*vec2(.8,1.))) : 1.;
    vec3 ph=vec3(.3,1.,.45);
    float g=lum(P(q))*1.3+lum(B(q))*.9;
    float scan=.78+.22*sin(q.y*res.y*1.4+t*2.), flick=.96+.04*sin(t*120.);
    vec3 c=ph*g*scan*flick;
    c+=ph*smoothstep(.3,2.5,g)*.4;                                          // the beam burns white at the core
    vec2 gr=abs(fract(q*vec2(1./aspect,1.)*5.+.5)-.5);                     // the graticule
    float grid=smoothstep(.03,.0,min(gr.x,gr.y))*.06+smoothstep(.015,.0,min(abs(q.x),abs(q.y)))*.08;
    c+=ph*grid+vec3(.012,.03,.02);
    return c*tube*(stage==0 ? vig(p*.6) : 1.); }`,
  init(S) { S.ra = 3; S.rb = 2; S.ph = 0; S.roll = 0; S.tear = 0; S.mark = -1; },
  update(S, dt) {
    if (A.onBeat && A.beats % 8 === 0 && A.beats !== S.mark) { S.mark = A.beats; const r = [[1, 2], [2, 3], [3, 4], [3, 2], [4, 5], [5, 4], [1, 3], [5, 6], [2, 5]][Math.floor(Math.random() * 9)]; S.ra = r[0]; S.rb = r[1]; }
    if (A.onKick) { S.roll = .06 * Math.min(1.5, CFG.punch); S.tear = 1; }
    S.roll *= Math.max(0, 1 - dt * 5); S.tear *= Math.max(0, 1 - dt * 6);
    S.ph += dt * (.3 + .5 * Math.min(2, A.midA)) * CFG.speed;
    S.u0[0] = S.roll; S.u0[1] = S.tear;
  },
  draw(S) {
    const R = .72, a = S.ra, b = S.rb, ph = S.ph, amp = .05 + .12 * Math.min(2, A.bassA), g = .5 + .35 * Math.min(2, A.energy) + .4 * A.kick;
    D.line(700, (i, u, p) => {
      const th = u * TAU, w = sampleWave(u);
      const x = Math.sin(a * th + ph) * R * Math.min(1.3, D.aspect * .8), y = Math.sin(b * th) * R;
      const dx = a * Math.cos(a * th + ph), dy = b * Math.cos(b * th), l = Math.hypot(dx, dy) || 1;
      p.x = x - dy / l * w * amp; p.y = y + dx / l * w * amp; p.r = .35; p.g = 1; p.b = .5;
    }, { w: .006, closed: true, gain: g, core: .8 });
    D.line(300, (i, u, p) => { const w = sampleWave(u), w2 = sampleWave((u + .25) % 1); p.x = w * .5 * D.aspect; p.y = w2 * .5; p.r = .3; p.g = 1; p.b = .45; }, { w: .004, gain: .35 * Math.min(2, A.trebA), core: .6 });
  }
});

PRESETS.push({
  name: 'Deep Field', accent: '#f9a8d4', cam: .25,
  // A dive into the Mandelbrot set. The zoom runs on the song's energy, the colours on the spectrum, and when
  // the numbers run out of precision the picture flashes white and the dive starts again somewhere else.
  warp: `vec3 warp(vec2 p){ vec2 q=rot(u1.z)*p*u1.y; return P(q)*DK(.9); }`,
  comp: `vec3 comp(vec2 p){
    vec2 c0=u0.xy+rot(u1.w)*p*u0.z, z=vec2(0.);
    float it=0., n=u1.x, mx=1e9;
    for(int i=0;i<300;i++){ if(float(i)>=n) break;
      z=vec2(z.x*z.x-z.y*z.y, 2.*z.x*z.y)+c0; mx=min(mx,abs(z.x*z.y));      // the orbit trap gives the inside some texture
      if(dot(z,z)>64.){ it=float(i)+1.-log2(log2(dot(z,z)))+4.; break; } it=-1.; }
    vec3 c;
    if(it<0.) c=pal(hue+.55)*.06*smoothstep(1.,0.,mx*8.)+vec3(.004);
    else { float k=it/n; float band=log2(it+2.)*1.3+bstep*.03+mt*.01;
      c=pal(hue+band*.33)*(.3+.7*spec(fract(band*.17)))*smoothstep(.0,.05,k)*(.5+.5*smoothstep(.05,.4,k));
      c=mix(c, vec3(1.), smoothstep(.7,1.,k)*.5);
      c*=.55+.65*pow(fract(band*1.5),.6)*(.6+.5*beat); }
    c=mix(c, P(p), .45)*(1.+.3*kick)+glow(p)*.5;
    return mix(c, vec3(1.,.97,.95), u0.w)*vig(p); }`,
  init(S) {
    S.spots = [[-0.743643887037151, 0.131825904205330], [-1.25066, 0.02012], [-0.7453, 0.1127], [0.2549870375144766, -0.0005679790528465], [-1.768778833, -0.001738996], [-0.16070135, 1.0375665], [-0.77568377, 0.13646737], [-0.1011, 0.9563], [-1.99998588123, 0]];
    S.si = Math.floor(Math.random() * S.spots.length); S.lg = 1.4; S.flash = 0; S.rot = Math.random() * TAU; S.resetting = false; S.rate = 0; S.u1[1] = 1;
  },
  update(S, dt) {
    const want = (.25 + .3 * Math.min(1.5, A.energy) + .6 * A.kick) * CFG.speed;    // doublings per second
    S.rate += (want - S.rate) * Math.min(1, dt * 3);
    const d = S.rate * dt; S.lg -= d; S.rot += dt * .02 * (A.midA - .8) * CFG.speed;
    if (S.lg < -13.3 && !S.resetting) S.resetting = true;
    if (S.resetting) { S.flash = Math.min(1, S.flash + dt * 2.5); if (S.flash >= 1) { S.si = (S.si + 1 + Math.floor(Math.random() * (S.spots.length - 1))) % S.spots.length; S.lg = 1.4; S.resetting = false; } }
    else S.flash = Math.max(0, S.flash - dt * 1.5);
    if (A.onSwing && S.lg < -5 && !S.resetting) S.resetting = true;
    const sp = S.spots[S.si], sc = Math.pow(2, S.lg);
    S.u0[0] = sp[0]; S.u0[1] = sp[1]; S.u0[2] = sc; S.u0[3] = S.flash;
    S.u1[0] = 120 + 110 * Math.min(1, -S.lg / 13); S.u1[1] = Math.pow(2, -d); S.u1[2] = -dt * .02 * (A.midA - .8) * CFG.speed; S.u1[3] = S.rot;
  },
  draw(S) {
    const R = .18 + .04 * A.bassA + .07 * A.kick;
    D.line(200, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU + S.mt * .2, r = R + w * .07; p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; palJS(A.hue + u * .3 + .5, p, .5 + .5 * A.beat); }, { w: .006, closed: true, gain: .35 * Math.min(2, A.trebA) });
  }
});

PRESETS.push({
  name: 'Loom', accent: '#fcd34d',
  // Cloth on a loom: vertical warp threads and horizontal weft, woven over and under. The music is painted into the
  // buffer as colour, and the threads bend around whatever it painted; a third set of fine lines drifting across
  // the weave makes moiré. Slow tracks suit it.
  warp: `vec3 warp(vec2 p){
    vec2 q=p+vec2(.0015*sin(p.y*2.+mt*.2), .0025+.003*bassA);
    vec3 c=mix(P(q), B(q), .06);
    return hueRot(c,.003)*DK(.975); }`,
  comp: `
  float thread(float x){ float f=abs(fract(x)-.5)*2.; return smoothstep(.9,.45,f); }
  float shade(float x){ float f=fract(x)*2.-1.; return sqrt(max(1.-f*f,0.)); }
  vec3 comp(vec2 p){
    float n=u0.x;                                                                        // threads per unit
    vec3 paint=P(p)*1.2+B(p)*.6; float lp=lum(paint);
    vec2 bend=vec2(wav(p.y*.5+.5)*(.02+.05*midA)+lp*.03, wav(p.x/aspect*.5+.5)*(.015+.03*bassA)-lp*.03);
    vec2 q=p+bend;
    float wx=q.x*n, wy=q.y*n;
    float over=step(.5, fract(floor(wx)*.5+floor(wy)*.5+.25));                           // which thread is on top at this crossing
    float a=thread(wx), b=thread(wy), sa=shade(wx), sb=shade(wy);
    vec3 cw=pal(hue+floor(wx)*.02+seed.x)*.5+paint*.9, cf=pal(hue+.5+floor(wy)*.025+seed.y)*.5+paint*.9;
    float sa2=pow(sa,1.5), sb2=pow(sb,1.5);
    vec3 c=mix(mix(vec3(.015,.01,.025), cf*sb2, b), cw*sa2, a*mix(1.-b*.9, 1., over));
    float m=sin(dot(rot(u0.y)*q, vec2(n*TAU*.98,0.)))*.5+.5;                             // the moiré set
    c*=.82+.3*pow(m,3.)*(.5+.5*trebA);
    c+=glow(p)*.35*(a+b);
    return c*vig(p); }`,
  init(S) { S.rot = .03; },
  update(S, dt) {
    S.rot += dt * .012 * (.5 + A.midA) * CFG.speed;
    S.u0[0] = 20 + 5 * Math.sin(S.mt * .07); S.u0[1] = .04 * Math.sin(S.rot) + .02;
  },
  draw(S) {
    const asp = D.aspect;
    for (let k = 0; k < 4; k++) {
      const y0 = -.75 + k * .5 + .1 * Math.sin(S.mt * .17 + k), lv = [A.bassA, A.midA, A.trebA, A.midA][k], amp = .06 + .1 * lv;
      D.line(180, (i, u, p) => { const w = sampleWave((u * .6 + k * .1) % 1); p.x = (u * 2 - 1) * asp; p.y = y0 + w * amp; palJS(A.hue + k * .12 + u * .2, p, .45 + .4 * lv); }, { w: .012, gain: .32, core: .3 });
    }
    if (A.onKick) { palJS(A.hue + .5, tmpC); D.sprite(rnd(-.7, .7) * asp, rnd(-.7, .7), .16 + .08 * A.bass, 0, tmpC.r, tmpC.g, tmpC.b, .9 * CFG.punch, 0, 0, .9, 1); }
    for (let i = Math.floor(A.trebA * Math.random() * 1.5); i > 0; i--) { palJS(A.hue + rnd(0, .3), tmpC); D.sprite(rnd(-1, 1) * asp, rnd(-1, 1), rnd(.01, .03), 0, tmpC.r, tmpC.g, tmpC.b, .7, 0, 0, .9, 1); }
  }
});
