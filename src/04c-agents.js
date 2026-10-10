// ---------- Agents: many small things that move on their own, simulated on the GPU ----------
// Each agent is one texel of a float texture: x, y, heading, and a fourth number the scene uses as it likes.
// Every frame a scene's update shader moves each agent, reading the low-res buffer as a field (trails, crowd density);
// then the agents are drawn as points back into that field, and into the picture. A scene asks for them with
//   agents: { n, update, deposit, draw, seed }
// update:  GLSL `vec4 agent(vec4 s, vec2 id)` returning the new state (id is the agent's own texel, handy as a random seed).
// deposit: GLSL `void place(vec4 s, out vec2 p, out vec3 col, out float size)` for what each agent leaves in the field (size in field pixels).
// draw:    the same, for what it draws into the picture (size in pixels at 1080p); leave it out to draw nothing.
// seed(i, arr, o, aspect): fills arr[o..o+3] with the starting state of agent i; the default scatters them over the screen.
const AGENTS = (() => {
  if (!gl) return null;
  const ok = !!gl.getExtension('EXT_color_buffer_float');       // 32-bit float targets: half floats are too coarse to hold a position
  const VH = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
` + LIB + `uniform ivec2 agSize; uniform float ptScale, agFade; out vec4 vc;
void main(){ int id=gl_VertexID; vec4 s=texelFetch(agentT, ivec2(id%agSize.x, id/agSize.x), 0);
  vec2 ps; vec3 col; float sz; place(s, ps, col, sz);
  gl_Position=vec4(ps/vec2(aspect,1.),0.,1.); gl_PointSize=max(sz*ptScale,1.); vc=vec4(col*agFade,1.); }`;
  const PF = `#version 300 es
precision highp float; in vec4 vc; out vec4 o;
void main(){ vec2 q=gl_PointCoord*2.-1.; float d=dot(q,q); if(d>1.) discard; o=vec4(vc.rgb*(1.-d*.6),1.); }`;
  const UPD = `void main(){ vec4 s=texture(agentT, uv); o=agent(s, uv); }`;
  const vao = gl.createVertexArray();
  function ftarget(w, h) {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  function setup(P) {           // compile once per scene
    const a = P.agents, w = Math.ceil(Math.sqrt(a.n)), h = Math.ceil(a.n / w);
    P.ag = { w, h, n: w * h, a: null, b: null, upd: program(VERT, HEAD + a.update + UPD),
      dep: program(VH.replace('void main', a.deposit + '\nvoid main'), PF),
      drw: a.draw ? program(VH.replace('void main', a.draw + '\nvoid main'), PF) : null };
  }
  function seed(S, asp) {       // fresh agents each time the scene starts
    const P = S.P, g = P.ag;
    if (!g.a) { g.a = ftarget(g.w, g.h); g.b = ftarget(g.w, g.h); }
    const arr = new Float32Array(g.n * 4), f = P.agents.seed;
    for (let i = 0; i < g.n; i++) { const o = i * 4; if (f) f(i, arr, o, asp); else { arr[o] = (Math.random() * 2 - 1) * asp; arr[o + 1] = Math.random() * 2 - 1; arr[o + 2] = Math.random() * 6.2831853; arr[o + 3] = Math.random(); } }
    gl.bindTexture(gl.TEXTURE_2D, g.a.tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, g.w, g.h, gl.RGBA, gl.FLOAT, arr);
    S.agSeeded = true;
  }
  function points(prog, S, fade, scale, fb, w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    useScene(prog, S, fbA.tex, bloom[1].tex);
    gl.uniform2i(prog.u.agSize, S.P.ag.w, S.P.ag.h); gl.uniform1f(prog.u.ptScale, scale); gl.uniform1f(prog.u.agFade, fade);
    gl.bindVertexArray(vao); gl.drawArrays(gl.POINTS, 0, S.P.ag.n); gl.bindVertexArray(null);
  }
  return {
    ok, setup,
    // Move every agent, then let them mark the field. Runs before the field's own simulation step.
    step(S, asp) {
      const g = S.P.ag; if (!S.agSeeded) seed(S, asp);
      gl.bindFramebuffer(gl.FRAMEBUFFER, g.b.fb); gl.viewport(0, 0, g.w, g.h); gl.disable(gl.BLEND);
      useScene(g.upd, S, fbA.tex, bloom[1].tex); tri();
      const t = g.a; g.a = g.b; g.b = t;
      points(g.dep, S, 1, 1, auxA.fb, auxA.w, auxA.h);
    },
    draw(S, fade) { if (S.P.ag.drw) points(S.P.ag.drw, S, fade, H / 1080, fbB.fb, W, H); }
  };
})();
