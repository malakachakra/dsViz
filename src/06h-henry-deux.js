// ---------- Henry Deux ----------
// Henry after dark. The same shapes as the painting (HENRY_GEOM), but traced as neon tubes over a near-black fill
// that lets the trails show through: a magenta border, an electric-blue diamond and teeth, violet lids, a cyan
// eyeball, acid-green lashes, and a pupil that is a black hole with an ember rim. The pupil does not rattle; it
// turns slowly toward whichever band is loudest and snaps there when the song changes gear. Kicks tear the trail
// into glitch rows and treble splits the colours apart.
// It begins whole, its ghosts sinking into the eye. After a while it lets go: the neon prints of itself push out
// past the edges, turn and ripple until the whole screen is the visualizer and Henry is only an echo in it. On a
// cue it comes back whole, and the screen drains into the eye again.
const DEUX_LIB = HENRY_GEOM + `
const vec3 MAG=vec3(1.,.12,.72), CYAN=vec3(.1,.95,1.), VIO=vec3(.62,.3,1.), EBLUE=vec3(.25,.5,1.), ACID=vec3(.5,1.,.25), EMBER=vec3(1.,.36,.08), NYEL=vec3(1.,.9,.3);
float almD(vec2 e, float w, float hu, float hl){                  // rough signed distance to an almond's edge (negative inside)
  float ax=abs(e.x); if(ax>=w) return length(vec2(ax-w, e.y));
  float xn=ax/w, k=almK(xn), h=e.y>0.?hu:hl, dk=1.3*xn*pow(max(1.-xn*xn,1e-3),-.35)*h/w;
  return (abs(e.y)-h*k)/sqrt(1.+dk*dk); }
float neon(float d, float w){ d=abs(d); return smoothstep(w, w*.35, d)+.45*exp(-d/(w*5.)); }   // a bright core and a soft halo
// The form at p: neon light in rgb, coverage of the triangle in a; fill is the dark tint under the trails inside each region.
vec4 wire(vec2 p, out vec3 fill){
  float sd=triSD(p); fill=vec3(0.);
  if(sd>.1) return vec4(0.);
  float cov=smoothstep(.01,-.004,sd);
  float gx=u0.x, gy=u0.y, pr=u0.z, blink=u0.w, sw=u1.x, s1=u1.w;
  vec3 c=MAG*neon(sd+.067,.012)*1.3;                                                        // the border
  float tt=p.y>DC.y ? ((AP.y-p.y)-abs(p.x)*.75)*6.5+s1+step(0.,p.x)*.5 : (abs(p.x)+(p.y-BY)*.28)*5.5+s1*.7;
  fill=(p.y>DC.y ? vec3(.06,.012,.08) : vec3(.07,.025,.03))*(.55+.45*step(.5,fract(tt)));     // the stripes, as faint bands
  float dd=abs(p.x-DC.x)/DW+abs(p.y-DC.y)/DH-1.;
  if(dd<0.) fill=vec3(.015,.02,.05);
  c+=EBLUE*neon(dd/2.43,.009)*.9;                                                            // the diamond
  if(dd>0.&&dd<.34){ float s=p.x*9.+(p.y>DC.y?.5:0.), te=.3*tooth(s); c+=EBLUE*neon((dd-te)/2.43,.007)*.7; }   // the teeth
  vec2 e=p-EC; float op=1.-blink*.92, ld=1.-blink*.7;
  float dc=almD(e,.57,.345*ld,.283*ld); if(dc<0.) fill=vec3(.035,.006,.045);
  c+=VIO*neon(dc,.008)*.8;                                                                   // the crease round the lids
  if(e.y>0.) c+=MAG*neon(almD(e,.53,.303*ld,.267*ld),.006)*.55;                              // the line under the yellow strip
  float db=almD(e,EW,EU*op,EL*op);
  if(db<0.){ fill=vec3(.01,.04,.05); c+=ACID*lashes(e,sw,beat)*1.3; }
  c+=CYAN*neon(db,.009)*1.2;                                                                 // the eyeball
  vec2 td=(e-vec2(-.46,0.))/vec2(.075,.045); c+=NYEL*neon((dot(td,td)-1.)*.04,.007)*.6*step(db,.02);   // the tear duct
  if(db<0.){
    vec2 g=e-vec2(gx,gy); float gr=length(g);
    c+=vec3(.4,.5,.65)*neon(gr-GR,.006)*.45;                                                 // the dome's rim, faint
    if(gr<pr) fill=vec3(0.);                                                                 // the pupil is a hole
    c+=EMBER*neon(gr-pr,.009)*(1.3+.6*beat)+EMBER*.03*smoothstep(pr,pr*.1,gr)*(.4+.6*beat); }
  return vec4(c,cov); }
`;

PRESETS.push({
  name: 'Henry Deux', accent: '#00f0ff', cam: .7,
  warp: DEUX_LIB + `
  vec3 warp(vec2 p){
    float form=u1.y, glitch=u1.z, chaos=1.-form;
    float row=floor(p.y*22.+seed.z*9.), tk=floor(t*14.);
    float jump=(hash(vec2(row,tk))-.5)*.3*glitch*step(.55,hash(vec2(row*1.7,tk+3.)));       // a kick tears the picture into rows that jump sideways
    vec2 q=p+vec2(jump,0.);
    // whole: the ghosts sink into the eye. Gone: everything pushes out past the edges and turns, with ripples running through it
    vec2 ctr=EC*form;
    float ex=mix(1.012+.02*kick, .982-.02*kick-.005*(bassA-1.), chaos);
    q=ctr+rot(mix(.004*sin(mt*.27), .012*sin(mt*.23)+.014*(midA-1.), chaos))*(q-ctr)*ex;
    q+=(vec2(fbm(p*2.2+vec2(mt*.2,seed.x*5.)), fbm(p*2.2+vec2(seed.y*5.,-mt*.17)))-.5)*(.004+.03*chaos);
    q=mix(p,q,spd);
    vec3 c=mix(P(q), B(q), mix(.06,.015,chaos));                                             // gone, the echoes stay sharp as they travel
    vec3 fill; vec4 w=wire(p, fill);
    c+=w.rgb*(.06+.12*kick)*(.3+.7*form);                                                   // the neon form prints into the trail, fainter once it has let go
    c*=1.-.7*form*smoothstep(u0.z+.03, u0.z, length(p-EC-u0.xy));                            // whole, the pupil swallows whatever sinks into it
    c=hueRot(c, .003+.004*chaos);
    return c*DK(mix(.955,.979,chaos)); }`,
  comp: DEUX_LIB + `
  vec3 comp(vec2 p){
    float form=u1.y, glitch=u1.z, chaos=1.-form;
    vec2 q=p*(1.-.02*kick);
    vec3 tr=ca(q, .005+.02*trebA*chaos+.04*glitch)*1.1+glow(q)*(.5+.6*form);                 // the trails, colours split by treble and glitches
    vec3 fill; vec4 w=wire(p, fill);
    vec3 c=mix(tr, tr*.3+fill, w.a*form);                                                   // whole, the fills dim the trail inside the form
    c+=w.rgb*(1.1+.2*beat)*form;                                                            // the crisp neon fades as it lets go, and returns with it
    c*=.88+.12*sin(p.y*res.y*1.2+t*2.5);                                                    // scanlines
    c+=vec3(.004,.006,.012);
    return c*vig(p); }`,
  init(S) { S.gx = 0; S.gy = 0; S.tx = 0; S.ty = 0; S.snap = 0; S.blink = 0; S.blinkT = 0; S.nextBlink = rnd(5, 12); S.blinkSpd = 2.5; S.glitch = 0; S.sw = 0; S.s1 = 0; S.mark = -1; henryArcInit(S); },
  update(S, dt) {
    if (henryArc(S, dt)) S.glitch = 1.5;                                                       // it comes back with a tear
    // the pupil looks toward the loudest band: bass to the left, mids ahead, treble to the right. It glides there, and snaps on a swing.
    const b = A.bassA, m = A.midA, tr = A.trebA, mx = Math.max(b, m, tr);
    if (A.onSwing || (A.onBeat && A.beats % 4 === 0 && A.beats !== S.mark)) { S.mark = A.beats; S.tx = (mx === b ? -1 : mx === tr ? 1 : 0) * .055 + rnd(-.01, .01); S.ty = rnd(-.045, .045); S.snap = A.onSwing ? 1 : 0; }
    const k = Math.min(1, dt * (S.snap ? 30 : 2.2)); S.gx += (S.tx - S.gx) * k; S.gy += (S.ty - S.gy) * k; S.snap *= Math.max(0, 1 - dt * 8);
    const pr = .08 + .045 * Math.min(2, A.bassA) * .5 + .02 * Math.min(1.5, A.kick);        // bass dilates it
    // blinks: slow and rare; a swing closes the shutter for longer
    S.blinkT += dt;
    if (S.blink <= 0 && (S.blinkT > S.nextBlink || A.onSwing)) { S.blink = 1e-3; S.blinkT = 0; S.nextBlink = rnd(6, 14); S.blinkSpd = A.onSwing ? 1.3 : 2.5; }
    if (S.blink > 0) { S.blink += dt * S.blinkSpd; if (S.blink >= 2) S.blink = 0; }
    const bl = S.blink > 0 ? 1 - Math.abs(S.blink - 1) : 0;
    if (A.onKick) S.glitch = Math.max(S.glitch, Math.min(1.5, CFG.punch)); S.glitch *= Math.max(0, 1 - dt * 7);
    S.sw += dt * (.15 + .35 * Math.min(2, A.midA)) * CFG.speed; S.s1 += dt * (.2 + .4 * Math.min(2, A.midA)) * CFG.speed;
    S.u0[0] = S.gx; S.u0[1] = S.gy; S.u0[2] = pr; S.u0[3] = bl;
    S.u1[0] = S.sw; S.u1[1] = S.form; S.u1[2] = S.glitch; S.u1[3] = S.s1;
  },
  draw(S) {
    // the waveform runs round the inside of the frame as a cyan thread, one side per band; once Henry has let go the
    // frame grows past the screen and turns, so the threads sweep across the whole picture
    const chaos = 1 - S.form, sc = 1 + 2.2 * chaos, ang = S.t * .12 * chaos, ca = Math.cos(ang), sa = Math.sin(ang), asp = D.aspect;
    const V = [[0, .93], [-1.02, -.82], [1.02, -.82]].map(([x, y]) => [(x * ca - y * sa) * sc, (x * sa + y * ca) * sc]), lv = [A.trebA, A.bassA, A.midA];
    for (let k = 0; k < 3; k++) {
      const [ax, ay] = V[k], [bx, by] = V[(k + 1) % 3], len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len, amp = (.018 + .03 * Math.min(2, lv[k])) * sc;
      D.line(130, (i, u, p) => { const w = sampleWave((u * .8 + k * .3) % 1), e = Math.sin(u * Math.PI), o = .1 + w * amp * e; p.x = ax + (bx - ax) * u + nx * o; p.y = ay + (by - ay) * u + ny * o; p.r = .15; p.g = .85; p.b = 1; }, { w: .004, gain: (.35 + .35 * Math.min(2, lv[k])) * (.3 + .7 * S.form), core: .8 });   // gone, the long trail does the work, so the threads ease off
    }
    // the spectrum stands in the stripes under the diamond, magenta; gone, it stands along the bottom of the screen
    const sx = Math.min(.86 * sc, asp * .98), sy = -.76 - .16 * chaos;
    D.line(160, (i, u, p) => { const s = sampleSpec(.03 + mirrorU(u) * .9), e = Math.sin(u * Math.PI); p.x = (u * 2 - 1) * sx; p.y = sy + s * .14 * (.4 + .6 * e) * (1 + 1.5 * chaos); p.r = 1; p.g = .15 + .5 * s; p.b = .7; }, { w: .005, gain: (.35 + .3 * A.midA) * (.5 + .5 * S.form), core: .6 });
    if (A.onKick) D.sprite(0, -.12, .2 + .5 * chaos, 0, 1, .4, .12, .6 * CFG.punch, 0, .05, .05, 0);      // an ember shock ring off the eye
    for (let i = Math.floor(A.trebA * Math.random() * 1.5); i > 0; i--) {                                 // sparks off the frame, cyan and magenta
      const u = Math.random(), side = Math.floor(Math.random() * 3), [ax, ay] = V[side], [bx, by] = V[(side + 1) % 3], mg = Math.random() < .5;
      D.sprite(ax + (bx - ax) * u, ay + (by - ay) * u, rnd(.012, .03), 0, mg ? 1 : .2, mg ? .2 : .9, 1, .8, 0, 0, .9, 1);
    }
  }
});
