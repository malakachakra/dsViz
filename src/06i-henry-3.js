// ---------- Henry 3 ----------
// The painting melts. It is printed into the fluid solver and holds there for a while, barely moving. Then it lets
// go: the paint runs down on bass, bursts out of the eye on a kick, big eddies wander over the screen on mids,
// treble spatters it, and the whole picture slowly swells outward from the eye until the screen is running
// paint from edge to edge. On a cue (a swing, a 32-beat line, or the timer) the painting snaps back whole in the
// middle of the mess, holds, and melts again. The eye keeps its googly rattle and its blinks throughout.
PRESETS.push({
  name: 'Henry 3', accent: '#ffa94d', cam: .7, fluid: { vort: 9, damp: .6 },
  warp: HENRY_LIB + `
  vec3 warp(vec2 p){
    float stamp=u1.y, z=u1.z, swell=z<1.?z:0.;
    vec2 q=p-V(p)*dt;                                                     // the paint rides the fluid
    q=EC+(q-EC)*(1.-(.002+.004*kick)*swell);                              // and, once let go, swells out from the eye to fill the screen
    vec3 c=mix(P(q), B(q), .003);
    vec4 d=design(p);
    c=mix(c, d.rgb*1.15, d.a*stamp);                                      // the painting prints itself in: whole at a snap, a little every frame while it holds
    return c*DK(.9997)/(1.+.004*lum(c)); }`,
  comp: HENRY_LIB + `
  vec3 comp(vec2 p){
    float z=u1.z, vis=z>=1.?z-1.:0.;
    vec2 e=vec2(.012,0.);
    vec2 g=vec2(lum(B(p+e.xy))-lum(B(p-e.xy)), lum(B(p+e.yx))-lum(B(p-e.yx)));
    vec3 paint=pow(max(P(p),0.),vec3(.8)); paint=max(mix(vec3(lum(paint)), paint, 1.35), 0.);   // thin paint is lifted and kept vivid where colours have mixed
    paint*=clamp(1.+dot(g,vec2(-.6,.7))*4., .5, 1.6);                                            // side light gives it body
    vec3 c=paint*1.1+glow(p)*.5+vec3(.006,.004,.012);
    vec4 d=design(p);
    c=mix(c, d.rgb*(1.05+.15*beat), d.a*vis);                              // the crisp painting shows at the snap
    return c*vig(p); }`,
  init(S) { henryInit(S); henryArcInit(S); S.snap = 1; S.vis = 1; S.flash = 1; },
  update(S, dt) {
    henryEye(S, dt);
    if (henryArc(S, dt)) { S.snap = 1; S.vis = 1; S.flash = 1; }
    S.snap *= Math.max(0, 1 - dt * 10); S.vis *= Math.max(0, 1 - dt * 2.5);
    // the swell is strongest in the first seconds after letting go and tapers off, so the paint fills the screen and then stays
    const swell = (1 - S.form) * (.15 + .85 * Math.max(0, 1 - Math.max(0, S.arcT - 2) / 10));
    // u1.z carries the snap's crisp overlay (1..2) while it lasts, and the swell (0..1) the rest of the time; they never overlap
    S.u1[1] = Math.min(1, S.snap + .08 * S.form * S.form); S.u1[2] = S.vis > .01 ? 1 + S.vis : swell;
  },
  force(S, dt) {
    const chaos = 1 - S.form, asp = D.aspect, mid = Math.min(2, A.midA), bass = Math.min(2, A.bassA);
    // while it holds, only a tremor; once it has let go, the whole screen is stirred
    const down = (.04 + .08 * bass) * dt * (.25 + 1.25 * chaos);                                            // melting runs downhill, harder on bass
    for (let j = 0; j < 5; j++) { const x = (j - 2) * .42, y = -.4 + .3 * Math.sin(S.mt * .4 + j * 1.9); F.splat(x, y, (Math.random() - .5) * .3 * down, -down, .22); }
    if (A.onKick) F.burst(0, -.12, (.3 + .15 * A.bass) * (1 + chaos), .14, 10);
    const sw = (.04 + .25 * mid) * dt;
    F.swirl(0, .55, sw * (.5 + chaos), .25); F.swirl(-.6, -.55, -sw * (.5 + chaos), .25); F.swirl(.6, -.55, sw * (.5 + chaos), .25);   // the painting's corners
    for (let k = 0; k < 3; k++) {                                                                               // gone: three big eddies wander over the whole screen
      const a = S.mt * (.17 + .05 * k) + k * 2.1, x = Math.sin(a) * asp * .75, y = Math.cos(a * 1.3 + k) * .7;
      F.swirl(x, y, (k % 2 ? -1 : 1) * sw * 3 * chaos, .45);
    }
    for (let i = Math.floor(A.trebA * 1.5 * Math.random()); i > 0; i--) { const a = rnd(0, TAU); F.splat(rnd(-1, 1) * asp, rnd(-1, 1), Math.cos(a) * .1, Math.sin(a) * .1, .06); }
  },
  draw(S) {
    if (S.flash > .03) { D.sprite(0, -.12, .2 + .35 * (1 - S.flash), 0, 1, .9, .7, .45 * S.flash, 0, .05, .06, 0); S.flash *= .86; }   // a ring of light marks the snap
    for (let i = Math.floor(A.trebA * Math.random() * 1.5); i > 0; i--) {                             // sparks off the border
      const u = Math.random(), side = Math.floor(Math.random() * 3), ax = [0, -1.02, 1.02][side], ay = [.93, -.82, -.82][side], bx = [-1.02, 1.02, 0][side], by = [-.82, -.82, .93][side];
      palJS(A.hue + rnd(0, .3), tmpC); D.sprite(ax + (bx - ax) * u, ay + (by - ay) * u, rnd(.015, .035), 0, tmpC.r, tmpC.g, tmpC.b, .8, 0, 0, .9, 1);
    }
  }
});
