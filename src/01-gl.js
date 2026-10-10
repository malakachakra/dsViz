// ---------- WebGL2 plumbing ----------
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
const HDR = gl && (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));

const VERT = `#version 300 es
in vec2 pos; out vec2 uv;
void main(){ uv = pos*.5+.5; gl_Position = vec4(pos,0.,1.); }`;

// Shared by every warp and composite shader. p-space: y in [-1,1], x in [-aspect,aspect].
const HEAD = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 uv; out vec4 o;
uniform sampler2D prev, blur, aud;
uniform vec2 res; uniform float aspect;
uniform float t, mt, bass, mid, treb, bassA, midA, trebA, beat, kick, vol, hue, bstep;
uniform vec4 seed;
uniform sampler2D velT, auxT; uniform float dt, ax, fit; uniform vec4 cam;
uniform float spd, dkx; uniform int stage; uniform vec4 fly, look;
#define DK(x) pow(x, dkx)       // a per-frame fade, corrected for frame rate and the Trails setting
#define PI 3.14159265
#define TAU 6.2831853
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+17.; a*=.5; } return s; }
vec3 pal(float x){ return .5+.5*cos(TAU*(x+vec3(0.,.33,.67))); }
vec3 pal4(float x, vec3 a, vec3 b, vec3 c, vec3 d){ return a+b*cos(TAU*(c*x+d)); }
vec3 hueRot(vec3 c, float a){ const vec3 k=vec3(.57735); float ca=cos(a), sa=sin(a);
  return c*ca + cross(k,c)*sa + k*dot(k,c)*(1.-ca); }
float lum(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
float spec(float x){ return texture(aud, vec2(x,.25)).r; }
float wav(float x){ return texture(aud, vec2(x,.75)).r; }
vec2 toUv(vec2 p){ return p/vec2(aspect,1.)*.5+.5; }
vec3 P(vec2 p){ return texture(prev, toUv(p)).rgb; }
vec3 B(vec2 p){ return texture(blur, toUv(p)).rgb; }
vec2 V(vec2 p){ return texture(velT, toUv(p)).xy; }     // fluid velocity, p-units per second
vec4 X(vec2 p){ return texture(auxT, toUv(p)); }        // ripple buffer: r = height, g = its rate of change
`;
const WARP_MAIN = `
void main(){ vec2 p=(uv-.5)*2.*vec2(aspect,1.); vec3 c=warp(p);
  c = mix(c, vec3(lum(c)), smoothstep(3.,9.,lum(c))*.5);   // keep runaway highlights from clipping to flat colour
  o=vec4(clamp(c,0.,12.),1.); }`;
const SIM_MAIN = `
void main(){ vec2 p=(uv-.5)*2.*vec2(aspect,1.); o=clamp(sim(p),-20.,20.); }`;
const COMP_MAIN = `
vec3 tone(vec3 c){ c=max(c,0.); c=(c*(2.51*c+.03))/(c*(2.43*c+.59)+.14); return pow(clamp(c,0.,1.), vec3(.82)); }
void main(){
  sp=(uv-.5)*2.*vec2(aspect,1.);
  float cy=cos(cam.x), sy=sin(cam.x), cp=cos(cam.y), sn=sin(cam.y);
  mat3 R=mat3(cy,0.,-sy, 0.,1.,0., sy,0.,cy)*mat3(1.,0.,0., 0.,cp,sn, 0.,-sn,cp);
  vec2 p; vec3 extra=vec3(0.);
  if(stage==0){
    // Flat: the picture lies on the plane z=0 and the camera orbits its centre. cam=(0,0,0,1) is the identity.
    ro=R*vec3(0.,0.,FOC*cam.w); rd=R*normalize(vec3(rot(cam.z)*sp,-FOC));
    hitT=-ro.z/min(rd.z,-1e-3);
    p=(ro+rd*hitT).xy/fit;                                         // fit keeps a tilted view inside the picture
    vec2 ext=abs(p)/vec2(aspect,1.);
    camFade=smoothstep(-.02,-.3,rd.z)*(1.-smoothstep(1.0,1.45,max(ext.x,ext.y)));
  } else {
    // A real space: the picture is wrapped around us (mirrored where it repeats, so there are no seams).
    vec3 d=R*normalize(vec3(rot(cam.z)*sp,-1.2)); ro=vec3(0.,0.,1.);
    vec3 lightC=pal(hue+.6)*(.5+.3*bassA+.5*kick);
    if(stage==1){                 // tunnel: the picture is the wall of a tube we fly down
      vec3 o3=vec3(.28*sin(fly.z*.7), .28*sin(fly.z*.9+1.), 0.);
      float a2=dot(d.xy,d.xy), b2=dot(o3.xy,d.xy), c2=dot(o3.xy,o3.xy)-1.;
      hitT=(-b2+sqrt(max(b2*b2-a2*c2,0.)))/max(a2,1e-4);
      vec3 h=o3+d*hitT; vec2 rr=normalize(h.xy);
      p=vec2(atan(h.y,h.x)/PI*2.*aspect, h.z*1.1-fly.y);
      rd=normalize(vec3(dot(d.xy,vec2(-rr.y,rr.x)), d.z, -abs(dot(d.xy,rr))-.05));
      camFade=exp(-hitT*.15);
      extra=lightC*exp(-a2*30.)*.8;                                // light at the far end
    } else if(stage==2){          // dome: we stand inside the picture and look around
      float el=asin(clamp(d.y,-1.,1.));
      p=vec2(atan(d.x,-d.z), el)*4.*aspect/PI;                      // four mirrored copies around, so it closes without a seam
      hitT=2.; rd=vec3(0.,0.,-1.);
      camFade=smoothstep(1.5,1.1,abs(el));
    } else {                      // floor: the picture is the ground we fly over, with a dim copy overhead
      vec3 o3=vec3(fly.x, .5, fly.y);
      hitT=d.y<0. ? o3.y/-d.y : 1.5/max(d.y,1e-4);
      vec3 h=o3+d*hitT;
      p=vec2(h.x,-h.z)*.8;
      rd=normalize(vec3(d.x,-d.z,-abs(d.y)-.05));
      camFade=exp(-hitT*.14)*(d.y<0. ? 1. : .35);
      extra=lightC*exp(-abs(d.y)*16.)*.45;                         // glow along the horizon
    }
  }
  vec3 c=comp(p);
#ifndef RAW
  c=tone(c);
#endif
#ifndef SELF
  c=c*camFade+extra;
#endif
  c=hueRot(c, look.z*TAU); c=mix(vec3(lum(c)), c, look.y)*look.x;   // Colour shift, Saturation, Brightness
  c += (hash(uv*res + fract(t)*91.7)-.5)/255.*1.5;   // dither out banding
  o=vec4(c,1.); }`;

const BLUR_DOWN = HEAD + `uniform vec2 px;
void main(){ vec3 c=texture(prev,uv).rgb*4.;
  c+=texture(prev,uv+px*vec2(1,1)).rgb+texture(prev,uv+px*vec2(-1,1)).rgb+texture(prev,uv+px*vec2(1,-1)).rgb+texture(prev,uv+px*vec2(-1,-1)).rgb;
  o=vec4(c/8.,1.); }`;
const BLUR_UP = HEAD + `uniform vec2 px;
void main(){ vec3 c=(texture(prev,uv+px*vec2(2,0)).rgb+texture(prev,uv+px*vec2(-2,0)).rgb+texture(prev,uv+px*vec2(0,2)).rgb+texture(prev,uv+px*vec2(0,-2)).rgb);
  c+=(texture(prev,uv+px*vec2(1,1)).rgb+texture(prev,uv+px*vec2(-1,1)).rgb+texture(prev,uv+px*vec2(1,-1)).rgb+texture(prev,uv+px*vec2(-1,-1)).rgb)*2.;
  o=vec4(c/12.,.5); }`;

function compile(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error(log + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    throw new Error('Shader compile failed: ' + log);
  }
  return s;
}
function program(vs, fs, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  if (attribs) attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); else gl.bindAttribLocation(p, 0, 'pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link failed: ' + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

function target(w, h, wrap) {
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  if (HDR) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fb, w, h };
}
function freeTarget(tg) { if (tg) { gl.deleteTexture(tg.tex); gl.deleteFramebuffer(tg.fb); } }

// Fullscreen triangle
const triVao = gl && gl.createVertexArray();
if (gl) {
  gl.bindVertexArray(triVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
}
function tri() { gl.bindVertexArray(triVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }

// Audio texture: row 0 = spectrum (512 log-spaced bins, 0..1), row 1 = waveform (512 samples, -1..1)
const audTex = gl && gl.createTexture();
const audData = new Float32Array(512 * 2);
if (gl) {
  gl.bindTexture(gl.TEXTURE_2D, audTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 512, 2, 0, gl.RED, gl.FLOAT, audData);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
