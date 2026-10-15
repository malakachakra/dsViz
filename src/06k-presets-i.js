// ---------- 3.8.2 scenes, part 2: three living things, and rain ----------

PRESETS.push({
  name: 'Fireflies', accent: '#d9f99d', panorama: true, cam: .5,
  // A meadow at night full of fireflies, each flashing on its own clock. A flash seen nearby nudges a firefly's clock,
  // and so does every kick, so over a minute they fall into step with the beat, and with each other, in waves that
  // sweep across the field. A swing scrambles every clock and the whole slow synchronisation starts again.
  agents: { n: 6144,
    update: `vec4 agent(vec4 s, vec2 id){
      vec2 p=s.xy; float ph=s.z, k=s.w;
      float r1=hash(id*vec2(31.7,71.3)+fract(t*.53)*vec2(3.,9.)), r2=hash(id*vec2(13.1,47.9)+fract(t*.29)*vec2(5.,7.));
      float h=k*TAU+t*(.3+.4*k)+sin(t*.6+k*20.)*1.6;                                   // a lazy wander
      p+=dir(h)*(.025+.05*k)*(.6+.5*midA)*dt+(vec2(r1,r2)-.5)*.015*dt*60.*.06;
      if(abs(p.x)>aspect*1.05) p.x=-sign(p.x)*aspect*1.04;
      if(p.y>.88) p.y=-.84; if(p.y<-.86) p.y=.86;
      float seen=X(p).r;                                                                // light from the others nearby
      float pull=(u0.x*u0.y+seen*u0.z)*dt;
      ph+=u0.w*dt*(.92+.16*k)-pull*sin(TAU*ph)*.5;                                      // the nudge pulls the clock toward the flash it saw
      if(u1.x>.5) ph=r1;                                                                // a swing: every clock scrambled
      ph=fract(ph);
      return vec4(p,ph,k); }`,
    deposit: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; float f=exp(-s.z*22.)*smoothstep(.5,.4,s.z); col=vec3(f*.5); size=14.; }`,
    draw: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; float f=exp(-s.z*22.)*smoothstep(.5,.4,s.z); col=mix(vec3(.02,.03,.01), vec3(.85,1.,.35)*(2.+1.*s.w), f); size=1.5+9.*f*(1.+.5*s.w); }` },
  sim: `vec4 sim(vec2 p){ vec2 e=vec2(ax*2.,0.); vec4 f=X(p)*.2+(X(p+e.xy)+X(p-e.xy)+X(p+e.yx)+X(p-e.yx))*.2; return f*.7; }`, simSteps: 1,
  warp: `vec3 warp(vec2 p){ return mix(P(p),B(p),.1)*DK(.84); }`,
  comp: `vec3 comp(vec2 p){
    float y=p.y;
    vec3 sky=mix(vec3(.012,.018,.05), vec3(.0,.002,.01), smoothstep(-.3,.9,y));
    sky+=pal(hue+.6)*.04*smoothstep(.2,-.6,y);
    vec2 sc=p*vec2(1.,1.3)*40.; float st=hash(floor(sc)+seed.xy);                        // stars
    sky+=vec3(.7,.8,1.)*step(.985,st)*smoothstep(.4,0.,length(fract(sc)-.5))*(.4+.6*sin(t*2.+st*50.))*smoothstep(-.2,.3,y)*(.6+.4*trebA);
    float md=length((p-vec2(aspect*.55,.62))*vec2(1.,1.)); sky+=vec3(1.,.95,.8)*(smoothstep(.09,.085,md)*.9+exp(-md*4.)*.12);   // the moon
    float gy=-.85+.12*fbm(vec2(p.x*2.5+seed.x*9.,0.))+.05*noise(vec2(p.x*30.,0.));
    float grass=smoothstep(.0,.015,gy-y);
    vec3 ground=vec3(.004,.012,.004)+B(p)*vec3(.3,.5,.2)*1.2;                             // the grass takes the light of the flashes
    vec3 c=mix(sky, ground, grass);
    c+=P(p)*1.3+glow(p)*1.1;
    return c*vig(p); }`,
  init(S) { S.per = .5; S.lastK = 0; S.scr = 0; },
  update(S, dt) {
    S.lastK += dt;
    if (A.onKick) { if (S.lastK > .2 && S.lastK < 2) S.per += (S.lastK - S.per) * .3; S.lastK = 0; }
    S.scr = A.onSwing ? 1 : 0;
    S.u0[0] = A.kick; S.u0[1] = 2.2 * Math.min(1.5, CFG.punch); S.u0[2] = 3.5; S.u0[3] = 1 / Math.max(.25, S.per);
    S.u1[0] = S.scr;
  },
  draw(S) { if (A.onKick) D.sprite(0, -.2, 2 * D.aspect, 0, .6, .9, .3, .05 * CFG.punch, 0, 0, 1, 0); }   // the beat itself: a faint flash over the whole field
});

PRESETS.push({
  name: 'Coral', accent: '#fb7185', cam: .5,
  // A coral head growing by accretion: thousands of specks drift in the water, and wherever one touches the reef it
  // sticks and becomes part of it, new growth pale at the rim, older growth coloured and shaded inside. The song's energy sets how fast
  // it grows, new growth is pale and ages into colour, a kick lights the whole reef, and every so often a patch
  // crumbles away (a swing, or just time) so something new can grow in its place.
  agents: { n: 16384,
    update: `vec4 agent(vec4 s, vec2 id){
      vec2 p=s.xy; float h=s.z, w=s.w;
      float r1=hash(id*vec2(43.1,19.7)+fract(t*.61)*vec2(7.,5.)), r2=hash(id*vec2(71.9,23.3)+fract(t*.43)*vec2(3.,11.));
      if(w>.5 || length(p-u2.xy)>u0.x*1.7){                                              // stuck last frame, or wandered off: come back in from the edge of the colony
        float a=r1*TAU; p=u2.xy+dir(a)*u0.x*(1.05+.5*r2); p=clamp(p,-vec2(aspect,1.)*1.1,vec2(aspect,1.)*1.1); w=0.; return vec4(p,h,w); }
      h+=(r1-.5)*4.5+(r2-.5)*2.;
      vec2 toC=u2.xy-p;
      p+=dir(h)*u0.y*dt+normalize(toC+1e-4)*u0.z*dt+vec2(sin(p.y*3.+t*.5),0.)*.03*dt;    // a random walk, drifting toward the reef, with a slow current
      vec2 q=(floor(p/ax)+.5)*ax; float e=ax;                                              // read the field texel by texel, so only a true neighbour counts
      float near=max(max(X(q+vec2(e,0.)).r,X(q-vec2(e,0.)).r),max(X(q+vec2(0.,e)).r,X(q-vec2(0.,e)).r));
      if(near>.5 && X(q).r<.5 && r2<u0.w) { w=1.; p=q; }                                            // touched the reef: stick (not every time, which is what makes it branch)
      return vec4(p,h,w); }`,
    deposit: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ if(s.w>.5){ p=s.xy; col=vec3(1.,hue,mt*.01); size=1.3; } else { p=vec2(99.); col=vec3(0.); size=1.; } }`,
    draw: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; col=vec3(.08,.1,.12)*(s.w>.5?8.:1.); size=1.; }` },
  sim: `vec4 sim(vec2 p){
    if(u2.z>.5) return vec4(0.);                                                          // a clean dish at the start
    vec4 s=X(p);
    if(s.r>1.){ s.gb/=s.r; s.r=1.; }
    float pr=u1.w*smoothstep(u1.z,0.,length(p-u1.xy));                                     // crumbling: a patch loses its hold
    s.r*=1.-pr*.06;
    if(s.r<.5) s=vec4(0.);
    return s; }`, simSteps: 1,
  warp: `vec3 warp(vec2 p){ return mix(P(p),B(p),.1)*DK(.8); }`,
  comp: `vec3 comp(vec2 p){
    vec3 bg=mix(vec3(.0,.02,.05), vec3(.0,.13,.22), smoothstep(-1.,1.,p.y));
    float shaft=pow(max(0.,fbm(vec2(p.x*1.4+mt*.03+p.y*.3, p.y*.3))*1.5-.5),2.);
    bg+=vec3(.1,.3,.4)*shaft*smoothstep(-.4,1.,p.y)*(.5+.4*bassA);                         // light from the surface
    vec4 s=X(p); vec2 e=vec2(ax*1.5,0.);
    float sol=smoothstep(.3,.7,s.r);
    vec2 g=vec2(X(p+e.xy).r-X(p-e.xy).r, X(p+e.yx).r-X(p-e.yx).r);
    vec3 n=normalize(vec3(-g*4.,1.));
    float age=clamp((mt*.01-s.b)*14.,0.,1.);                                                // 0 = grown this moment
    vec3 col=pal(s.g+.05)*mix(1.,.6,age)+vec3(.9,.95,1.)*(1.-age)*.7;
    float dif=.35+.75*max(dot(n,normalize(vec3(.3,.8,.5))),0.);
    vec3 coral=col*dif+vec3(.2,.25,.3)*pow(max(dot(n,vec3(0.,0.,1.)),0.),8.)*.3;
    float rim=smoothstep(.0,.3,s.r)*(1.-sol);
    vec3 c=mix(bg, coral, sol)+pal(s.g)*rim*.6*(1.+.5*kick);
    c+=P(p)*1.1+glow(p)*.6;
    return c*vig(p); }`,
  init(S) { S.r = .22; S.cx = 0; S.cy = -.55; S.next = rnd(22, 38); S.timer = 0; S.prune = 0; S.px = 0; S.py = 0; S.pr = .3; S.seeded = 0; },
  update(S, dt) {
    S.timer += dt; S.r = Math.min(1.5, S.r + dt * .012 * (.5 + Math.min(2, A.energy)));
    if ((A.onSwing || S.timer > S.next) && S.prune <= 0) { S.timer = 0; S.next = rnd(22, 38); S.prune = 2.5; S.px = S.cx + rnd(-.6, .6) * S.r; S.py = S.cy + rnd(-.2, .8) * S.r; S.pr = rnd(.15, .35) + .3 * S.r; }
    S.prune -= dt;
    S.u0[0] = S.r; S.u0[1] = (.5 + .9 * Math.min(2, A.energy)) * .55 + .6 * A.kick; S.u0[2] = .012; S.u0[3] = .2 + .25 * Math.min(2, A.energy);   // specks wander a texel or so a frame: arriving slowly is what makes branches
    S.u1[0] = S.px; S.u1[1] = S.py; S.u1[2] = S.pr; S.u1[3] = S.prune > 0 ? 1 : 0;
    S.u2[0] = S.cx; S.u2[1] = S.cy; S.u2[2] = S.t < .03 ? 1 : 0;
  },
  simDraw(S) { if (S.seeded < 3) { S.seeded++; for (let i = 0; i < 4; i++) D.sprite(S.cx + (i - 1.5) * .18 * D.aspect, S.cy - .3 + rnd(0, .05), .012, 0, 1, A.hue + i * .07, S.mt * .01, 1, 0, 0, .1, 0); } },   // the first polyps on the seabed
  draw(S) { if (A.onKick) D.sprite(S.cx, S.cy, .5 + .4 * S.r, 0, 1, .9, .85, .05 * CFG.punch, 0, 0, 1, 1); }
});

PRESETS.push({
  name: 'Heartwood', accent: '#fcd9a0',
  // The cut face of a tree, growing while you watch. Every beat lays down a ring at the bark, its edge wobbled by the
  // waveform, pale early wood after the beat darkening into late wood before the next; the trunk swells so the
  // rings move inward and compress toward the heart, which is how a real one looks. A kick draws a hard dark line,
  // a swing leaves a knot, and the whole history of the song is there in the rings until it reaches the centre.
  warp: `vec3 warp(vec2 p){ vec2 q=p*(1.+u0.x); return P(q)*DK(.9995)*(1.-u0.y); }`,
  comp: `vec3 comp(vec2 p){
    vec2 po=p*vec2(1./1.09,1.); float r=length(po), a=atan(po.y,po.x);   // the log is a little wider than tall, as a real one is
    vec3 wood=P(p); wood+=vec3(.16,.08,.03)*(1.-smoothstep(.0,.25,lum(wood)));              // bare heart where no ring has reached yet
    float face=smoothstep(.815,.80,r);
    float grain=.88+.12*noise(vec2(a*16.+seed.x*9., r*5.))+.06*sin(a*90.+r*40.);           // the grain runs out from the heart
    float crack=smoothstep(.014,.0,abs(fract(a/TAU*7.+seed.x)-.5)-.49)*smoothstep(.06,.5,r)*smoothstep(.8,.55,r)*.75;   // drying checks from the heart
    wood*=grain*(1.-crack);
    wood*=mix(.72,1.,smoothstep(0.,.45,r));                                               // the heart is a shade darker
    vec3 c=mix(vec3(.025,.018,.012)*(.7+.3*fbm(p*4.)), wood, face);
    float bark=smoothstep(.80,.845,r)*smoothstep(1.0,.93,r);
    c+=vec3(.22,.12,.06)*bark*(.3+.7*fbm(vec2(a*9.+seed.y*5.,r*60.)))*(1.+.3*bassA)*(.7+.6*noise(vec2(a*30.,r*8.)));   // rough bark, deeply furrowed
    c+=glow(p)*.25;
    return c*vig(p); }`,
  init(S) { S.knots = []; S.hard = 0; S.seeded = false; },
  update(S, dt) {
    S.u0[0] = dt * (.07 + .06 * Math.min(2, A.energy)) * (1 + 1.5 * Math.max(0, 1 - S.t / 25));   // how much the trunk swells this frame: a beat is about one ring; faster at first, so the old log closes into the eye sooner
    S.u0[1] = S.t < .25 ? 1 : 0;
    if (A.onSwing) S.knots.push({ x: rnd(-.5, .5), y: rnd(-.5, .5), n: 6 });
    S.hard = A.onKick ? 1 : 0;
  },
  draw(S) {
    const asp = D.aspect, R = .8, k = 1 - Math.min(1, A.beat), amp = .006 + .018 * Math.min(2.5, A.bassA);
    const pr = .9, pg = .66, pb = .36, dr = .42, dg = .2, db = .07;
    palJS(A.hue, tmpC);
    if (!S.seeded && S.t >= .3) {         // the log already has years in it when the scene opens: a set of old rings, random spacing, a few hard ones
      S.seeded = true;
      for (let j = 0, rr = .1; rr < .78; j++, rr += rnd(.009, .03)) {
        const q = Math.random() < .2 ? 1.2 : rnd(.1, .7), ph = rnd(0, TAU), wob = rnd(.004, .012) * Math.min(1, rr / .45);   // small rings wobble less, or they read as polygons
        D.line(240, (i, u, p) => { const a = u * TAU, rad = rr * (1 + .06 * Math.sin(a * 2 + ph)) + wob * Math.sin(a * 7 + ph * 3); p.x = Math.cos(a) * rad * 1.09; p.y = Math.sin(a) * rad; p.r = (pr + (dr - pr) * q) * .9; p.g = (pg + (dg - pg) * q) * .9; p.b = (pb + (db - pb) * q) * .9; }, { w: q > 1 ? .005 : .006, closed: true, gain: q > 1 ? .7 : .25, core: .4 });
      }
    }
    D.line(360, (i, u, p) => {
      const w = sampleWave(mirrorU(u)), a = u * TAU, bark = .012 * (noise2(Math.cos(a) * 3 + 7, Math.sin(a) * 3) - .5), rr = R + w * amp + bark;
      p.x = Math.cos(a) * rr * 1.09; p.y = Math.sin(a) * rr;
      const q = S.hard ? 1.4 : k; p.r = (pr + (dr - pr) * q) * (.8 + .2 * tmpC.r); p.g = (pg + (dg - pg) * q) * (.8 + .2 * tmpC.g); p.b = (pb + (db - pb) * q) * (.8 + .2 * tmpC.b);
    }, { w: S.hard ? .005 : .006, closed: true, gain: (S.hard ? .9 : .28) * (1 + .3 * A.kick), core: .4 });
    const keep = [];
    for (const kn of S.knots) { kn.n--; for (let j = 0; j < 3; j++) { const rr = .04 + j * .02; D.line(40, (i, u, p) => { const a = u * TAU; p.x = kn.x + Math.cos(a) * rr * 1.3; p.y = kn.y + Math.sin(a) * rr; p.r = .35; p.g = .17; p.b = .06; }, { w: .006, closed: true, gain: .3, core: .5 }); } if (kn.n > 0) keep.push(kn); }
    S.knots = keep;
  }
});
const noise2 = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

PRESETS.push({
  name: 'Downpour', accent: '#7dd3fc',
  // Rain on a window at night, city lights behind it. Each drop lands, runs, and leaves a wet trail that catches the
  // light; how hard it rains follows the song, a kick throws a handful against the glass. Bass fills the pane from
  // the bottom like a flood, its surface a live waveform, and when it reaches the top it spills and drains away.
  sim: `vec4 sim(vec2 p){
    vec4 s=X(p); float th=s.r;
    float v=.0018+.03*smoothstep(.1,.9,th);                                                 // thick water runs, a thin film clings
    float wob=(noise(vec2(p.x*34.+seed.x*9.,p.y*6.+t*2.))-.5)*.006*smoothstep(.1,.5,th);
    float up=X(p+vec2(wob, v*u1.z)).r;                                                      // what is above comes down
    float n=max(up*.995, th*.982);
    float wl=u0.x-1.+.035*wav(p.x/aspect*.5+.5)*u0.y;                                       // the flood, its surface the waveform
    n=max(n, smoothstep(wl+.02, wl-.02, p.y)*1.3);
    return vec4(n, 0., 0., 1.); }`, simSteps: 2,
  warp: `vec3 warp(vec2 p){ return mix(P(p),B(p),.25)*DK(.9); }`,
  comp: `vec3 comp(vec2 p){
    vec4 s=X(p); vec2 e=vec2(ax*1.5,0.);
    vec2 g=vec2(X(p+e.xy).r-X(p-e.xy).r, X(p+e.yx).r-X(p-e.yx).r);
    float th=clamp(s.r,0.,1.5), flood=smoothstep(1.,1.2,s.r), wet=smoothstep(.02,.15,th);
    vec2 q=p+g*(.6+.4*flood);
    q+=flood*vec2(sin(p.y*28.+t*3.)*.012, sin(p.x*18.-t*2.5)*.012);                        // the flood has waves of its own
    vec3 dry=B(p)*.9+vec3(.01,.012,.02);                                                    // the city, out of focus through dry glass
    vec3 through=P(q)*1.3+B(q)*.5;                                                           // through water the lights come sharp and bent
    vec3 c=mix(dry, through, wet);
    c=mix(c, c*vec3(.55,.8,1.)+vec3(.0,.04,.09), flood);
    vec3 n=normalize(vec3(-g*6.,1.));
    c+=vec3(1.)*pow(max(0.,dot(n, normalize(vec3(.3,.6,.7)))),30.)*.7*wet;                  // the drops' highlights
    c+=vec3(.6,.8,1.)*smoothstep(.1,.5,length(g)*2.)*.3*wet;                                // rims catching the light
    float wl=u0.x-1.+.035*wav(p.x/aspect*.5+.5)*u0.y;
    c+=vec3(.7,.9,1.)*smoothstep(.025,.0,abs(p.y-wl))*u0.z*(.8+kick);                        // the meniscus
    c+=glow(p)*.35;
    return c*vig(p); }`,
  init(S) { S.lvl = 0; S.drain = 0; S.lights = []; for (let i = 0; i < 26; i++) S.lights.push({ x: rnd(-1, 1), y: rnd(-.9, .6), s: rnd(.03, .1), h: Math.random(), v: rnd(-.03, .03), b: i / 26 }); S.gush = 0; },
  update(S, dt) {
    if (S.drain > 0) { S.drain -= dt; S.lvl = Math.max(0, S.lvl - dt * 1.1); }
    else { S.lvl += dt * (.012 + .09 * Math.max(0, Math.min(2.5, A.bassA) - 1.05)) * CFG.speed; if (S.lvl > 1.95 || (A.onSwing && S.lvl > .3)) S.drain = 2.4; }
    S.u0[0] = S.lvl; S.u0[1] = .6 + Math.min(2, A.bassA); S.u0[2] = S.lvl > .03 ? 1 : 0;
    S.u1[2] = Math.min(2.5, dt * 60) * CFG.speed;
  },
  simDraw(S, dt) {
    const asp = D.aspect, rate = (3 + 30 * Math.min(2, A.energy) * (.4 + .6 * Math.min(2, A.trebA))) * dt;
    for (let n = Math.floor(rate + Math.random()); n > 0; n--) drop(rnd(-1, 1) * asp, rnd(-.7, 1), rnd(.5, 1.1), rnd(.008, .022));
    if (A.onKick) for (let i = 0; i < 7; i++) drop(rnd(-1, 1) * asp, rnd(-.6, 1), 1.3 * CFG.punch, rnd(.02, .05));   // a kick throws a handful at the glass
  },
  draw(S, dt) {
    const asp = D.aspect;
    for (const l of S.lights) {                                                             // the lights behind the glass: each one a slice of the spectrum, the traffic crawling
      l.x += l.v * dt; if (l.x > 1.1) l.x = -1.1; if (l.x < -1.1) l.x = 1.1;
      const lv = sampleSpec(l.b * .85); palJS(A.hue + l.h * .6, tmpC);
      D.sprite(l.x * asp, l.y, l.s + .06 * lv, 0, tmpC.r * .7 + .3, tmpC.g * .7 + .3, tmpC.b * .7 + .3, (.08 + .35 * lv), 0, 0, .35, 0);
    }
  }
});

PRESETS.push({
  name: 'Pendulum', accent: '#f0abfc', cam: .6,
  // A pendulum wave: a row of pendulums, each a little slower than the last, released together on a kick. They
  // drift out of step into snakes and braids, fall into pairs, scatter, and come back into one line after sixteen
  // beats, because their periods are set to the song's beat. Bass widens the swing, treble lights the bobs.
  warp: `vec3 warp(vec2 p){ vec2 q=p*(1.-.002*spd); return mix(P(q),B(q),.08)*DK(.82); }`,
  comp: `vec3 comp(vec2 p){
    vec3 c=vec3(.01,.008,.02)+pal(hue+.5)*.03*smoothstep(.25,.0,abs(p.y));                        // the axis they hang from
    c+=P(p)*1.25+glow(p)*1.;
    return c*vig(p); }`,
  init(S) { S.n = 24; S.t0 = 0; S.per = .5; S.lastK = 0; S.beatN = 0; S.amp = .5; S.py = new Float32Array(24).fill(.5); },
  update(S, dt) {
    S.lastK += dt;
    if (A.onKick) { if (S.lastK > .2 && S.lastK < 2) S.per += (S.lastK - S.per) * .3; S.lastK = 0; S.beatN++; if (S.beatN >= 16 || A.onSwing) { S.beatN = 0; S.t0 = S.t; } }   // released together every sixteen beats
    if (A.onSwing) { S.beatN = 0; S.t0 = S.t; }
    S.amp += ((.45 + .35 * Math.min(2, A.bassA)) - S.amp) * Math.min(1, dt * 4);
  },
  draw(S) {
    const asp = D.aspect, n = S.n, T = S.per * 16, tt = S.t - S.t0, rel = Math.exp(-tt * 3);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), x = (u * 2 - 1) * asp * .9, cycles = 24 + i, w = TAU * cycles / T;    // the i-th pendulum makes one more swing per cycle than the last
      const y = S.amp * Math.cos(w * tt), lv = sampleSpec(.1 + u * .7);
      palJS(A.hue + u * .6, tmpC);
      D.line(2, (k, v, p) => { p.x = x; p.y = v * y; p.r = tmpC.r * .5; p.g = tmpC.g * .5; p.b = tmpC.b * .5; }, { w: .0025, gain: .8 + .6 * A.kick, core: .3 });
      D.line(2, (k, v, p) => { p.x = x; p.y = k ? y : S.py[i]; p.r = tmpC.r; p.g = tmpC.g; p.b = tmpC.b; }, { w: .012 + .01 * lv, gain: .9 + 1.2 * lv + 1.5 * A.kick, core: .8 });   // the bob, as the stroke it made this frame
      D.sprite(x, y, .03 + .025 * lv + .03 * A.kick + .02 * rel, 0, 1, 1, 1, .4 + .6 * lv + 1.5 * A.kick + rel, 0, 0, .5, 1);
      S.py[i] = y;
    }
    if (rel > .5) D.line(n, (i, u, p) => { p.x = (u * 2 - 1) * asp * .9; p.y = S.amp; p.r = p.g = p.b = 1; }, { w: .004, gain: rel, core: .5 });   // the bar that lets them go
  }
});
