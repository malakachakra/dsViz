// ---------- Henry ----------
// A painting rebuilt in shader: a triangle with a purple border, pink and yellow herringbone above, orange and
// yellow stripes below, an orange diamond holding an eye with a googly pupil, and rows of green, blue and dark
// green teeth around the diamond. Nothing here is the photo; every shape is drawn from scratch, so each part can
// move on its own: the stripes crawl, the pupil rattles around like a real googly eye, the iris swirls on bass,
// the lids blink, and as the song builds the triangle breathes, bends, and fills its corners with smaller Henrys.
const HENRY_LIB = `
const vec2 AP=vec2(0.,.93); const float BY=-.82, HW=1.02, DW=.72, DH=.50;
const vec2 DC=vec2(0.,-.10), EC=vec2(0.,-.12);
const vec3 PURPLE=vec3(.45,.10,.72), PINK=vec3(1.,.33,.55), YEL=vec3(1.,.88,.15), ORG=vec3(.96,.52,.25), ORG2=vec3(1.,.40,.10),
  GRN=vec3(.50,.85,.38), BLU=vec3(.16,.47,.92), DKG=vec3(.08,.46,.34), TEAL=vec3(.15,.52,.68), WHT=vec3(.96), BLK=vec3(.02);
float triSD(vec2 p){ vec2 n=normalize(vec2(AP.y-BY, HW)); return max(dot(vec2(abs(p.x),p.y)-AP, n), BY-p.y); }
float alm(vec2 e, float w, float hu, float hl){                // 1 inside an almond: half-width w, height hu above, hl below
  float xn=e.x/w; if(abs(xn)>=1.) return 0.;
  float k=pow(1.-xn*xn,.65); return (e.y<hu*k && e.y>-hl*k) ? 1. : 0.; }
float tooth(float s){ return 1.-abs(fract(s)*2.-1.); }
vec3 teethCol(float s){ float i=mod(floor(s),3.); return i<.5?GRN:(i<1.5?BLU:DKG); }
// The whole design at point p. Returns colour and coverage (1 inside the triangle).
vec4 design(vec2 p){
  float sd=triSD(p); if(sd>.01) return vec4(0.);
  float cov=smoothstep(.01,-.004,sd);
  float gx=u0.x, gy=u0.y, pr=u0.z, blink=u0.w, swirl=u1.x, s1=u1.w, s2=u1.w*.7;
  vec3 c;
  // stripes: herringbone above the diamond's middle, leaning stripes below
  if(p.y>DC.y){ float tt=(abs(p.x)*.75+(AP.y-p.y))*7.+s1; c=fract(tt)<.5?PINK:YEL;
    if(abs(p.x)<.013) c=fract(tt*.5)<.5?GRN:PINK; }
  else { float tt=(abs(p.x)+(p.y-BY)*.28)*5.5+s2; c=fract(tt)<.5?ORG2:YEL; }
  // the diamond, with its rows of teeth
  float dd=abs(p.x-DC.x)/DW+abs(p.y-DC.y)/DH-1.;
  if(dd<0.) c=ORG;
  else if(dd<.2){ float s=p.x*5.+(p.y>DC.y?.5:0.); if(dd<.2*tooth(s)) c=teethCol(s); }
  // the eye
  vec2 e=p-EC; float op=1.-blink*.92;
  if(alm(e,.65,.32*op+.03,.29*op+.03)>0.){
    c=vec3(.12,.02,.14);
    if(alm(e,.62,.295*op+.02,.265*op+.02)>0.) c=YEL;
    if(alm(e,.59,.27*op+.01,.24*op+.01)>0.) c=PINK;
    if(alm(e,.51,.21*op,.19*op)>0.){
      float r=length(e), a=atan(e.y,e.x);
      c=TEAL;
      float streak=smoothstep(.55,.9,sin(a*9.+swirl+r*5.))*smoothstep(.16,.2,r)*smoothstep(.6,.3,r);
      c=mix(c, GRN, streak);
      vec2 td=(e-vec2(-.42,0.))/vec2(.08,.05); if(dot(td,td)<1.) c=YEL;      // the tear duct
      if(r<.15){ c=WHT*smoothstep(.15,.135,r)+vec3(.55)*(1.-smoothstep(.15,.135,r)); // the googly: a white disc with a grey rim
        vec2 g=e-vec2(gx,gy); float gr=length(g);
        c=mix(c, BLK, smoothstep(pr+.004,pr-.004,gr));
        c=mix(c, WHT, smoothstep(.02,.012,length(g-vec2(-.028,.03)))*.9); }
    }
  }
  // the border
  c=mix(c, PURPLE*(1.+.5*beat), smoothstep(-.075,-.06,sd));
  return vec4(c*.85,cov); }
`;

PRESETS.push({
  name: 'Henry', accent: '#ff5c8d', cam: .7,
  warp: HENRY_LIB + `
  vec3 warp(vec2 p){
    float trip=u1.y;
    float ex=.986-.022*kick-.005*(bassA-1.);
    vec2 q=rot(.003*sin(mt*.3)+.010*(midA-1.)*trip)*p*ex;
    q=mix(p,q,spd);
    vec3 c=mix(P(q), B(q), .08);
    vec4 d=design(p*(1.+.03*kick));
    c+=d.rgb*d.a*(.05+.08*kick);                                       // the painting keeps stamping itself into the trail
    return hueRot(c,.015+.03*trip)*DK(.95); }`,
  comp: HENRY_LIB + `
  vec2 sub(vec2 q, vec2 v){ return v+(q-v)*2.; }                        // the corner that holds a half-size Henry, mapped back to the full one
  vec4 nested(vec2 q, float n, out float found){
    found=0.; vec4 d=vec4(0.);
    vec2 vs[3]=vec2[3](AP, vec2(-HW,BY), vec2(HW,BY));
    for(int i=0;i<3;i++){ vec2 q2=sub(q, vs[i]); if(triSD(q2)<0.){ d=design(q2); found=1.; break; } }
    return d; }
  vec3 comp(vec2 p){
    float trip=u1.y, nest=u1.z;
    vec2 q=p*(1.+.025*sin(mt*.5)*trip)*(1.-.03*kick);
    q+=(vec2(fbm(p*1.8+vec2(mt*.15,seed.x*7.)), fbm(p*1.8+vec2(seed.y*7.,-mt*.12)))-.5)*.22*trip*smoothstep(.2,1.,trip);
    q=rot(.08*sin(mt*.21)*trip)*q;
    vec4 d=design(q);
    float f1, f2; vec4 d1=nested(q, nest, f1);
    float n1=smoothstep(.0,.5,nest)*f1;
    if(n1>0.){ vec2 vs[3]=vec2[3](AP, vec2(-HW,BY), vec2(HW,BY)); vec2 q1=q;
      for(int i=0;i<3;i++){ vec2 t=sub(q,vs[i]); if(triSD(t)<0.){ q1=t; break; } }
      vec4 d2=nested(q1, nest, f2); float n2=smoothstep(.5,1.,nest)*f2;
      d1=mix(d1, d2, n2); }
    d=mix(d, d1, n1);
    vec3 trails=P(p)*1.25+glow(p)*.9;
    vec3 c=mix(trails, d.rgb*(1.05+.15*beat), d.a);
    c=hueRot(c, .35*sin(mt*.37)*trip*trip);
    return c*vig(p); }`,
  init(S) { S.gx = 0; S.gy = -.03; S.gvx = 0; S.gvy = 0; S.blink = 0; S.blinkT = 0; S.nextBlink = rnd(3, 7); S.trip = 0; S.nest = 0; S.s1 = 0; S.swirl = 0; },
  update(S, dt) {
    // the googly pupil: a loose disc on a spring, kicked by every beat, falling back down between them
    if (A.onBeat) { const a = rnd(0, TAU), m = (.5 + .6 * Math.min(2, A.bass)) * CFG.punch; S.gvx += Math.cos(a) * m; S.gvy += Math.sin(a) * m; }
    S.gvx += (-12 * S.gx - 1.6 * S.gvx) * dt; S.gvy += (-12 * S.gy - 1.6 * S.gvy - .7) * dt;
    S.gx += S.gvx * dt; S.gy += S.gvy * dt;
    const pr = .085 * (1 + .3 * Math.min(1.5, A.kick)), lim = .15 - pr - .004, r = Math.hypot(S.gx, S.gy);
    if (r > lim) { const nx = S.gx / r, ny = S.gy / r; S.gx = nx * lim; S.gy = ny * lim; const vn = S.gvx * nx + S.gvy * ny; if (vn > 0) { S.gvx -= 1.7 * vn * nx; S.gvy -= 1.7 * vn * ny; } }
    // blinks: now and then, and whenever the song changes gear
    S.blinkT += dt;
    if (S.blink <= 0 && (S.blinkT > S.nextBlink || A.onSwing)) { S.blink = 1e-3; S.blinkT = 0; S.nextBlink = rnd(4, 11); }
    if (S.blink > 0) { S.blink += dt * 7; if (S.blink >= 2) S.blink = 0; }
    const bl = S.blink > 0 ? 1 - Math.abs(S.blink - 1) : 0;
    // how far gone it is: builds with the energy of the song over the first half minute, settles back in quiet parts
    const want = Math.min(1, .08 + .5 * Math.min(1.5, A.energy) + .25 * A.kick) * Math.min(1, S.t / 25);
    S.trip += (want - S.trip) * Math.min(1, dt * .6);
    const nw = (A.beats % 32 >= 16 && S.trip > .35) ? 1 : 0; S.nest += (nw - S.nest) * Math.min(1, dt * .9);
    S.s1 += dt * (.25 + .5 * Math.min(2, A.midA)) * CFG.speed; S.swirl += dt * (.3 + 1.2 * Math.max(0, A.bassA - .6)) * CFG.speed;
    S.u0[0] = S.gx; S.u0[1] = S.gy; S.u0[2] = pr; S.u0[3] = bl;
    S.u1[0] = S.swirl; S.u1[1] = S.trip; S.u1[2] = S.nest; S.u1[3] = S.s1;
  },
  draw(S) {
    if (A.onKick) D.sprite(0, -.12, .17, 0, 1, .95, .9, .5 * CFG.punch, 0, .06, .05, 0);          // a ring of light off the eye
    for (let i = Math.floor(A.trebA * Math.random() * 1.5); i > 0; i--) {                             // sparks off the border
      const u = Math.random(), side = Math.floor(Math.random() * 3), ax = [0, -1.02, 1.02][side], ay = [.93, -.82, -.82][side], bx = [-1.02, 1.02, 0][side], by = [-.82, -.82, .93][side];
      palJS(A.hue + rnd(0, .3), tmpC); D.sprite(ax + (bx - ax) * u, ay + (by - ay) * u, rnd(.015, .035), 0, tmpC.r, tmpC.g, tmpC.b, .8, 0, 0, .9, 1);
    }
  }
});
