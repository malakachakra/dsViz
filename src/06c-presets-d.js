// ---------- Liquid scenes, part 2: a rippling surface, and one true 3D scene ----------
// The ripple buffer runs the wave equation at low resolution: sound drops things into it, the composite lights it.
const WAVE_SIM = (speed, damp) => `vec4 sim(vec2 p){
  vec4 s=X(p); vec2 e=vec2(ax,0.);
  float n=X(p+e.xy).r+X(p-e.xy).r+X(p+e.yx).r+X(p-e.yx).r;
  float v=(s.g+(n*.25-s.r)*${speed})*${damp};
  return vec4((s.r+v)*.9985, v, 0., 1.); }`;
const WATER_LIB = `
vec3 wn(vec2 p, float k){ vec2 e=vec2(ax*1.5,0.); return normalize(vec3((X(p-e.xy).r-X(p+e.xy).r)*k, (X(p-e.yx).r-X(p+e.yx).r)*k, 1.)); }
float wlap(vec2 p){ vec2 e=vec2(ax*1.5,0.); return X(p+e.xy).r+X(p-e.xy).r+X(p+e.yx).r+X(p-e.yx).r-4.*X(p).r; }
`;
const ENV_LIB = `
vec3 env(vec3 r){     // a dark room with three soft light panels in the scene's colours; r.z points back at the viewer
  float a=atan(r.y,r.x), el=r.z;
  vec3 c=vec3(.008,.010,.018)+vec3(.09,.11,.16)*smoothstep(.2,1.,el);
  for(int i=0;i<4;i++){ float fi=float(i), d=abs(mod(a-(fi*1.57+mt*.05+seed.x*6.)+PI,TAU)-PI);
    c+=mix(vec3(1.), pal(hue+fi*.25), .7)*smoothstep(.5,.3,d)*smoothstep(.17,.08,abs(el-(.38+.13*fi)))*(1.5+.7*bassA); }
  c+=vec3(.8,.9,1.)*smoothstep(.025,0.,abs(el-.14))*.5;          // a thin bright horizon
  return c; }
`;
const drop = (x, y, amp, r) => D.sprite(x, y, r, 0, amp, 0, 0, 1, 0, 0, 1, 1);

PRESETS.push({
  name: 'Moon Pool', accent: '#93c5fd', cam: .5, fit: false, camBase: { pitch: 1.4 }, sim: WAVE_SIM('1.7', '.997'), simSteps: 3,
  warp: `vec3 warp(vec2 p){ vec3 c=mix(P(p*1.004), B(p*1.004), .25); return c*DK(.955); }`,
  comp: `#define SELF
  ` + WATER_LIB + `
  vec3 sky(vec3 d){                                    // d.z is up, d.y is away from us
    float up=max(d.z,0.);
    vec3 c=mix(vec3(.05,.07,.16), vec3(.005,.008,.03), smoothstep(0.,.5,up));
    c+=pal(hue+.6)*.10*exp(-up*7.);
    float md=max(dot(d,normalize(vec3(.18,1.,.09))),0.);
    c+=vec3(1.,.96,.88)*(smoothstep(.9975,.9985,md)*2.2+pow(md,90.)*.5+pow(md,8.)*.08*(1.+bassA));
    vec2 sc=d.xy/(abs(d.z)+.35)*38.; float st=hash(floor(sc));
    c+=step(.992,st)*smoothstep(.45,0.,length(fract(sc)-.5))*(.5+.5*sin(t*3.+st*90.))*smoothstep(.02,.2,up)*(.6+.6*trebA);
    return c; }
  vec3 comp(vec2 p){
    if(rd.z>-.004) return sky(rd);
    float far=smoothstep(2.,14.,hitT);
    vec3 n=wn(p, 9.*(1.-.8*far)), r=reflect(rd,n); r.z=abs(r.z);
    float fres=.04+.96*pow(1.-max(dot(-rd,n),0.),5.);
    vec3 under=(P(p+n.xy*.12)*1.4+glow(p)*.6)*(1.-far);            // light under the surface, bent by the ripples
    vec3 c=mix(vec3(.004,.02,.035)+pal(hue+.55)*.02+under, sky(r), fres);
    c+=vec3(1.,.97,.9)*pow(max(dot(r,normalize(vec3(.18,1.,.09))),0.),180.)*2.4;      // moon glints
    return mix(c, sky(normalize(vec3(rd.xy,.001))), smoothstep(8.,30.,hitT)); }`,
  swim(S, k) { const a = S.mt * (.25 + .08 * k) + k * 2.6; return [Math.cos(a) * D.aspect * .55, Math.sin(a * 1.6 + k) * .6]; },
  simDraw(S, dt) {
    const asp = D.aspect;
    if (A.onKick) { S.kx = rnd(-.5, .5) * asp; S.ky = rnd(-.3, .6); drop(S.kx, S.ky, (-1.5 - .4 * A.bass) * CFG.punch, .10); }
    for (let i = Math.floor(A.trebA * 1.4 * Math.random() + (A.onBeat ? 2 : 0)); i > 0; i--) drop(rnd(-1, 1) * asp, rnd(-1, 1), .45, .026);
    for (let k = 0; k < 2; k++) { const [x, y] = this.swim(S, k); drop(x, y, .09 * A.midA, .035); }
    drop(0, .1, .05 * A.bassA * Math.sin(S.t * 5), .6);
  },
  draw(S) {
    if (A.onKick) { palJS(A.hue + .55, tmpC); D.sprite(S.kx, S.ky, .22, 0, tmpC.r, tmpC.g, tmpC.b, 1.3 * CFG.punch, 0, 0, 1, 1); }
    for (let k = 0; k < 2; k++) { const [x, y] = this.swim(S, k); palJS(A.hue + .4 + k * .2, tmpC); D.sprite(x, y, .05, 0, tmpC.r, tmpC.g, tmpC.b, .12 * A.midA, 0, 0, 1, 1); }
  }
});

PRESETS.push({
  name: 'Pool Floor', accent: '#22d3ee', sim: WAVE_SIM('1.7', '.996'), simSteps: 3,
  warp: `vec3 warp(vec2 p){ vec2 q=p*(1.-.006-.012*kick); vec3 c=mix(P(q), B(q), .1); return hueRot(c,.01)*DK(.955); }`,
  comp: WATER_LIB + `
  vec3 tile(vec2 q){
    vec2 g=q*5.5, id=floor(g), f=fract(g);
    float grout=smoothstep(0.,.045,min(min(f.x,1.-f.x),min(f.y,1.-f.y))), v=hash(id);
    vec3 c=mix(vec3(.02,.30,.42), vec3(.05,.55,.62), v);
    c=mix(c, vec3(.03,.18,.38), step(.82,v));
    return mix(vec3(.02,.10,.16), c, grout)*(.9+.1*hash(id+7.)); }
  vec3 comp(vec2 p){
    vec3 n=wn(p,7.);
    vec2 q=p+n.xy*.16;
    vec3 c=tile(q)*.7+P(q)*.8+glow(q)*.4;                            // tiles, plus light the music paints on the floor
    float l1=wlap(p), l2=wlap(p+n.xy*.03);
    vec3 cs=vec3(pow(max(0.,1.-l1*9.),4.), pow(max(0.,1.-(l1+l2)*4.5),4.), pow(max(0.,1.-l2*9.),4.));
    c*=.5+.55*min(cs,vec3(6.))*(.7+.3*bassA);                        // caustics: the ripples focus the light
    c+=vec3(1.)*pow(max(dot(reflect(rd,wn(p,14.)),normalize(vec3(.2,.35,.9))),0.),70.)*.6;
    return c*vig(p); }`,
  simDraw(S, dt) {
    const asp = D.aspect;
    if (A.onKick) { S.side = -(S.side || 1); for (let i = 0; i < 9; i++) drop(S.side * asp * .98, -1 + i * .25, (-.55 - .15 * A.bass) * CFG.punch, .09); drop(rnd(-.4, .4) * asp, rnd(-.4, .4), -1.2 * CFG.punch, .09); }
    for (let i = Math.floor(A.trebA * 1.4 * Math.random() + (A.onBeat ? 2 : 0)); i > 0; i--) drop(rnd(-1, 1) * asp, rnd(-1, 1), .4, .026);
    const a = S.mt * .3; drop(Math.cos(a) * asp * .5, Math.sin(a * 1.3) * .5, .08 * A.midA, .04);
  },
  draw(S) {
    const R = .16 + .05 * A.bassA + .08 * A.kick;
    D.line(220, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU + S.mt * .2, r = R + w * (.05 + .07 * A.midA); p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; palJS(A.hue + .1 + u * .2, p, 1); }, { w: .012, closed: true, gain: .5, core: .5 });
  }
});

PRESETS.push({
  name: 'Quicksilver', accent: '#d4d4f8', cam: 1.25, sim: WAVE_SIM('1.8', '.990'), simSteps: 3,
  warp: `vec3 warp(vec2 p){ vec3 c=mix(P(p*1.01), B(p*1.01), .3); return c*DK(.94); }`,
  comp: WATER_LIB + ENV_LIB + `
  vec3 comp(vec2 p){
    vec3 n=wn(p,11.), r=reflect(rd,n);
    float fres=pow(1.-max(dot(-rd,n),0.),4.);
    vec3 c=env(r)*(1.+.3*fres)*vec3(.92,.95,1.);
    c+=P(p+n.xy*.1)*.45+glow(p)*.3;                                  // coloured light caught in the surface
    c*=.9-.25*clamp(X(p).r,-1.,1.);
    return c*vig(p); }`,
  src(S, i) { const a = i / 6 * TAU + S.mt * .05; return [Math.cos(a) * .62 * Math.min(1.5, D.aspect), Math.sin(a) * .62]; },
  // Six speakers under the surface, each humming at its own pitch as loud as its slice of the spectrum.
  simDraw(S, dt) {
    for (let i = 0; i < 6; i++) { const [x, y] = this.src(S, i), lv = sampleSpec(.05 + i * .15); drop(x, y, .26 * lv * Math.sin(S.t * TAU * (2.2 + i * .9)), .055); }
    if (A.onKick) drop(0, 0, (-1.5 - .4 * A.bass) * CFG.punch, .14);
  },
  draw(S) {
    for (let i = 0; i < 6; i++) { const [x, y] = this.src(S, i), lv = sampleSpec(.05 + i * .15); palJS(A.hue + i * .12, tmpC); D.sprite(x, y, .07, 0, tmpC.r, tmpC.g, tmpC.b, .3 * lv, 0, 0, 1, 1); }
    if (A.onKick) { palJS(A.hue + .5, tmpC); D.sprite(0, 0, .2, 0, tmpC.r, tmpC.g, tmpC.b, .5 * CFG.punch, 0, 0, 1, 1); }
  }
});

PRESETS.push({
  name: 'Gel Orbit', accent: '#fb7185', fit: false,
  warp: `vec3 warp(vec2 p){ vec2 q=rot(.004)*p*(1.012+.02*kick); vec3 c=mix(P(q), B(q), .12); return hueRot(c,.006)*DK(.965); }`,
  // Real 3D: blobs of gel marched ray by ray, with the camera orbiting them. The 2D picture is the light behind them.
  comp: `#define SELF
  ` + ENV_LIB + `
  const int NB=5;
  vec3 bp[NB]; float br[NB];
  void place(){ for(int i=0;i<NB;i++){ float f=float(i), a=mt*(.35+.07*f)+f*2.4+bstep*.12, b=mt*(.27+.05*f)+f*1.7;
      float lv=i<2?bassA:(i<4?midA:trebA), rad=(.75+.25*sin(f*3.1))*(.6+.45*sin(b*.9+f));
      bp[i]=vec3(cos(a)*rad*1.45, sin(a*.8+f)*rad*.9, sin(b)*.7)*(1.+.3*kick);
      br[i]=(i<2?.46:(i<4?.36:.27))*(.55+.42*lv); } }
  float smin(float a, float b, float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
  float map(vec3 q){ float d=9.; for(int i=0;i<NB;i++) d=smin(d, length(q-bp[i])-br[i], .5); return d; }
  vec3 comp(vec2 p){
    place();
    float cy=cos(cam.x*2.2+mt*.08), sy=sin(cam.x*2.2+mt*.08), cp=cos(cam.y*1.6), sn=sin(cam.y*1.6);
    mat3 R=mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy)*mat3(1.,0.,0., 0.,cp,sn, 0.,-sn,cp);
    vec3 o3=R*vec3(0.,0.,2.6*cam.w), d3=R*normalize(vec3(rot(cam.z)*sp,-FOC));
    vec3 back=P(sp)*.8+glow(sp)*.7+vec3(.012,.010,.03)*(1.6-length(sp)*.5);
    float bq=dot(o3,d3), disc=bq*bq-dot(o3,o3)+2.7*2.7;          // skip rays that miss the whole cluster
    if(disc<0.) return back*vig(p);
    float tt=max(-bq-sqrt(disc),0.), d=1.;
    for(int i=0;i<30;i++){ d=map(o3+d3*tt); if(d<.004||tt>7.) break; tt+=d; }
    if(d>.03) return back*vig(p);
    vec3 q=o3+d3*tt; vec2 e=vec2(.01,-.01);
    vec3 n=normalize(e.xyy*map(q+e.xyy)+e.yyx*map(q+e.yyx)+e.yxy*map(q+e.yxy)+e.xxx*map(q+e.xxx));
    vec3 tint=vec3(0.); float ws=0.;
    for(int i=0;i<NB;i++){ float w=exp(-7.*max(length(q-bp[i])-br[i],0.)); tint+=pal(hue+float(i)*.13)*w; ws+=w; }
    tint/=ws+1e-4;
    vec3 vn=transpose(R)*n;                                       // normal as the screen sees it
    float ndv=max(dot(n,-d3),0.), fres=pow(1.-ndv,3.);
    vec3 through=(P(sp+vn.xy*.28)*1.5+glow(sp+vn.xy*.2))*(.35+tint*1.1);   // the backdrop, bent and tinted by the gel
    vec3 c=through+tint*(.10+.30*(1.-ndv))+env(transpose(R)*reflect(d3,n))*(.25+.75*fres);
    c+=pow(max(dot(reflect(d3,n),normalize(R*vec3(.4,.6,.7))),0.),50.)*1.2;
    return mix(back, c, smoothstep(.03,.0,d))*vig(p); }`,
  draw(S) {
    const R = .62 + .06 * A.bassA;
    D.line(260, (i, u, p) => { const w = sampleWave(mirrorU(u)), a = u * TAU + S.mt * .15, r = R + w * (.08 + .1 * A.midA); p.x = Math.cos(a) * r * 1.3; p.y = Math.sin(a) * r; palJS(A.hue + u * .4, p, 1); }, { w: .014 + .01 * A.kick, closed: true, gain: .55 });
    for (let k = 0; k < 3; k++) { const a = S.mt * (.3 + .1 * k) + k * 2.1; palJS(A.hue + .5 + k * .15, tmpC); D.sprite(Math.cos(a) * D.aspect * .6, Math.sin(a * 1.3) * .6, .12 + .08 * [A.bassA, A.midA, A.trebA][k], 0, tmpC.r, tmpC.g, tmpC.b, .10 + .12 * [A.bassA, A.midA, A.trebA][k], 0, 0, 1, 1); }
  }
});
