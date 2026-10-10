// ---------- Henry ----------
// A painting rebuilt in shader: a triangle with a purple border, pink and yellow herringbone above, orange and
// yellow stripes below, an orange diamond holding an eye with a googly pupil, and rows of green, blue and dark
// green teeth around the diamond. Nothing here is the photo; every shape is drawn from scratch, so each part can
// move on its own: the stripes crawl, the pupil rattles around like a real googly eye, the lashes sway and flick
// on the beat, the lids blink, and as the song builds the triangle breathes, bends, and fills its corners with
// smaller Henrys.
// HENRY_GEOM holds the shapes and colours and is shared with Henry Deux and Henry 3; design() paints them.
const HENRY_GEOM = `
const vec2 AP=vec2(0.,.93); const float BY=-.82, HW=1.02, DW=.72, DH=.50;
const vec2 DC=vec2(0.,-.10), EC=vec2(0.,-.12);
const float EW=.51, EU=.165, EL=.175, GR=.17;                 // the eyeball's half-width and its heights above and below, the googly's radius
const vec3 PURPLE=vec3(.45,.10,.72), DKP=vec3(.16,.02,.18), PINK=vec3(1.,.33,.55), YEL=vec3(1.,.88,.15), ORG=vec3(.96,.52,.25), ORG2=vec3(1.,.40,.10),
  GRN=vec3(.50,.85,.38), BLU=vec3(.16,.47,.92), DKG=vec3(.08,.46,.34), TEAL=vec3(.15,.52,.68), WHT=vec3(.96), BLK=vec3(.02);
float triSD(vec2 p){ vec2 n=normalize(vec2(AP.y-BY, HW)); return max(dot(vec2(abs(p.x),p.y)-AP, n), BY-p.y); }
float almK(float xn){ return pow(max(1.-xn*xn,0.),.65); }
float alm(vec2 e, float w, float hu, float hl){                // 1 inside an almond: half-width w, height hu above, hl below
  float xn=e.x/w; if(abs(xn)>=1.) return 0.;
  float k=almK(xn); return (e.y<hu*k && e.y>-hl*k) ? 1. : 0.; }
float tooth(float s){ return 1.-abs(fract(s)*2.-1.); }
vec3 teethCol(float s){ float i=floor(s); return mod(i,7.)<.5?GRN:(mod(i,2.)<.5?DKG:BLU); }   // dark green and blue turn about, a light green one now and then
// The lashes: green strokes painted inside the eyeball, all hanging from its top edge and bending in toward the
// pupil; the outer three on the right sweep down along the lower edge. (x on the edge, bend direction, curve radius, length)
const vec4 LASH[12]=vec4[12](
  vec4(-.375,1.,.17,.07), vec4(-.324,1.,.17,.11), vec4(-.278,1.,.17,.15), vec4(-.231,1.,.17,.14), vec4(-.19,1.,.17,.10),
  vec4(.175,-1.,.17,.11), vec4(.237,-1.,.17,.12), vec4(.298,-1.,.17,.10), vec4(.35,-1.,.17,.08),
  vec4(.40,-1.,.13,.15), vec4(.45,-1.,.12,.14), vec4(.49,-1.,.11,.10));
float lash(vec2 e, vec2 a, float R, float ang, float dx, float sway){
  vec2 q=rot(sway)*(e-a)+a, d=q-(a+vec2(dx*R,0.));
  float t=atan(d.y,d.x), ph=dx>0. ? PI+t : -t, s=ph/ang;             // how far down the stroke this angle sits
  if(s<0.||s>1.) return 0.;
  float w=.0095*(1.-.5*s);                                           // tapers toward the tip
  return smoothstep(w+.004, w-.001, abs(length(d)-R)); }
float lashes(vec2 e, float sw, float flick){                        // sw sways them slowly, flick stretches them on a beat
  float m=0.;
  for(int i=0;i<12;i++){ vec4 L=LASH[i]; vec2 a=vec2(L.x, EU*almK(L.x/EW)*.97);
    m=max(m, lash(e, a, L.z, L.w/L.z*(1.+.35*flick), L.y, .12*sin(sw+float(i)*1.7))); }
  return m; }
`;
const HENRY_LIB = HENRY_GEOM + `
// The whole design at point p. Returns colour and coverage (1 inside the triangle).
vec4 design(vec2 p){
  float sd=triSD(p); if(sd>.01) return vec4(0.);
  float cov=smoothstep(.01,-.004,sd);
  float gx=u0.x, gy=u0.y, pr=u0.z, blink=u0.w, swirl=u1.x, s1=u1.w, s2=u1.w*.7;
  vec3 c;
  // stripes: herringbone above the diamond's middle (chevrons pointing up at the tip, the two halves half a band apart), leaning stripes below
  if(p.y>DC.y){ float tt=((AP.y-p.y)-abs(p.x)*.75)*6.5+s1+step(0.,p.x)*.5; c=fract(tt)<.5?PINK:YEL;
    if(AP.y-p.y<.11) c=GRN;                                                                // the green tip
    if(p.y>DC.y+DH-.03 && p.y-(DC.y+DH)<.13-abs(p.x)*2.2) c=GRN; }                         // and the green leaf over the diamond
  else { float tt=(abs(p.x)+(p.y-BY)*.28)*5.5+s2; c=fract(tt)<.5?ORG2:YEL; }
  // the diamond, with its rows of teeth
  float dd=abs(p.x-DC.x)/DW+abs(p.y-DC.y)/DH-1.;
  if(dd<0.) c=ORG;
  else if(dd<.3){ float s=p.x*9.+(p.y>DC.y?.5:0.); if(dd<.3*tooth(s)) c=teethCol(s+1.); }
  // the eye, outside in (heights measured off the painting): a dark crease, a yellow strip with a line under it (upper lid
  // only), the pink lids, a green outline, the eyeball. A blink folds the lids down and squeezes the eyeball shut.
  vec2 e=p-EC; float op=1.-blink*.92, ld=1.-blink*.7;
  if(alm(e,.57,.345*ld,.283*ld)>0.){
    c=DKP;
    if(alm(e,.55,.333*ld,.267*ld)>0.) c=e.y>0.?YEL:PINK;
    if(alm(e,.53,.303*ld,.267*ld)>0.) c=e.y>0.?DKP:PINK;
    if(alm(e,.52,.288*ld,.267*ld)>0.) c=PINK;
    if(alm(e,EW+.015,(EU+.015)*op,(EL+.015)*op)>0.){
      c=GRN;
      if(alm(e,EW,EU*op,EL*op)>0.) c=mix(TEAL, GRN, lashes(e, swirl, beat));
      vec2 td=(e-vec2(-.46,0.))/vec2(.075,.045); float tdd=dot(td,td);                  // the tear duct, in the inner corner
      if(tdd<1.35) c=GRN; if(tdd<1.) c=YEL;
      float r=length(e);
      if(r<GR){                                                                           // the googly: a grey plastic rim round a white dome
        c=mix(vec3(.60,.61,.65), vec3(.93,.93,.95)*(.94+.06*smoothstep(.12,-.12,e.y-e.x*.4)), smoothstep(GR,GR-.018,r));
        vec2 g=e-vec2(gx,gy); float gr=length(g);
        c=mix(c, BLK, smoothstep(pr+.004,pr-.004,gr));
        c=mix(c, WHT, smoothstep(.022,.012,length(g-vec2(-.03,.032)))*.85); }
    }
  }
  if(e.y<-.1 && e.x<.15 && e.x>-.5){ float r2=alm(e,.60,.37*ld,.334*ld)-alm(e,.59,.36*ld,.319*ld); if(r2>0.) c=DKP; }   // a second, shorter crease under the lower lid
  // the border
  c=mix(c, PURPLE*(1.+.5*beat), smoothstep(-.075,-.06,sd));
  return vec4(c*.85,cov); }
`;

// The living parts every Henry shares: the googly pupil on its spring, the blinks, and the crawl of the stripes and lashes.
function henryInit(S) { S.gx = 0; S.gy = -.03; S.gvx = 0; S.gvy = 0; S.blink = 0; S.blinkT = 0; S.nextBlink = rnd(3, 7); S.s1 = 0; S.swirl = 0; }
function henryEye(S, dt) {
  // the googly pupil: a loose disc on a spring, kicked by every beat, falling back down between them
  if (A.onBeat) { const a = rnd(0, TAU), m = (.5 + .6 * Math.min(2, A.bass)) * CFG.punch; S.gvx += Math.cos(a) * m; S.gvy += Math.sin(a) * m; }
  S.gvx += (-12 * S.gx - 1.6 * S.gvx) * dt; S.gvy += (-12 * S.gy - 1.6 * S.gvy - .7) * dt;
  S.gx += S.gvx * dt; S.gy += S.gvy * dt;
  const pr = .095 * (1 + .3 * Math.min(1.5, A.kick)), lim = .165 - pr - .004, r = Math.hypot(S.gx, S.gy);
  if (r > lim) { const nx = S.gx / r, ny = S.gy / r; S.gx = nx * lim; S.gy = ny * lim; const vn = S.gvx * nx + S.gvy * ny; if (vn > 0) { S.gvx -= 1.7 * vn * nx; S.gvy -= 1.7 * vn * ny; } }
  // blinks: now and then, and whenever the song changes gear
  S.blinkT += dt;
  if (S.blink <= 0 && (S.blinkT > S.nextBlink || A.onSwing)) { S.blink = 1e-3; S.blinkT = 0; S.nextBlink = rnd(4, 11); }
  if (S.blink > 0) { S.blink += dt * 7; if (S.blink >= 2) S.blink = 0; }
  const bl = S.blink > 0 ? 1 - Math.abs(S.blink - 1) : 0;
  S.s1 += dt * (.25 + .5 * Math.min(2, A.midA)) * CFG.speed; S.swirl += dt * (.3 + 1.2 * Math.max(0, A.bassA - .6)) * CFG.speed;
  S.u0[0] = S.gx; S.u0[1] = S.gy; S.u0[2] = pr; S.u0[3] = bl;
  S.u1[0] = S.swirl; S.u1[3] = S.s1;
}
// The long arc Henry Deux and Henry 3 share: whole as Henry for a while, then let go into pure visualizer for a
// good while, then back on a cue (a swing, a 32-beat line, or the timer). S.form runs from 1 (whole) to 0 (gone).
// Returns true on the frame it comes back.
function henryArcInit(S) { S.form = 1; S.want = 1; S.arcT = 0; S.holdT = rnd(6, 11); S.roamT = rnd(22, 40); }
function henryArc(S, dt) {
  S.arcT += dt; let back = false;
  if (S.want === 1 && S.arcT > S.holdT) { S.want = 0; S.arcT = 0; S.roamT = rnd(22, 40); }
  else if (S.want === 0 && (S.arcT > S.roamT || (S.arcT > 10 && A.onSwing) || (S.arcT > 14 && A.onBeat && A.beats % 32 === 0))) { S.want = 1; S.arcT = 0; S.holdT = rnd(6, 11); back = true; }
  S.form += (S.want - S.form) * Math.min(1, dt * (S.want ? 1.6 : .35));
  return back;
}

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
  init(S) { henryInit(S); S.trip = 0; S.nest = 0; },
  update(S, dt) {
    henryEye(S, dt);
    // how far gone it is: builds with the energy of the song over the first half minute, settles back in quiet parts
    const want = Math.min(1, .08 + .5 * Math.min(1.5, A.energy) + .25 * A.kick) * Math.min(1, S.t / 25);
    S.trip += (want - S.trip) * Math.min(1, dt * .6);
    const nw = (A.beats % 32 >= 16 && S.trip > .35) ? 1 : 0; S.nest += (nw - S.nest) * Math.min(1, dt * .9);
    S.u1[1] = S.trip; S.u1[2] = S.nest;
  },
  draw(S) {
    if (A.onKick) D.sprite(0, -.12, .185, 0, 1, .95, .9, .5 * CFG.punch, 0, .06, .05, 0);         // a ring of light off the eye
    for (let i = Math.floor(A.trebA * Math.random() * 1.5); i > 0; i--) {                             // sparks off the border
      const u = Math.random(), side = Math.floor(Math.random() * 3), ax = [0, -1.02, 1.02][side], ay = [.93, -.82, -.82][side], bx = [-1.02, 1.02, 0][side], by = [-.82, -.82, .93][side];
      palJS(A.hue + rnd(0, .3), tmpC); D.sprite(ax + (bx - ax) * u, ay + (by - ay) * u, rnd(.015, .035), 0, tmpC.r, tmpC.g, tmpC.b, .8, 0, 0, .9, 1);
    }
  }
});
