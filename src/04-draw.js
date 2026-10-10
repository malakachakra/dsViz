// ---------- Additive geometry: glowing lines and soft shapes drawn into the feedback buffer ----------
const D = (() => {
  if (!gl) return null;
  const lineProg = program(`#version 300 es
in vec2 a; in vec2 nrm; in float side; in vec3 col;
uniform float aspect, width; out float s; out vec3 c;
void main(){ s=side; c=col; vec2 p=a+nrm*side*width; gl_Position=vec4(p/vec2(aspect,1.),0.,1.); }`, `#version 300 es
precision highp float; in float s; in vec3 c; out vec4 o; uniform float gain, core;
void main(){ float a=1.-abs(s); float g=a*a*(3.-2.*a); float k=g*g*.6 + core*smoothstep(.55,.95,a); o=vec4(c*gain*k, min(1.,gain*k)); }`, ['a', 'nrm', 'side', 'col']);
  const MAXV = 2600, lbuf = new Float32Array(MAXV * 2 * 8), lvao = gl.createVertexArray(), lvbo = gl.createBuffer();
  gl.bindVertexArray(lvao); gl.bindBuffer(gl.ARRAY_BUFFER, lvbo); gl.bufferData(gl.ARRAY_BUFFER, lbuf.byteLength, gl.DYNAMIC_DRAW);
  [[0, 2, 0], [1, 2, 8], [2, 1, 16], [3, 3, 20]].forEach(([i, n, off]) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, 32, off); });

  const sprProg = program(`#version 300 es
in vec2 corner; in vec4 xfm; in vec4 col; in vec4 shp;
uniform float aspect; out vec2 q; out vec4 c; out vec4 sh;
void main(){ q=corner; c=col; sh=shp; float cs=cos(xfm.w), sn=sin(xfm.w);
  vec2 p=xfm.xy + mat2(cs,sn,-sn,cs)*(corner*xfm.z); gl_Position=vec4(p/vec2(aspect,1.),0.,1.); }`, `#version 300 es
precision highp float; in vec2 q; in vec4 c; in vec4 sh; out vec4 o;
void main(){ float d=length(q);
  if(sh.x>2.5){ float seg=6.2831853/sh.x, a=atan(q.y,q.x); d=cos(floor(.5+a/seg)*seg-a)*d/cos(seg*.5); }
  float soft=max(sh.z,.02), v;
  if(sh.y>0.) v=smoothstep(sh.y+soft, sh.y, abs(d-(1.-sh.y-soft)));       // ring of half-thickness sh.y
  else v=smoothstep(1., 1.-soft, d);                                      // filled, soft edge
  v*=mix(1., exp(-d*d*3.), sh.w);                                         // optional hot centre
  o=vec4(c.rgb*c.a*v, min(1.,c.a*v)); }`, ['corner', 'xfm', 'col', 'shp']);
  const MAXS = 2048, sbuf = new Float32Array(MAXS * 12), svao = gl.createVertexArray(), sq = gl.createBuffer(), sinst = gl.createBuffer();
  gl.bindVertexArray(svao);
  gl.bindBuffer(gl.ARRAY_BUFFER, sq); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, sinst); gl.bufferData(gl.ARRAY_BUFFER, sbuf.byteLength, gl.DYNAMIC_DRAW);
  [[1, 0], [2, 16], [3, 32]].forEach(([i, off]) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, off); gl.vertexAttribDivisor(i, 1); });
  gl.bindVertexArray(null);

  let ns = 0, aspect = 1, fade = 1;
  const pt = { x: 0, y: 0, r: 1, g: 1, b: 1 }, px = new Float32Array(MAXV), py = new Float32Array(MAXV), pc = new Float32Array(MAXV * 3);
  const api = {
    aspect: 1,
    begin(asp, f) { aspect = api.aspect = asp; fade = f; ns = 0; },
    // n points from fn(i, u, pt), which fills pt.x/pt.y and pt.r/g/b. opts: w (half-width), gain, core, closed.
    line(n, fn, opts) {
      n = Math.min(n, MAXV - 1); const w = opts.w || .01, closed = !!opts.closed;
      for (let i = 0; i < n; i++) { fn(i, n > 1 ? i / (n - 1) : 0, pt); px[i] = pt.x; py[i] = pt.y; pc[i * 3] = pt.r; pc[i * 3 + 1] = pt.g; pc[i * 3 + 2] = pt.b; }
      let m = n; if (closed) { px[n] = px[0]; py[n] = py[0]; pc.copyWithin(n * 3, 0, 3); m = n + 1; }
      let o = 0;
      for (let i = 0; i < m; i++) {
        let a = i - 1, b = i + 1;
        if (closed) { if (a < 0) a = n - 1; if (b >= m) b = 1; } else { if (a < 0) a = 0; if (b >= m) b = m - 1; }
        let tx = px[b] - px[a], ty = py[b] - py[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        for (let sd = -1; sd <= 1; sd += 2) { lbuf[o++] = px[i]; lbuf[o++] = py[i]; lbuf[o++] = -ty; lbuf[o++] = tx; lbuf[o++] = sd; lbuf[o++] = pc[i * 3]; lbuf[o++] = pc[i * 3 + 1]; lbuf[o++] = pc[i * 3 + 2]; }
      }
      gl.useProgram(lineProg.p); gl.uniform1f(lineProg.u.aspect, aspect); gl.uniform1f(lineProg.u.width, w);
      gl.uniform1f(lineProg.u.gain, (opts.gain == null ? 1 : opts.gain) * fade); gl.uniform1f(lineProg.u.core, opts.core == null ? 1 : opts.core);
      gl.bindVertexArray(lvao); gl.bindBuffer(gl.ARRAY_BUFFER, lvbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, lbuf, 0, o);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, m * 2);
    },
    // sides: 0 = disc, 3+ = polygon. ring: 0 = filled, else half-thickness of an outline. soft: edge softness. hot: bright centre falloff.
    sprite(x, y, size, rotv, r, g, b, a, sides, ring, soft, hot) {
      if (ns >= MAXS) return; const o = ns++ * 12;
      sbuf[o] = x; sbuf[o + 1] = y; sbuf[o + 2] = size; sbuf[o + 3] = rotv || 0;
      sbuf[o + 4] = r; sbuf[o + 5] = g; sbuf[o + 6] = b; sbuf[o + 7] = (a == null ? 1 : a) * fade;
      sbuf[o + 8] = sides || 0; sbuf[o + 9] = ring || 0; sbuf[o + 10] = soft == null ? .5 : soft; sbuf[o + 11] = hot || 0;
    },
    end() {
      if (!ns) return;
      gl.useProgram(sprProg.p); gl.uniform1f(sprProg.u.aspect, aspect);
      gl.bindVertexArray(svao); gl.bindBuffer(gl.ARRAY_BUFFER, sinst); gl.bufferSubData(gl.ARRAY_BUFFER, 0, sbuf, 0, ns * 12);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, ns); ns = 0;
    }
  };
  return api;
})();

// Colour helpers for the JS side (match pal() in GLSL).
const palJS = (x, out, k) => { k = k == null ? 1 : k; out.r = (.5 + .5 * Math.cos(6.2831853 * x)) * k; out.g = (.5 + .5 * Math.cos(6.2831853 * (x + .33))) * k; out.b = (.5 + .5 * Math.cos(6.2831853 * (x + .67))) * k; return out; };
const tmpC = { r: 0, g: 0, b: 0 };
const sampleWave = u => { const x = u * 511, i = Math.floor(x), f = x - i; return A.wave[i] * (1 - f) + A.wave[Math.min(511, i + 1)] * f; };
const sampleSpec = u => { const x = Math.max(0, Math.min(1, u)) * 511, i = Math.floor(x), f = x - i; return A.spec[i] * (1 - f) + A.spec[Math.min(511, i + 1)] * f; };
