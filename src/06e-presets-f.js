// ---------- 3.5 scenes, part 1: crowds of agents on the GPU ----------

PRESETS.push({
  name: 'Slime Mould', accent: '#a7f3d0', simSteps: 1,
  // Physarum: a quarter of a million agents, each sniffing the trail ahead of it (left, centre, right), turning
  // toward the strongest scent and laying more down as it goes. Veins and networks grow out of nothing but that.
  // Music sets how far they sense, how sharply they turn and how fast they run; kicks scatter them, beats drop food.
  agents: { n: 262144,
    update: `vec4 agent(vec4 s, vec2 id){
      vec2 p=s.xy; float h=s.z, k=s.w;
      float sa=u0.y, sd=u0.z*(.7+.6*k), ta=u0.w;
      float wl=X(p+sd*dir(h+sa)).r, wc=X(p+sd*dir(h)).r, wr=X(p+sd*dir(h-sa)).r;
      float r=hash(id*vec2(91.3,57.1)+fract(t*.37)*vec2(13.,7.));
      if(wc>wl && wc>wr) {} else if(wc<wl && wc<wr) h+=(r<.5?-ta:ta); else if(wl>wr) h+=ta; else if(wr>wl) h-=ta;
      h+=(r-.5)*u1.y+(hash(id+fract(t))-.5)*u1.z;
      p+=dir(h)*u1.x*dt*(.6+.8*k);
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
  init(S) { S.scatter = 0; S.food = 6; },
  update(S, dt) {
    S.scatter = A.onKick ? Math.min(1.5, CFG.punch) * .6 : S.scatter * Math.max(0, 1 - dt * 6);
    S.u0[0] = .962 - .01 * Math.min(2, A.trebA);                      // trail decay per step: treble clears the slate faster
    S.u0[1] = .32 + .22 * Math.min(1.5, A.midA);                       // sensor angle
    S.u0[2] = .05 + .035 * Math.min(2, A.bassA);                       // sensor distance: bass makes them look further ahead
    S.u0[3] = .35 + .25 * Math.min(2, A.midA) + .5 * A.kick;           // turn angle
    S.u1[0] = (.30 + .35 * Math.min(1.5, A.energy) + .9 * A.kick) * CFG.speed;   // speed, p-units per second
    S.u1[1] = .04 + .10 * Math.min(2, A.trebA);                        // wander
    S.u1[2] = S.scatter * 6.283;                                       // a kick throws every heading
    S.u1[3] = .035;                                                    // trail laid per agent per frame
  },
  simDraw(S) {       // food: beats drop scent the agents converge on, and the first seconds get a few to start the network
    const asp = D.aspect, food = (x, y, r, a) => D.sprite(x, y, r, 0, a, 0, 0, 1, 0, 0, .6, 1);
    for (; S.food > 0; S.food--) food(rnd(-.8, .8) * asp, rnd(-.8, .8), .12, 1.5);
    if (A.onKick) food(rnd(-.85, .85) * asp, rnd(-.85, .85), .08 + .06 * Math.min(2, A.bass), 2.5 * CFG.punch);
    const a = S.mt * .25; food(Math.cos(a) * asp * .5, Math.sin(a * 1.3) * .5, .05, .25 * A.midA);
  },
  draw() {}
});

PRESETS.push({
  name: 'Murmuration', accent: '#fdba74', simSteps: 1, cam: .6,
  // A starling flock at dusk. Each bird reads the crowd around it from a low-res field the flock paints into:
  // density (r) and summed heading (g,b). It lines up with its neighbours, drifts toward the thick of the flock,
  // backs off when crowded, and the whole flock is drawn toward a point that wanders. Bass pulls it into a ball,
  // treble frays the edges, a kick sends a shiver through every bird at once.
  agents: { n: 16384,
    update: `vec4 agent(vec4 s, vec2 id){
      vec2 p=s.xy; float h=s.z, z=s.w;
      vec4 f=X(p); vec2 e=vec2(.2,0.), e2=vec2(.022,0.);
      vec2 gf=vec2(X(p+e.xy).r-X(p-e.xy).r, X(p+e.yx).r-X(p-e.yx).r);       // where the flock is, at range
      vec2 gn=vec2(X(p+e2.xy).r-X(p-e2.xy).r, X(p+e2.yx).r-X(p-e2.yx).r);   // who is right next to me
      vec2 v=dir(h), want=v*.6;
      if(f.r>.02) want+=normalize(f.gb+1e-5)*u0.y;
      want+=gf*u0.z-gn*3.*smoothstep(1.2,4.,f.r);
      vec2 toA=u1.xy-p; float la=length(toA); want+=toA/max(la,1e-3)*u1.z*smoothstep(.05,.45,la);
      float th=atan(want.y,want.x), d=mod(th-h+PI,TAU)-PI;
      h+=clamp(d,-u1.w*dt,u1.w*dt);
      float r=hash(id*vec2(71.3,37.1)+fract(t*.41)*vec2(11.,5.));
      h+=(r-.5)*u0.w;
      p+=dir(h)*u0.x*dt*(.85+.3*z);
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
  init(S) { S.ax = 0; S.ay = 0; S.tx = 0; S.ty = 0; S.scatter = 0; },
  update(S, dt) {
    const asp = D.aspect;
    if (A.onBeat && A.beats % 4 === 0 || Math.random() < dt * .08) { S.tx = rnd(-.55, .55) * asp; S.ty = rnd(-.45, .55); }
    S.ax += (S.tx - S.ax) * Math.min(1, dt * .5); S.ay += (S.ty - S.ay) * Math.min(1, dt * .5);
    S.scatter = A.onKick ? Math.min(1.5, CFG.punch) : S.scatter * Math.max(0, 1 - dt * 5);
    S.u0[0] = (.32 + .22 * Math.min(1.5, A.energy)) * CFG.speed;       // airspeed
    S.u0[1] = .9 + .5 * Math.min(1.5, A.midA);                          // alignment
    S.u0[2] = 2.5 + 4.5 * Math.min(2, A.bassA);                          // cohesion: bass balls the flock up
    S.u0[3] = .03 + .16 * Math.min(2, A.trebA) + 1.6 * S.scatter;       // fray and shiver
    S.u1[0] = S.ax; S.u1[1] = S.ay; S.u1[2] = 1.3; S.u1[3] = 4.5 + 3 * S.scatter;
  },
  draw() {}
});
