// ---------- 3.0 scenes: a 3D landscape, and three rebuilt from classic Milkdrop ideas ----------

PRESETS.push({
  name: 'Ridgeline', accent: '#f0abfc', fit: false, simSteps: 1,
  // The low-res buffer is a strip of terrain: each step every row slides toward us and the far edge takes
  // the spectrum as it is right now (bass in the middle). r = height, g = how hard the beat was hitting.
  sim: `vec4 sim(vec2 p){
    vec4 s=X(p+vec2(0.,ax));
    if(p.y>1.-ax*1.5){
      float x=abs(p.x)/aspect, h=spec(.02+x*.8)*(.3+.7*smoothstep(1.05,.1,x));
      s=vec4(mix(X(p).r,h,.5), kick, 0., 1.); }
    return s; }`,
  warp: `vec3 warp(vec2 p){ return P(p)*DK(.9); }`,
  comp: `#define SELF
  const float L=6.;
  vec4 land(vec2 w){ return X(vec2(w.x, w.y/L*2.-1.)); }
  float hgt(vec2 w){ return land(w).r*(.85+.12*bassA); }
  vec3 sky(vec3 d){
    vec3 c=mix(pal(hue+.62)*.22, vec3(.004,.006,.02), smoothstep(-.02,.45,d.y));
    float sd=length(vec2(d.x, d.y-.10));
    c+=mix(pal(hue+.5), vec3(1.,.9,.7), .35)*(smoothstep(.20,.19,sd)*step(.0,sin(d.y*90.)+.45+d.y*4.)*(.9+.5*kick)+exp(-sd*5.)*.35*(.6+.4*bassA));
    vec2 sc=d.xy/(d.z+.4)*40.; float st=hash(floor(sc));
    c+=step(.99,st)*smoothstep(.45,0.,length(fract(sc)-.5))*smoothstep(.15,.4,d.y)*(.5+.5*trebA);
    return c; }
  vec3 comp(vec2 p){
    float cy=cos(cam.x*.9), sy=sin(cam.x*.9), cp=cos(cam.y*.7-.13), sn=sin(cam.y*.7-.13);
    vec3 d=normalize(vec3(rot(cam.z*1.3)*sp, 1.7));
    d=vec3(d.x, cp*d.y+sn*d.z, -sn*d.y+cp*d.z); d=vec3(cy*d.x+sy*d.z, d.y, -sy*d.x+cy*d.z);
    vec3 o3=vec3(cam.x*1.6, .62+.10*sin(mt*.3)+.25*(1.-cam.w)*4., .05);
    float tt=.06, pt=0., dh=1.; bool hit=false;
    for(int i=0;i<52;i++){
      vec3 q=o3+d*tt; if(q.z>L*.98||tt>9.) break;
      dh=q.y-hgt(q.xz);
      if(dh<0.){ hit=true; break; }
      pt=tt; tt+=max(.018, dh*.42)*(1.+tt*.08); }
    vec3 bg=sky(d);
    if(!hit) return bg;
    for(int i=0;i<4;i++){ float m=.5*(pt+tt); vec3 q=o3+d*m; if(q.y<hgt(q.xz)) tt=m; else pt=m; }
    vec3 q=o3+d*tt; vec4 s=land(q.xz); float h=s.r;
    vec2 e=vec2(.03,0.);
    vec3 n=normalize(vec3(hgt(q.xz-e.xy)-hgt(q.xz+e.xy), .06, hgt(q.xz-e.yx)-hgt(q.xz+e.yx)));
    float rows=q.z/L*270., lz=abs(fract(rows/5.)-.5)*5., lx=abs(fract(q.x*4.)-.5)/4.;
    float wire=smoothstep(.55,.15,lz)+smoothstep(.012,.003,lx)*.6;                     // contour lines that travel with the land
    vec3 base=pal(hue+h*.55+.08*q.z)*(.06+.5*h*h);
    vec3 c=base*(.5+.8*max(dot(n,normalize(vec3(.3,.8,.5))),0.));
    c+=pal(hue+.5+h*.4)*wire*(.25+1.3*h+1.5*s.g);                                      // rows laid down on a kick glow as they roll in
    c+=bg*.25*pow(1.-max(dot(n,-d),0.),3.);
    return mix(bg, c, exp(-tt*.30)); }`,
  draw() {}
});

PRESETS.push({
  name: 'Petri', accent: '#a3e635', simSteps: 10,
  // Reaction-diffusion (the idea behind Flexi's organic Milkdrop presets): two chemicals, one eats the other,
  // and spots, worms and coral grow by themselves. Sound seeds new colonies and shifts the chemistry.
  sim: `vec4 sim(vec2 p){
    vec2 q=rot(.0007*(midA-.6))*p*(1.-.0005*kick);
    vec2 e=vec2(ax,0.), d=vec2(ax,ax);
    vec2 s=X(q).rg; if(s.r+s.g<.002) s.r=1.;
    s=clamp(s,0.,1.);
    vec2 lap=(X(q+e.xy).rg+X(q-e.xy).rg+X(q+e.yx).rg+X(q-e.yx).rg)*.2+(X(q+d).rg+X(q-d).rg+X(q+vec2(d.x,-d.y)).rg+X(q+vec2(-d.x,d.y)).rg)*.05-s;
    float f=.026+.024*smoothstep(-1.,1.,p.y)+.004*(bassA-1.), k=.0595+.0062*smoothstep(-aspect,aspect,p.x)+.001*sin(mt*.2);
    float r=s.r*s.g*s.g;
    s+=vec2(lap.r-r+f*(1.-s.r), .5*lap.g+r-(k+f)*s.g);
    return vec4(clamp(s,0.,1.),0.,1.); }`,
  warp: `vec3 warp(vec2 p){ float b=X(p).g; return mix(P(p)*DK(.9), pal(hue+b*1.2+.15)*smoothstep(.08,.45,b), .5); }`,
  comp: `vec3 comp(vec2 p){
    vec2 e=vec2(ax*1.2,0.);
    float b=X(p).g;
    vec2 g=vec2(X(p+e.xy).g-X(p-e.xy).g, X(p+e.yx).g-X(p-e.yx).g);
    vec3 n=normalize(vec3(-g*7.,1.)), r=reflect(rd,n);
    float body=smoothstep(.10,.30,b);
    vec3 c=mix(pal(hue+.55)*.04, pal(hue+b*1.3+.1+.16*sin(p.x*1.4+mt*.1)+.1*p.y), body);
    c*=.45+.8*max(dot(n,normalize(vec3(-.4,.5,.75))),0.);
    c+=pal(hue+.4)*.55*smoothstep(.02,.12,b)*(1.-body);                               // the glowing skin of each colony
    c+=vec3(1.)*pow(max(dot(r,normalize(vec3(.3,.5,.8))),0.),40.)*.6*body;
    c+=glow(p)*.6;
    return c*(.85+.5*beat*body)*vig(p); }`,
  init(S) { S.seeds = 40; },
  simDraw(S) {
    const asp = D.aspect, seed = (x, y, r, a) => D.sprite(x, y, r, 0, 0, a, 0, 1, 0, 0, 1, 1);
    for (; S.seeds > 0; S.seeds--) seed(rnd(-1, 1) * asp, rnd(-1, 1), rnd(.03, .07), .6);
    if (A.onKick) seed(rnd(-.8, .8) * asp, rnd(-.8, .8), .05 + .03 * Math.min(2, A.bass), .7);
    if (A.onBeat) for (let i = 0; i < 2; i++) seed(rnd(-1, 1) * asp, rnd(-1, 1), .03, .5);
    for (let i = Math.floor(A.trebA * Math.random() * 1.2); i > 0; i--) seed(rnd(-1, 1) * asp, rnd(-1, 1), .015, .5);
  },
  draw() {}
});

PRESETS.push({
  name: 'Hall of Mirrors', accent: '#fbbf24',
  // The classic Milkdrop trick of drawing the whole previous frame back into itself, shrunk and turned,
  // several times over: screens within screens, all the way down.
  warp: `vec3 warp(vec2 p){
    float n=floor(3.+seed.x*2.99), a0=mt*.07+bstep*.07, sc=1.95+.25*sin(mt*.11)-.22*kick, rad=.50+.06*sin(mt*.17)+.05*(bassA-1.);
    vec3 c=vec3(0.);
    for(int i=0;i<5;i++){ if(float(i)>=n) break;
      float a=a0+float(i)*TAU/n; vec2 q=rot(mt*.05-a)*(p-rad*vec2(cos(a),sin(a))*vec2(1.25,1.))*sc;
      float m=smoothstep(1.,.93,abs(q.y))*smoothstep(aspect,aspect*.95,abs(q.x));
      c=max(c, P(q)*m); }
    return hueRot(c,.035+.02*trebA)*DK(.942); }`,
  comp: `vec3 comp(vec2 p){ vec3 c=ca(p,.004+.012*beat)+glow(p)*.9; return c*vig(p); }`,
  draw(S) {
    const R = .16 + .05 * A.bassA + .07 * A.kick;
    D.line(200, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU + S.mt * .3, r = R + w * (.05 + .06 * A.midA); p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; palJS(A.hue + u * .3, p, 1.1); }, { w: .009, closed: true, gain: .8 });
    if (A.onBeat) { S.bl = Math.min(1.5, CFG.punch); S.bs = 3 + Math.floor(Math.random() * 4); S.bh = A.hue + .5; }
    S.bl = (S.bl || 0) * .86;
    if (S.bl > .04) { palJS(S.bh, tmpC); D.sprite(0, 0, .30 + .25 * (1 - S.bl), S.mt * .5, tmpC.r, tmpC.g, tmpC.b, 1.2 * S.bl, S.bs, .02, .04, 0); }
    const asp = D.aspect;     // a frame around the edge, so each copy reads as a screen
    D.line(5, (i, u, p) => { const c = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]][i]; p.x = c[0] * asp * .985; p.y = c[1] * .985; palJS(A.hue + .15, p, .35 + .5 * A.beat); }, { w: .008, gain: .5 });
  }
});

PRESETS.push({
  name: 'Maelstrom', accent: '#38bdf8',
  // Milkdrop's whirlpool warp: everything spins faster the nearer it gets to the centre, and drains into it.
  warp: `vec3 warp(vec2 p){
    float r=length(p)+.02;
    float w=(.020+.014*(midA-1.)+.02*kick)/(r*r*.9+.14)*sign(seed.x-.5);
    vec2 q=rot(w)*p*(1.+(.010+.008*bassA)/(r+.3));
    q=mix(p,q,spd);
    vec3 c=mix(P(q), B(q), .035);
    return hueRot(c,.007)*DK(.978)*smoothstep(.0,.10,r); }`,
  comp: `vec3 comp(vec2 p){
    vec2 e=vec2(.008,0.);
    vec3 c=P(p);
    vec2 g=vec2(lum(P(p+e.xy))-lum(P(p-e.xy)), lum(P(p+e.yx))-lum(P(p-e.yx)));
    vec3 n=normalize(vec3(-g*3.,1.));
    c*=.7+.6*max(dot(n,normalize(vec3(-.4,.5,.7))),0.);                               // lit like the surface of water
    c+=pow(max(dot(reflect(rd,n),normalize(vec3(.3,.5,.8))),0.),30.)*.5*smoothstep(.05,.5,lum(c));
    c+=glow(p)*.7;
    return c*vig(p); }`,
  draw(S) {
    const asp = D.aspect, R = .92;
    D.line(300, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU + S.mt * .1, r = R + w * (.06 + .08 * A.midA); p.x = Math.cos(a) * r * asp * .78; p.y = Math.sin(a) * r; palJS(A.hue + u * .5, p, .5 + .5 * sampleSpec(mirrorU(u))); }, { w: .012 + .008 * A.kick, closed: true, gain: .6 });
    for (let k = 0; k < 3; k++) { const a = S.mt * (.21 + .07 * k) + k * 2.1, lv = [A.bassA, A.midA, A.trebA][k]; palJS(A.hue + .33 * k + .2, tmpC); D.sprite(Math.cos(a) * asp * .72, Math.sin(a) * .85, .03 + .03 * lv, 0, tmpC.r, tmpC.g, tmpC.b, .25 * lv, 0, 0, .9, 1); }
    if (A.onKick) for (let i = 0; i < 6; i++) { const a = rnd(0, TAU); palJS(A.hue + rnd(0, .3), tmpC); D.sprite(Math.cos(a) * asp * .8, Math.sin(a) * .95, rnd(.03, .07), 0, tmpC.r, tmpC.g, tmpC.b, 1.2 * CFG.punch, 0, 0, .8, 1); }
  }
});
