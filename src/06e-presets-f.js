// ---------- 3.5 scenes, part 1: crowds of agents on the GPU ----------

PRESETS.push({
  name: 'Slime Mould', accent: '#a7f3d0', simSteps: 1,
  // Physarum: a quarter of a million agents, each sniffing the trail ahead of it (left, centre, right), turning
  // toward the strongest scent and laying more down as it goes. Veins and networks grow out of nothing but that.
  // Music sets how far they sense, how sharply they turn and how fast they run; kicks scatter them, beats drop food.
  // The network never settles: the food wanders and runs out, every so often a bald wave strips the scent off the
  // dish and the veins regrow somewhere else, the dish drifts between fine lace and thick veins, and the biggest
  // kicks shove everything near one point outward.
  agents: { n: 262144,
    update: `vec4 agent(vec4 s, vec2 id){
      vec2 p=s.xy; float h=s.z, k=s.w;
      float sa=u0.y, sd=u0.z*(.7+.6*k), ta=u0.w;
      float wl=X(p+sd*dir(h+sa)).r, wc=X(p+sd*dir(h)).r, wr=X(p+sd*dir(h-sa)).r;
      float r=hash(id*vec2(91.3,57.1)+fract(t*.37)*vec2(13.,7.));
      if(wc>wl && wc>wr) {} else if(wc<wl && wc<wr) h+=(r<.5?-ta:ta); else if(wl>wr) h+=ta; else if(wr>wl) h-=ta;
      h+=(r-.5)*u1.y+(hash(id+fract(t))-.5)*u1.z;
      vec2 dc=p-u2.xy; float dl=length(dc), sh=u2.z*smoothstep(u2.w,u2.w*.15,dl);     // the shove: headings swing outward from its centre
      if(sh>.001){ float th=atan(dc.y,dc.x), dd=mod(th-h+PI,TAU)-PI; h+=dd*sh; }
      p+=dir(h)*u1.x*dt*(.6+.8*k+1.5*sh);
      if(abs(p.x)>aspect){ p.x=clamp(p.x,-aspect,aspect); h=PI-h; }
      if(abs(p.y)>1.){ p.y=clamp(p.y,-1.,1.); h=-h; }
      return vec4(p,h,k); }`,
    deposit: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; col=vec3(u1.w,0.,0.); size=1.; }`,
    draw: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; col=pal(hue+s.w*.25+.1)*(.10+.12*s.w); size=1.6; }` },
  sim: `vec4 sim(vec2 p){ vec2 e=vec2(ax,0.); float d=X(p).r*.4+(X(p+e.xy).r+X(p-e.xy).r+X(p+e.yx).r+X(p-e.yx).r)*.15; return vec4(d*u0.x,0.,0.,1.); }`,
  warp: `vec3 warp(vec2 p){ return mix(P(p),B(p),.3)*DK(.80); }`,
  comp: `vec3 comp(vec2 p){
    float d=X(p).r; vec2 e=vec2(ax*1.5,0.);
    vec2 g=vec2(X(p+e.xy).r-X(p-e.xy).r, X(p+e.yx).r-X(p-e.yx).r);
    vec3 n=normalize(vec3(-g*2.5,1.));
    float body=smoothstep(.03,1.1,d), core=smoothstep(1.8,5.,d);
    vec3 c=mix(pal(hue+.55)*.05, pal(hue+.08+.10*d)*.8, body)*(.45+.9*max(dot(n,normalize(vec3(-.4,.6,.7))),0.));
    c+=mix(pal(hue+.2), vec3(1.,.97,.9), core)*core*.7*(.8+.4*beat);              // the thickest veins glow white-hot
    c+=pal(hue+.45)*.45*smoothstep(.005,.08,d)*(1.-body);                          // a faint halo where the search parties are
    c+=P(p)*1.2+glow(p)*.5;
    return c*vig(p); }`,
  init(S) { S.scatter = 0; S.food = 6; S.feed = []; S.reg = .5; S.regT = .5; S.next = rnd(14, 26); S.timer = 0; S.sweep = null; S.shove = 0; S.sx = 0; S.sy = 0; S.sr = .5; S.kicks = 0; },
  update(S, dt) {
    const asp = D.aspect;
    S.timer += dt;
    // Every so often, and when the song changes gear: a new regime for the veins, and a bald wave rolls across the dish.
    if (A.onSwing || S.timer > S.next) {
      S.timer = 0; S.next = rnd(14, 26); S.regT = Math.random();
      if (!S.sweep) { const a = rnd(0, TAU); S.sweep = { x: -Math.cos(a) * asp * 1.45, y: -Math.sin(a) * 1.45, vx: Math.cos(a) * .55, vy: Math.sin(a) * .55, life: 5.5 }; }
      S.shove = 1; S.sx = -S.sweep.x * 1.1; S.sy = -S.sweep.y * 1.1; S.sr = 2.8;        // and a gust from the far side, so the whole network leans
    }
    S.reg += (S.regT - S.reg) * Math.min(1, dt * .25);
    if (S.sweep) { const w = S.sweep, v = dt * CFG.speed; w.x += w.vx * v; w.y += w.vy * v; w.life -= v; if (w.life <= 0) S.sweep = null; }
    // Three feeding spots wander the dish and run out; the network keeps re-routing after them. Every eighth beat one takes off.
    while (S.feed.length < 3) S.feed.push({ x: rnd(-.8, .8) * asp, y: rnd(-.8, .8), a: rnd(0, TAU), v: rnd(.05, .15), life: rnd(8, 22) });
    for (const f of S.feed) {
      const v = dt * CFG.speed; f.a += rnd(-1, 1) * dt * 1.5; f.x += Math.cos(f.a) * f.v * v; f.y += Math.sin(f.a) * f.v * v; f.life -= dt;
      if (Math.abs(f.x) > asp * 1.05 || Math.abs(f.y) > 1.05) f.a += Math.PI;
      f.v += (Math.min(f.v, .15) - f.v) * Math.min(1, dt * .6);
    }
    S.feed = S.feed.filter(f => f.life > 0);
    if (A.onBeat && A.beats % 8 === 0) { const f = S.feed[Math.floor(Math.random() * S.feed.length)]; if (f) { f.v = rnd(.5, .9); f.a = rnd(0, TAU); } }
    S.scatter = A.onKick ? Math.min(1.5, CFG.punch) * .6 : S.scatter * Math.max(0, 1 - dt * 6);
    if (A.onKick) { S.kicks++; if (A.bass > 1.5 || S.kicks % 4 === 0) { S.shove = 1; S.sx = rnd(-.8, .8) * asp; S.sy = rnd(-.8, .8); S.sr = .55; } }
    S.shove *= Math.max(0, 1 - dt * 4);
    const rg = S.reg;                                                  // 0 = fine lace, 1 = few thick veins
    S.u0[0] = .952 + .02 * rg - .01 * Math.min(2, A.trebA);           // trail decay per step: treble clears the slate faster
    S.u0[1] = .28 + .2 * rg + .22 * Math.min(1.5, A.midA);             // sensor angle
    S.u0[2] = .035 + .06 * rg + .035 * Math.min(2, A.bassA);           // sensor distance: bass makes them look further ahead
    S.u0[3] = .3 + .15 * (1 - rg) + .25 * Math.min(2, A.midA) + .5 * A.kick;   // turn angle
    S.u1[0] = (.30 + .35 * Math.min(1.5, A.energy) + .9 * A.kick) * CFG.speed;   // speed, p-units per second
    S.u1[1] = .03 + .08 * (1 - rg) + .10 * Math.min(2, A.trebA);       // wander
    S.u1[2] = S.scatter * 6.283;                                       // a kick throws every heading
    S.u1[3] = .035;                                                    // trail laid per agent per frame
    S.u2[0] = S.sx; S.u2[1] = S.sy; S.u2[2] = S.shove * .5; S.u2[3] = S.sr;
  },
  simDraw(S) {       // food: beats drop scent the agents converge on, and the first seconds get a few to start the network
    const asp = D.aspect, food = (x, y, r, a) => D.sprite(x, y, r, 0, a, 0, 0, 1, 0, 0, .6, 1);
    for (; S.food > 0; S.food--) food(rnd(-.8, .8) * asp, rnd(-.8, .8), .12, 1.5);
    if (A.onKick) food(rnd(-.85, .85) * asp, rnd(-.85, .85), .08 + .06 * Math.min(2, A.bass), 2.5 * CFG.punch);
    for (const f of S.feed) food(f.x, f.y, .05, (.12 + .18 * Math.min(2, A.midA)) * Math.min(1, f.life));   // fades as it runs out
    if (S.sweep) food(S.sweep.x, S.sweep.y, .45, -1.2);                // the bald wave strips the scent; the agents flee ahead of it and regrow behind
  },
  draw() {}
});

PRESETS.push({
  name: 'Murmuration', accent: '#fdba74', simSteps: 1, cam: .6,
  // A starling flock at dusk. Each bird reads the crowd around it from a low-res field the flock paints into:
  // density (r) and summed heading (g,b). It lines up with its neighbours, drifts toward the thick of the flock,
  // backs off when crowded, and each half of the flock is drawn toward its own wandering point; the halves join
  // into one flock and split again over the song. A bass swell balls it up, treble frays the edges, a kick sends
  // a shiver through every bird at once, and now and then a falcon cuts through and the flock opens around it.
  agents: { n: 16384,
    update: `vec4 agent(vec4 s, vec2 id){
      vec2 p=s.xy; float h=s.z, z=s.w;
      vec4 f=X(p); vec2 e=vec2(.2,0.), e2=vec2(.022,0.);
      vec2 gf=vec2(X(p+e.xy).r-X(p-e.xy).r, X(p+e.yx).r-X(p-e.yx).r);       // where the flock is, at range
      vec2 gn=vec2(X(p+e2.xy).r-X(p-e2.xy).r, X(p+e2.yx).r-X(p-e2.yx).r);   // who is right next to me
      vec2 v=dir(h), want=v*.6;
      if(f.r>.02) want+=normalize(f.gb+1e-5)*u0.y;
      want+=gf*u0.z-gn*4.*smoothstep(.5,2.5,f.r);
      vec2 tgt=fract(z*3.7)<.5 ? u1.xy : u1.zw;                                   // which half of the flock this bird flies with
      vec2 toA=tgt-p; float la=length(toA); want+=toA/max(la,1e-3)*1.3*smoothstep(.05,.45,la);
      vec2 fr=p-u2.xy; float lf=length(fr), fear=u2.z*smoothstep(u2.w,0.,lf);     // the falcon: everyone near it breaks away hard
      want+=fr/max(lf,1e-3)*fear;
      float th=atan(want.y,want.x), d=mod(th-h+PI,TAU)-PI, turn=4.5+3.*kick+8.*fear;
      h+=clamp(d,-turn*dt,turn*dt);
      float r=hash(id*vec2(71.3,37.1)+fract(t*.41)*vec2(11.,5.));
      h+=(r-.5)*u0.w;
      p+=dir(h)*u0.x*dt*(.85+.3*z+.6*fear);
      if(abs(p.x)>aspect*1.05){ p.x=clamp(p.x,-aspect*1.05,aspect*1.05); h=PI-h; }
      if(abs(p.y)>1.05){ p.y=clamp(p.y,-1.05,1.05); h=-h; }
      return vec4(p,h,z); }`,
    deposit: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; col=vec3(.06,dir(s.z)*.06); size=6.; }`,
    draw: `void place(vec4 s, out vec2 p, out vec3 col, out float size){ p=s.xy; col=vec3(.35+.65*s.w); size=1.6+2.6*s.w; }` },
  sim: `vec4 sim(vec2 p){ vec2 e=vec2(ax*2.,0.); vec4 f=X(p)*.2+(X(p+e.xy)+X(p-e.xy)+X(p+e.yx)+X(p-e.yx))*.2; return f*.62; }`,
  warp: `vec3 warp(vec2 p){ return P(p)*DK(.5); }`,
  comp: `vec3 comp(vec2 p){
    float y=p.y, sx=.3*sin(mt*.05+seed.x*6.);
    vec3 top=mix(vec3(.03,.03,.12), pal(hue+.6)*.2, .5), low=mix(vec3(.85,.35,.12), pal(hue+.1), .3);
    vec3 sky=mix(low, top, smoothstep(-1.,.5,y));
    float sd=length(vec2((p.x-sx)*.8, y+.78));
    sky+=vec3(1.,.72,.38)*(exp(-sd*5.)*.55*(.6+.4*bassA)+smoothstep(.11,.095,sd)*1.3);     // the sun, almost down
    sky+=vec3(.45,.22,.4)*fbm(p*vec2(1.2,3.)+vec2(mt*.02,0.))*smoothstep(-.7,.3,y)*.3;     // thin cloud
    float birds=clamp(lum(P(p))*2.2,0.,1.), rim=smoothstep(.08,.6,lum(B(p)));
    vec3 c=sky*(1.-birds*.92)+vec3(1.,.7,.45)*rim*.12*(.5+.5*beat);
    return c*vig(p); }`,
  init(S) { S.a = [0, 0, 0, 0]; S.tg = [0, 0, 0, 0]; S.scatter = 0; S.split = 1; S.splitT = 1; S.next = rnd(10, 20); S.timer = 0; S.pred = null; },
  update(S, dt) {
    const asp = D.aspect, pick = k => { S.tg[k] = rnd(-.85, .85) * asp; S.tg[k + 1] = rnd(-.8, .8); };
    S.timer += dt;
    if (A.onBeat && A.beats % 4 === 0 || Math.random() < dt * .08) pick(Math.random() < .5 ? 0 : 2);                 // somewhere new to head for, anywhere on the screen
    if (A.onSwing || S.timer > S.next) { S.timer = 0; S.next = rnd(12, 24); S.splitT = S.splitT > .5 ? 0 : 1; if (S.splitT > .5) pick(2); }   // the halves join up, or part again
    S.split += (S.splitT - S.split) * Math.min(1, dt * .4);
    for (let k = 0; k < 4; k++) { const g = k < 2 ? S.tg[k] : S.tg[k] * S.split + S.tg[k - 2] * (1 - S.split); S.a[k] += (g - S.a[k]) * Math.min(1, dt * .5); }
    // A falcon: in from outside the picture, straight through the flock, out the far side.
    if (!S.pred && ((A.onKick && A.bass > 1.5 && Math.random() < .4) || Math.random() < dt * .035)) {
      const an = rnd(0, TAU), x = Math.cos(an) * asp * 1.3, y = Math.sin(an) * 1.3, cx = (S.a[0] + S.a[2]) * .5 + rnd(-.2, .2), cy = (S.a[1] + S.a[3]) * .5 + rnd(-.2, .2), l = Math.hypot(cx - x, cy - y);
      S.pred = { x, y, vx: (cx - x) / l * 1.1, vy: (cy - y) / l * 1.1, life: 4 };
    }
    if (S.pred) { const q = S.pred, v = dt * CFG.speed; q.x += q.vx * v; q.y += q.vy * v; q.life -= v; if (q.life <= 0 || Math.abs(q.x) > asp * 1.35 || Math.abs(q.y) > 1.35) S.pred = null; }
    S.scatter = A.onKick ? Math.min(1.5, CFG.punch) : S.scatter * Math.max(0, 1 - dt * 5);
    S.u0[0] = (.32 + .22 * Math.min(1.5, A.energy)) * CFG.speed;       // airspeed
    S.u0[1] = .9 + .5 * Math.min(1.5, A.midA);                          // alignment
    S.u0[2] = 1.2 + 3.5 * Math.max(0, Math.min(2, A.bassA) - .9);       // cohesion: only a real bass swell balls the flock up
    S.u0[3] = .03 + .16 * Math.min(2, A.trebA) + 1.6 * S.scatter;       // fray and shiver
    S.u1.set(S.a);                                                      // the two targets
    S.u2[0] = S.pred ? S.pred.x : 99; S.u2[1] = S.pred ? S.pred.y : 99; S.u2[2] = S.pred ? 5 : 0; S.u2[3] = .4;
  },
  draw(S) { if (S.pred) D.sprite(S.pred.x, S.pred.y, .016, 0, 1, 1, 1, 1, 0, 0, .6, 1); }   // drawn bright, so the composite paints it as one dark bird bigger than the rest
});
