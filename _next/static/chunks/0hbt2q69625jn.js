(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,611959,791057,393489,253067,963485,527926,703771,98842,732007,e=>{"use strict";e.s(["TILE_SIZE",0,256],791057),e.s(["MAX_CANVAS_DIMENSION",0,8192],393489);class t extends Error{}e.s(["BackendContextLostError",0,class extends t{constructor(e,t){super(`${e}: rendering context lost — ${t}`),this.name="BackendContextLostError"}},"BackendDisposedError",0,class extends t{constructor(e){super(`${e}: used after dispose()/destroy()`),this.name="BackendDisposedError"}},"BackendUnavailableError",0,t],253067);class r{cache=new Map;bySlice=new Map;nextSlice=0;usedBytes=0;budgetBytes;batchProtectedKeys=null;constructor(e=1/0){this.budgetBytes=e}key(e){return`${e.layerId}|${e.level}|${e.tileKey}`}touch(e){let t=this.cache.get(e);t&&(this.cache.delete(e),this.cache.set(e,t),this.batchProtectedKeys?.add(e))}beginBatch(){this.batchProtectedKeys=new Set}endBatch(){this.batchProtectedKeys=null}evictIfOverBudget(e){if(this.budgetBytes!==1/0)for(;this.usedBytes>this.budgetBytes&&this.cache.size>0;){let t;for(let r of this.cache.keys())if(r!==e&&!this.batchProtectedKeys?.has(r)){t=r;break}if(void 0===t)return;let r=this.cache.get(t);this.cache.delete(t),this.bySlice.delete(r.ref.slice),this.usedBytes-=r.tile.data.byteLength}}ensureTile(e,t,r,i,s){let a=this.key({layerId:e,level:t,tileKey:`${r},${i}`}),l=this.cache.get(a);if(l&&l.tile.rev===s.rev)return this.touch(a),this.evictIfOverBudget(),l.ref;l&&(this.usedBytes-=l.tile.data.byteLength,this.bySlice.delete(l.ref.slice));let o=l?{...l.ref,rev:s.rev}:{arrayIndex:0,slice:this.nextSlice++,rev:s.rev};return this.cache.delete(a),this.cache.set(a,{ref:o,tile:s}),this.bySlice.set(o.slice,a),this.usedBytes+=s.data.byteLength,this.batchProtectedKeys?.add(a),this.evictIfOverBudget(a),o}peekTile(e,t,r,i,s){let a=this.key({layerId:e,level:t,tileKey:`${r},${i}`}),l=this.cache.get(a);if(l&&l.tile.rev===s)return this.touch(a),this.evictIfOverBudget(),l.ref}releaseLayer(e){let t=`${e}|`;for(let[e,r]of this.cache)e.startsWith(t)&&(this.cache.delete(e),this.bySlice.delete(r.ref.slice),this.usedBytes-=r.tile.data.byteLength)}stats(){return{arrays:+(this.cache.size>0),usedSlices:this.cache.size,totalSlices:this.cache.size,budgetBytes:this.budgetBytes===1/0?256*this.cache.size*1024:this.budgetBytes}}findBySlice(e){let t=this.bySlice.get(e.slice),r=t?this.cache.get(t):void 0;if(!r||r.ref.arrayIndex!==e.arrayIndex)throw Error(`TileCache: no cached tile for slice ${e.arrayIndex}/${e.slice} — ensureTile must be called first`);return r.tile}clear(){this.cache.clear(),this.bySlice.clear(),this.usedBytes=0}}function i(e){switch(e.kind){case"image":return e.source;case"text":case"smart-object":case"fill":return e.raster;case"pip-video":return e.frame;case"adjustment":case"shape":return null}}e.s(["TileCache",0,r],963485),e.s(["pixelSourceOf",0,i],527926),e.i(802132);var s=e.i(559949);function a(e){return(0,s.isCustomBlendMode)(e)?null:(0,s.blendModeToGCO)(e)}function l(e,t,r,i){let s=t*r*4;if(e.length!==s)throw Error(`toBrowserImageData: buffer length ${e.length} does not match ${t}\xd7${r} RGBA (${s} bytes)`);if("u"<typeof ImageData)return{data:e,width:t,height:r,colorSpace:i??"srgb"};let a="u">typeof SharedArrayBuffer&&e.buffer instanceof SharedArrayBuffer?new Uint8ClampedArray(e):e;return i?new ImageData(a,t,r,{colorSpace:i}):new ImageData(a,t,r)}function o(e,t,r,i,a,l){let o=r*i*4;if(e.length!==o||t.length!==o)throw Error(`compositeCustomModeCpu: buffers must be ${o} bytes for ${r}\xd7${i} RGBA (base ${e.length}, fill ${t.length})`);return(0,s.compositeWithBlendMode)({data:e,width:r,height:i,colorSpace:"srgb"},{data:t,width:r,height:i,colorSpace:"srgb"},a,void 0,l).data}e.s(["blendModeToGCO",0,a],703771),e.s(["toBrowserImageData",0,l],98842),e.s(["compositeCustomModeCpu",0,o],732007);class n{capabilities;surface;ctx;colorSpace;tiles=new r;disposed=!1;scratch=null;scratchCtx=null;constructor(e){this.surface=e;const t=e.getContext("2d");if(!t)throw new c;this.ctx=t,this.colorSpace=("function"==typeof t.getContextAttributes?t.getContextAttributes().colorSpace:void 0)??"srgb",this.capabilities={kind:"canvas2d",maxTextureSize:8192,nonSeparableBlendInBackend:!0,supportedBlendModes:new Set(s.BLEND_MODES),colorLookup3d:!1}}ensureTile(e,t,r,i,s){return this.tiles.ensureTile(e,t,r,i,s)}releaseLayer(e){this.tiles.releaseLayer(e)}stats(){return this.tiles.stats()}destroy(){this.tiles.clear(),this.scratch=null,this.scratchCtx=null,this.disposed=!0}async dispose(){this.destroy()}beginTarget(e){this.assertNotDisposed(),this.surface.width!==e.width&&(this.surface.width=e.width),this.surface.height!==e.height&&(this.surface.height=e.height),this.ctx.clearRect(0,0,e.width,e.height)}getScratchSized(e,t){if(this.scratch&&this.scratchCtx&&this.scratch.width===e&&this.scratch.height===t)this.scratchCtx.clearRect(0,0,e,t);else{this.scratch=function(e,t,r){if("u">typeof OffscreenCanvas&&e instanceof OffscreenCanvas)return new OffscreenCanvas(t,r);let i=document.createElement("canvas");return i.width=t,i.height=r,i}(this.surface,e,t);let r=this.scratch.getContext("2d");if(!r)throw new c;this.scratchCtx=r}return{canvas:this.scratch,ctx:this.scratchCtx}}compositeTile(e,t,r,i,s){this.assertNotDisposed();let n=this.tiles.findBySlice(e),c=256*t,d=256*r,h=a(i);if(null!==h){let{canvas:e,ctx:t}=this.getScratchSized(256,256);t.putImageData(l(n.data,256,256),0,0),this.ctx.save(),this.ctx.globalCompositeOperation=h,this.ctx.globalAlpha=u(s),this.ctx.drawImage(e,c,d),this.ctx.restore();return}let f=o(this.ctx.getImageData(c,d,256,256).data,n.data,256,256,i,s);this.ctx.putImageData(l(f,256,256,this.colorSpace),c,d)}compositeLayer(e,t){this.assertNotDisposed();let r=i(e);if(r){if("bitmap"===r.kind){let t=Math.round(e.transform.x),i=Math.round(e.transform.y),s=a(e.blendMode),n=u(e.opacity??1),c=r.bitmap.width,d=r.bitmap.height;if(null!==s){this.ctx.save(),this.ctx.globalCompositeOperation=s,this.ctx.globalAlpha=n,this.ctx.drawImage(r.bitmap,t,i),this.ctx.restore();return}let{ctx:h}=this.getScratchSized(c,d);h.clearRect(0,0,c,d),h.drawImage(r.bitmap,0,0);let f=h.getImageData(0,0,c,d),m=o(this.ctx.getImageData(t,i,c,d).data,f.data,c,d,e.blendMode,n);this.ctx.putImageData(l(m,c,d,this.colorSpace),t,i);return}for(let[i,s]of r.grid.tiles){let[r,a]=i.split(","),l=Number(r),o=Number(a),n=this.ensureTile(e.id,t.level,l,o,s);this.compositeTile(n,l,o,e.blendMode,e.opacity??1)}}}async endTarget(){return(this.assertNotDisposed(),"function"==typeof this.surface.transferToImageBitmap)?this.surface.transferToImageBitmap():createImageBitmap(this.surface)}assertNotDisposed(){if(this.disposed)throw Error("Canvas2DBackend: used after dispose()/destroy()")}}class c extends t{constructor(){super("Canvas2DBackend: 2D rendering context unavailable on the given surface"),this.name="BackendUnavailableCanvas2DError"}}function u(e){return e<0?0:e>1?1:e}e.s(["Canvas2DBackend",0,n],611959)},389052,e=>{"use strict";let t={normal:0,multiply:1,screen:2,darken:3,lighten:4,"color-dodge":5,"color-burn":6,"hard-light":7,overlay:8,"soft-light":9,difference:10,exclusion:11,"linear-burn":12,"linear-dodge":13,"darker-color":14,"lighter-color":15,"vivid-light":16,"linear-light":17,"pin-light":18,"hard-mix":19,subtract:20,divide:21,dissolve:22,hue:23,saturation:24,color:25,luminosity:26},r=new Set,i=`#version 300 es
layout(location = 0) in vec2 a_corner;
void main() {
  vec2 clip = a_corner * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`,s=`#version 300 es
precision highp float;
uniform sampler2D u_backdrop;
uniform sampler2D u_layer;
uniform sampler2D u_mask;
uniform int u_hasMask;
uniform float u_opacity;
uniform int u_mode;
uniform int u_dissolveSeed;
out vec4 outColor;

float roundClamp255(float v) { return clamp(floor(v + 0.5), 0.0, 255.0); }

// --- native separable helpers (cpuBlend.ts's blendSeparableChannel) ---
float multiplyVal(float cb, float cs) { return cb * cs; }
float screenVal(float cb, float cs) { return cb + cs - cb * cs; }
float hardLightVal(float cb, float cs) {
  return cs <= 0.5 ? multiplyVal(cb, 2.0 * cs) : screenVal(cb, 2.0 * cs - 1.0);
}
float overlayVal(float cb, float cs) { return hardLightVal(cs, cb); }
float softLightVal(float cb, float cs) {
  if (cs <= 0.5) return cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb);
  float d = cb <= 0.25 ? ((16.0 * cb - 12.0) * cb + 4.0) * cb : sqrt(cb);
  return cb + (2.0 * cs - 1.0) * (d - cb);
}
float blendSeparable(int mode, float cb, float cs) {
  if (mode == 0) return cs; // normal
  if (mode == 1) return multiplyVal(cb, cs);
  if (mode == 2) return screenVal(cb, cs);
  if (mode == 3) return min(cb, cs); // darken
  if (mode == 4) return max(cb, cs); // lighten
  if (mode == 5) { // color-dodge
    if (cb <= 0.0) return 0.0;
    if (cs >= 1.0) return 1.0;
    return min(1.0, cb / (1.0 - cs));
  }
  if (mode == 6) { // color-burn
    if (cb >= 1.0) return 1.0;
    if (cs <= 0.0) return 0.0;
    return 1.0 - min(1.0, (1.0 - cb) / cs);
  }
  if (mode == 7) return hardLightVal(cb, cs);
  if (mode == 8) return overlayVal(cb, cs);
  if (mode == 9) return softLightVal(cb, cs);
  if (mode == 10) return abs(cb - cs); // difference
  return cb + cs - 2.0 * cb * cs; // exclusion (mode 11)
}

// --- non-separable helpers (cpuBlend.ts's lum/clipColor/setLum/sat/
// setSat, W3C spec sec3.3 — a literal line-by-line port, not a
// branch-free reformulation, so this stays a textual diff against the
// CPU reference for review purposes). W3C luminance weights (0.3/0.59/
// 0.11) — DELIBERATELY DIFFERENT from darkerColorVal/lighterColorVal's
// Rec.709 weights (0.2126/0.7152/0.0722) below. Both are correct for
// their own spec context; do NOT "harmonize" them into one formula. ---
float lumNS(vec3 c) { return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; }
vec3 clipColorNS(vec3 c) {
  // BOTH branches test/divide against the SAME original l/n/x — never
  // recomputed after the first branch runs (mirrors cpuBlend.ts's own
  // doubt-driven-review fix; recomputing would reintroduce that bug).
  float l = lumNS(c);
  float n = min(c.r, min(c.g, c.b));
  float x = max(c.r, max(c.g, c.b));
  vec3 result = c;
  if (n < 0.0) {
    result = vec3(
      l + (result.r - l) * l / (l - n),
      l + (result.g - l) * l / (l - n),
      l + (result.b - l) * l / (l - n)
    );
  }
  if (x > 1.0) {
    result = vec3(
      l + (result.r - l) * (1.0 - l) / (x - l),
      l + (result.g - l) * (1.0 - l) / (x - l),
      l + (result.b - l) * (1.0 - l) / (x - l)
    );
  }
  return result;
}
vec3 setLumNS(vec3 c, float l) {
  float d = l - lumNS(c);
  return clipColorNS(c + vec3(d));
}
float satNS(vec3 c) { return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
vec3 setSatNS(vec3 c, float s) {
  // Literal port of cpuBlend.ts's setSat: sort the 3 component INDICES
  // by value (a fixed 3-element compare-and-swap ladder — GLSL ES 3.00
  // allows dynamic float-array indexing, unlike ES 100), then write
  // s/midOut/0 to those same index positions, exactly mirroring the JS's
  // [minIdx, midIdx, maxIdx] destructuring. Tie behavior is value-
  // symmetric (verified by hand-derivation): tied inputs produce tied
  // outputs regardless of which index a given ordering assigns to mid
  // vs max/min, so no Array.sort-stability emulation is needed.
  float arr[3] = float[3](c.r, c.g, c.b);
  int minIdx = 0;
  int maxIdx = 0;
  for (int i = 1; i < 3; i++) {
    if (arr[i] < arr[minIdx]) minIdx = i;
    if (arr[i] > arr[maxIdx]) maxIdx = i;
  }
  int midIdx = 3 - minIdx - maxIdx;
  // Only reachable when all 3 components are exactly equal (the loop's
  // strict </> comparisons mean minIdx/maxIdx can only both stay at their
  // initial 0 if every component ties with arr[0], so minIdx is always 0
  // here) — the arbitrary distinct assignment below is harmless since the
  // arr[maxIdx] > arr[minIdx] guard just below is false in that case
  // regardless.
  if (minIdx == maxIdx) { midIdx = minIdx == 0 ? 1 : 0; maxIdx = midIdx == 1 ? 2 : 1; }
  float outArr[3] = float[3](0.0, 0.0, 0.0);
  if (arr[maxIdx] > arr[minIdx]) {
    outArr[midIdx] = (arr[midIdx] - arr[minIdx]) * s / (arr[maxIdx] - arr[minIdx]);
    outArr[maxIdx] = s;
  }
  return vec3(outArr[0], outArr[1], outArr[2]);
}
vec3 blendNonSeparableGlsl(int mode, vec3 cb, vec3 cs) {
  if (mode == 23) return setLumNS(setSatNS(cs, satNS(cb)), lumNS(cb)); // hue
  if (mode == 24) return setLumNS(setSatNS(cb, satNS(cs)), lumNS(cb)); // saturation
  if (mode == 25) return setLumNS(cs, lumNS(cb)); // color
  return setLumNS(cb, lumNS(cs)); // luminosity (mode 26)
}

// --- custom 0-255-integer-domain helpers (cpuBlend.ts's blendPixelCustom) ---
float colorBurn255(float b, float l) {
  return l <= 0.0 ? 0.0 : roundClamp255(255.0 - ((255.0 - b) * 255.0) / l);
}
float colorDodge255(float b, float l) {
  return l >= 255.0 ? 255.0 : roundClamp255((b * 255.0) / (255.0 - l));
}
float linearBurn255(float b, float l) { return roundClamp255(b + l - 255.0); }
float linearDodge255(float b, float l) { return roundClamp255(b + l); }
float linearLight255(float b, float l) { return roundClamp255(b + 2.0 * l - 255.0); }
float vividLight255(float b, float l) {
  return l <= 127.0 ? colorBurn255(b, 2.0 * l) : colorDodge255(b, 2.0 * l - 255.0);
}
float pinLight255(float b, float l) {
  float v = l <= 127.0 ? min(b, 2.0 * l) : max(b, 2.0 * l - 255.0);
  return roundClamp255(v);
}
float hardMix255(float b, float l) {
  return (b + 2.0 * l - 255.0 < 128.0) ? 0.0 : 255.0;
}
float subtract255(float b, float l) { return roundClamp255(b - l); }
float divide255(float b, float l) {
  return l <= 0.0 ? 255.0 : roundClamp255((b * 255.0) / l);
}
// Whole-pixel Rec.709 luminance compare, ties -> base — matches
// cpuBlend.ts's darker-color/lighter-color exactly (including the
// tie-breaking direction of each comparator).
vec3 darkerColorVal(vec3 cbq, vec3 lq) {
  float lumB = 0.2126 * cbq.r + 0.7152 * cbq.g + 0.0722 * cbq.b;
  float lumL = 0.2126 * lq.r + 0.7152 * lq.g + 0.0722 * lq.b;
  return lumB <= lumL ? cbq : lq;
}
vec3 lighterColorVal(vec3 cbq, vec3 lq) {
  float lumB = 0.2126 * cbq.r + 0.7152 * cbq.g + 0.0722 * cbq.b;
  float lumL = 0.2126 * lq.r + 0.7152 * lq.g + 0.0722 * lq.b;
  return lumB >= lumL ? cbq : lq;
}

// --- dissolve: deterministic per-fragment integer hash (NOT Math.random,
// NOT the CPU's sequential mulberry32 — see this file's header comment
// for why byte-parity against the CPU stream is provably impossible here
// and the F06 spec's own statistical-only criterion). MurmurHash3-style
// 32-bit finalizer — well-distributed, fully deterministic per (x,y,seed). ---
uint hashUint(uint x) {
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
float dissolveRand(ivec2 p, int seed) {
  uint h = hashUint(
    uint(p.x) * 374761393u + uint(p.y) * 668265263u + uint(seed) * 2246822519u
  );
  return float(h) / 4294967296.0;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 backdrop = texelFetch(u_backdrop, p, 0);
  vec4 layerPx = texelFetch(u_layer, p, 0);

  float maskLum = 1.0;
  if (u_hasMask != 0) {
    vec4 m = texelFetch(u_mask, p, 0);
    // Rec.601 — matches lib/stackCompositor.ts's applyMaskAndOpacity exactly.
    maskLum = 0.299 * m.r + 0.587 * m.g + 0.114 * m.b;
  }
  float sa = layerPx.a * maskLum * u_opacity;

  if (sa <= 0.0) {
    outColor = backdrop;
    return;
  }

  if (u_mode == 22) {
    float rnd = dissolveRand(p, u_dissolveSeed);
    outColor = rnd < sa ? vec4(layerPx.rgb, 1.0) : backdrop;
    return;
  }

  vec3 cb = backdrop.rgb;
  vec3 cs = layerPx.rgb;
  float da = backdrop.a;

  if (u_mode >= 12 && u_mode < 22) {
    vec3 cbq = floor(cb * 255.0 + 0.5);
    vec3 csq = floor(cs * 255.0 + 0.5);
    vec3 blended;
    if (u_mode == 12) blended = vec3(linearBurn255(cbq.r, csq.r), linearBurn255(cbq.g, csq.g), linearBurn255(cbq.b, csq.b));
    else if (u_mode == 13) blended = vec3(linearDodge255(cbq.r, csq.r), linearDodge255(cbq.g, csq.g), linearDodge255(cbq.b, csq.b));
    else if (u_mode == 14) blended = darkerColorVal(cbq, csq);
    else if (u_mode == 15) blended = lighterColorVal(cbq, csq);
    else if (u_mode == 16) blended = vec3(vividLight255(cbq.r, csq.r), vividLight255(cbq.g, csq.g), vividLight255(cbq.b, csq.b));
    else if (u_mode == 17) blended = vec3(linearLight255(cbq.r, csq.r), linearLight255(cbq.g, csq.g), linearLight255(cbq.b, csq.b));
    else if (u_mode == 18) blended = vec3(pinLight255(cbq.r, csq.r), pinLight255(cbq.g, csq.g), pinLight255(cbq.b, csq.b));
    else if (u_mode == 19) blended = vec3(hardMix255(cbq.r, csq.r), hardMix255(cbq.g, csq.g), hardMix255(cbq.b, csq.b));
    else if (u_mode == 20) blended = vec3(subtract255(cbq.r, csq.r), subtract255(cbq.g, csq.g), subtract255(cbq.b, csq.b));
    else blended = vec3(divide255(cbq.r, csq.r), divide255(cbq.g, csq.g), divide255(cbq.b, csq.b)); // divide (mode 21)
    blended /= 255.0;

    // NO backdrop-alpha mix for custom modes — direct source-over.
    float outA = sa + da * (1.0 - sa);
    vec3 outRGB = outA > 0.0 ? (blended * sa + cb * da * (1.0 - sa)) / outA : vec3(0.0);
    outColor = vec4(outRGB, outA);
    return;
  }

  vec3 blended = u_mode >= 23
    ? blendNonSeparableGlsl(u_mode, cb, cs)
    : vec3(
        blendSeparable(u_mode, cb.r, cs.r),
        blendSeparable(u_mode, cb.g, cs.g),
        blendSeparable(u_mode, cb.b, cs.b)
      );
  vec3 mixC = clamp(cs * (1.0 - da) + blended * da, 0.0, 1.0);
  float outA = sa + da * (1.0 - sa);
  vec3 outRGB = outA > 0.0 ? (mixC * sa + cb * da * (1.0 - sa)) / outA : vec3(0.0);
  outColor = vec4(outRGB, outA);
}`;e.s(["BLEND_STACK_FRAGMENT_SHADER",0,s,"BLEND_STACK_VERTEX_SHADER",0,i,"CUSTOM_MODE_ID_START",0,12,"DISSOLVE_MODE_ID",0,22,"GPU_BLEND_MODE_ID",0,t,"NONSEP_MODE_ID_START",0,23,"demoteBlendMode",0,function(e){r.add(e)},"isGpuBlendImplemented",0,function(e){return void 0!==t[e]&&!r.has(e)}])},169460,904566,792834,193378,e=>{"use strict";e.i(611959),e.i(703771);var t=e.i(791057),r=e.i(393489),i=e.i(253067),s=e.i(963485),a=e.i(98842),l=(e.i(732007),e.i(527926));e.i(802132);var o=e.i(559949),n=e.i(389052);i.BackendUnavailableError;var c=i;let u="vs_main",d="fs_main",h="vs_present",f="fs_present",m=`
@group(0) @binding(0) var srcTex: texture_2d<f32>;

@vertex
fn ${h}(@location(0) a_corner: vec2<f32>) -> @builtin(position) vec4<f32> {
  // Full-screen quad, clip-space remap only — no Y-flip. Unlike the
  // blend shader above (whose fragment stage's texelFetch-equivalent
  // reads are keyed only by fragCoord, same as this one), a flip here
  // would be genuinely meaningless either way: this fragment stage
  // reads srcTex purely by fragCoord too, never by an interpolated UV
  // varying from this vertex stage, so vertex winding/orientation has
  // zero effect on which texel lands where (doubt-driven-review
  // finding: an earlier version copied the blend shader's flip
  // verbatim, which was dead code here, not a deliberate choice).
  let clip = a_corner * 2.0 - vec2<f32>(1.0, 1.0);
  return vec4<f32>(clip.x, clip.y, 0.0, 1.0);
}

@fragment
fn ${f}(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let p = vec2<i32>(i32(fragCoord.x), i32(fragCoord.y));
  let c = textureLoad(srcTex, p, 0);
  // Straight -> premultiplied. Rule A3: no division anywhere on this path.
  return vec4<f32>(c.rgb * c.a, c.a);
}
`,b=`
struct BlendUniforms {
  hasMask: i32,
  opacity: f32,
  mode: i32,
  dissolveSeed: i32,
}

@group(0) @binding(0) var u_backdrop: texture_2d<f32>;
@group(0) @binding(1) var u_layer: texture_2d<f32>;
@group(0) @binding(2) var u_mask: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: BlendUniforms;

@vertex
fn ${u}(@location(0) a_corner: vec2<f32>) -> @builtin(position) vec4<f32> {
  let clip = a_corner * 2.0 - vec2<f32>(1.0, 1.0);
  return vec4<f32>(clip.x, -clip.y, 0.0, 1.0);
}

fn roundClamp255(v: f32) -> f32 { return clamp(floor(v + 0.5), 0.0, 255.0); }

// --- native separable helpers (cpuBlend.ts's blendSeparableChannel) ---
fn multiplyVal(cb: f32, cs: f32) -> f32 { return cb * cs; }
fn screenVal(cb: f32, cs: f32) -> f32 { return cb + cs - cb * cs; }
fn hardLightVal(cb: f32, cs: f32) -> f32 {
  return select(screenVal(cb, 2.0 * cs - 1.0), multiplyVal(cb, 2.0 * cs), cs <= 0.5);
}
fn overlayVal(cb: f32, cs: f32) -> f32 { return hardLightVal(cs, cb); }
fn softLightVal(cb: f32, cs: f32) -> f32 {
  if (cs <= 0.5) {
    return cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb);
  }
  var d: f32;
  if (cb <= 0.25) {
    d = ((16.0 * cb - 12.0) * cb + 4.0) * cb;
  } else {
    d = sqrt(cb);
  }
  return cb + (2.0 * cs - 1.0) * (d - cb);
}
fn blendSeparable(mode: i32, cb: f32, cs: f32) -> f32 {
  if (mode == 0) { return cs; }
  if (mode == 1) { return multiplyVal(cb, cs); }
  if (mode == 2) { return screenVal(cb, cs); }
  if (mode == 3) { return min(cb, cs); }
  if (mode == 4) { return max(cb, cs); }
  if (mode == 5) {
    if (cb <= 0.0) { return 0.0; }
    if (cs >= 1.0) { return 1.0; }
    return min(1.0, cb / (1.0 - cs));
  }
  if (mode == 6) {
    if (cb >= 1.0) { return 1.0; }
    if (cs <= 0.0) { return 0.0; }
    return 1.0 - min(1.0, (1.0 - cb) / cs);
  }
  if (mode == 7) { return hardLightVal(cb, cs); }
  if (mode == 8) { return overlayVal(cb, cs); }
  if (mode == 9) { return softLightVal(cb, cs); }
  if (mode == 10) { return abs(cb - cs); }
  return cb + cs - 2.0 * cb * cs;
}

// --- non-separable helpers (cpuBlend.ts's lum/clipColor/setLum/sat/
// setSat, W3C spec sec3.3 — kept as a literal line-by-line port, not a
// branch-free reformulation, so this stays a textual diff against the
// CPU/GLSL references for review purposes). ---
fn lumNS(c: vec3<f32>) -> f32 { return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; }
fn clipColorNS(cIn: vec3<f32>) -> vec3<f32> {
  // BOTH branches test/divide against the SAME original l/n/x — never
  // recomputed after the first branch runs (mirrors cpuBlend.ts's own
  // doubt-driven-review fix; recomputing would reintroduce that bug).
  let l = lumNS(cIn);
  let n = min(cIn.r, min(cIn.g, cIn.b));
  let x = max(cIn.r, max(cIn.g, cIn.b));
  var result = cIn;
  if (n < 0.0) {
    result = vec3<f32>(
      l + (result.r - l) * l / (l - n),
      l + (result.g - l) * l / (l - n),
      l + (result.b - l) * l / (l - n)
    );
  }
  if (x > 1.0) {
    result = vec3<f32>(
      l + (result.r - l) * (1.0 - l) / (x - l),
      l + (result.g - l) * (1.0 - l) / (x - l),
      l + (result.b - l) * (1.0 - l) / (x - l)
    );
  }
  return result;
}
fn setLumNS(c: vec3<f32>, l: f32) -> vec3<f32> {
  let d = l - lumNS(c);
  return clipColorNS(c + vec3<f32>(d, d, d));
}
fn satNS(c: vec3<f32>) -> f32 { return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
fn setSatNS(c: vec3<f32>, s: f32) -> vec3<f32> {
  // Literal port of cpuBlend.ts's / glslBlend.ts's setSat: sort the 3
  // component INDICES by value (WGSL requires a \`var\` array, not \`let\`,
  // for dynamic indexing), then write s/midOut/0 to those same index
  // positions. Tie behavior is value-symmetric (verified by hand-
  // derivation, same as the GLSL sibling): tied inputs produce tied
  // outputs regardless of which index a given ordering assigns to
  // mid vs max/min, so no sort-stability emulation is needed.
  var arr = array<f32, 3>(c.r, c.g, c.b);
  var minIdx = 0;
  var maxIdx = 0;
  for (var i = 1; i < 3; i = i + 1) {
    if (arr[i] < arr[minIdx]) { minIdx = i; }
    if (arr[i] > arr[maxIdx]) { maxIdx = i; }
  }
  var midIdx = 3 - minIdx - maxIdx;
  // Only reachable when all 3 components are exactly equal (the loop's
  // strict </> comparisons mean minIdx/maxIdx can only both stay at
  // their initial 0 if every component ties with arr[0]) — the resulting
  // arbitrary distinct assignment is harmless since the arr[maxIdx] >
  // arr[minIdx] guard just below is false in that case regardless.
  if (minIdx == maxIdx) {
    midIdx = select(0, 1, minIdx == 0);
    maxIdx = select(1, 2, midIdx == 1);
  }
  var outArr = array<f32, 3>(0.0, 0.0, 0.0);
  if (arr[maxIdx] > arr[minIdx]) {
    outArr[midIdx] = (arr[midIdx] - arr[minIdx]) * s / (arr[maxIdx] - arr[minIdx]);
    outArr[maxIdx] = s;
  }
  return vec3<f32>(outArr[0], outArr[1], outArr[2]);
}
fn blendNonSeparableGlsl(mode: i32, cb: vec3<f32>, cs: vec3<f32>) -> vec3<f32> {
  if (mode == ${n.NONSEP_MODE_ID_START}) { return setLumNS(setSatNS(cs, satNS(cb)), lumNS(cb)); } // hue
  if (mode == ${n.NONSEP_MODE_ID_START+1}) { return setLumNS(setSatNS(cb, satNS(cs)), lumNS(cb)); } // saturation
  if (mode == ${n.NONSEP_MODE_ID_START+2}) { return setLumNS(cs, lumNS(cb)); } // color
  return setLumNS(cb, lumNS(cs)); // luminosity
}

// --- custom 0-255-integer-domain helpers (cpuBlend.ts's blendPixelCustom) ---
fn colorBurn255(b: f32, l: f32) -> f32 {
  if (l <= 0.0) { return 0.0; }
  return roundClamp255(255.0 - ((255.0 - b) * 255.0) / l);
}
fn colorDodge255(b: f32, l: f32) -> f32 {
  if (l >= 255.0) { return 255.0; }
  return roundClamp255((b * 255.0) / (255.0 - l));
}
fn linearBurn255(b: f32, l: f32) -> f32 { return roundClamp255(b + l - 255.0); }
fn linearDodge255(b: f32, l: f32) -> f32 { return roundClamp255(b + l); }
fn linearLight255(b: f32, l: f32) -> f32 { return roundClamp255(b + 2.0 * l - 255.0); }
fn vividLight255(b: f32, l: f32) -> f32 {
  if (l <= 127.0) { return colorBurn255(b, 2.0 * l); }
  return colorDodge255(b, 2.0 * l - 255.0);
}
fn pinLight255(b: f32, l: f32) -> f32 {
  var v: f32;
  if (l <= 127.0) { v = min(b, 2.0 * l); } else { v = max(b, 2.0 * l - 255.0); }
  return roundClamp255(v);
}
fn hardMix255(b: f32, l: f32) -> f32 {
  if (b + 2.0 * l - 255.0 < 128.0) { return 0.0; }
  return 255.0;
}
fn subtract255(b: f32, l: f32) -> f32 { return roundClamp255(b - l); }
fn divide255(b: f32, l: f32) -> f32 {
  if (l <= 0.0) { return 255.0; }
  return roundClamp255((b * 255.0) / l);
}
// Whole-pixel Rec.709 luminance compare, ties -> base — matches
// cpuBlend.ts's darker-color/lighter-color exactly (including the
// tie-breaking direction of each comparator).
fn darkerColorVal(cbq: vec3<f32>, lq: vec3<f32>) -> vec3<f32> {
  let lumB = 0.2126 * cbq.r + 0.7152 * cbq.g + 0.0722 * cbq.b;
  let lumL = 0.2126 * lq.r + 0.7152 * lq.g + 0.0722 * lq.b;
  return select(lq, cbq, lumB <= lumL);
}
fn lighterColorVal(cbq: vec3<f32>, lq: vec3<f32>) -> vec3<f32> {
  let lumB = 0.2126 * cbq.r + 0.7152 * cbq.g + 0.0722 * cbq.b;
  let lumL = 0.2126 * lq.r + 0.7152 * lq.g + 0.0722 * lq.b;
  return select(lq, cbq, lumB >= lumL);
}

// --- dissolve: deterministic per-fragment integer hash (NOT Math.random,
// NOT the CPU's sequential mulberry32 stream — see glslBlend.ts's own
// header comment for why byte-parity against the CPU stream is provably
// impossible here, and F06's spec's own statistical-only dissolve
// criterion). Same MurmurHash3-style 32-bit finalizer as the GLSL
// sibling — u32 arithmetic wraps on overflow in WGSL exactly as GLSL's
// \`uint\` does, so this is a direct operator-for-operator port. ---
fn hashUint(xIn: u32) -> u32 {
  var x = xIn;
  x = x ^ (x >> 16u);
  x = x * 0x7feb352du;
  x = x ^ (x >> 15u);
  x = x * 0x846ca68bu;
  x = x ^ (x >> 16u);
  return x;
}
fn dissolveRand(p: vec2<i32>, seed: i32) -> f32 {
  let h = hashUint(
    u32(p.x) * 374761393u + u32(p.y) * 668265263u + u32(seed) * 2246822519u
  );
  return f32(h) / 4294967296.0;
}

@fragment
fn ${d}(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let p = vec2<i32>(i32(fragCoord.x), i32(fragCoord.y));
  let backdrop = textureLoad(u_backdrop, p, 0);
  let layerPx = textureLoad(u_layer, p, 0);

  var maskLum: f32 = 1.0;
  if (u.hasMask != 0) {
    let m = textureLoad(u_mask, p, 0);
    // Rec.601 — matches lib/stackCompositor.ts's applyMaskAndOpacity exactly.
    maskLum = 0.299 * m.r + 0.587 * m.g + 0.114 * m.b;
  }
  let sa = layerPx.a * maskLum * u.opacity;

  if (sa <= 0.0) {
    return backdrop;
  }

  if (u.mode == ${n.DISSOLVE_MODE_ID}) {
    let rnd = dissolveRand(p, u.dissolveSeed);
    if (rnd < sa) {
      return vec4<f32>(layerPx.rgb, 1.0);
    }
    return backdrop;
  }

  let cb = backdrop.rgb;
  let cs = layerPx.rgb;
  let da = backdrop.a;

  if (u.mode >= ${n.CUSTOM_MODE_ID_START} && u.mode < ${n.DISSOLVE_MODE_ID}) {
    let cbq = floor(cb * 255.0 + vec3<f32>(0.5, 0.5, 0.5));
    let csq = floor(cs * 255.0 + vec3<f32>(0.5, 0.5, 0.5));
    var blended: vec3<f32>;
    if (u.mode == 12) { blended = vec3<f32>(linearBurn255(cbq.r, csq.r), linearBurn255(cbq.g, csq.g), linearBurn255(cbq.b, csq.b)); }
    else if (u.mode == 13) { blended = vec3<f32>(linearDodge255(cbq.r, csq.r), linearDodge255(cbq.g, csq.g), linearDodge255(cbq.b, csq.b)); }
    else if (u.mode == 14) { blended = darkerColorVal(cbq, csq); }
    else if (u.mode == 15) { blended = lighterColorVal(cbq, csq); }
    else if (u.mode == 16) { blended = vec3<f32>(vividLight255(cbq.r, csq.r), vividLight255(cbq.g, csq.g), vividLight255(cbq.b, csq.b)); }
    else if (u.mode == 17) { blended = vec3<f32>(linearLight255(cbq.r, csq.r), linearLight255(cbq.g, csq.g), linearLight255(cbq.b, csq.b)); }
    else if (u.mode == 18) { blended = vec3<f32>(pinLight255(cbq.r, csq.r), pinLight255(cbq.g, csq.g), pinLight255(cbq.b, csq.b)); }
    else if (u.mode == 19) { blended = vec3<f32>(hardMix255(cbq.r, csq.r), hardMix255(cbq.g, csq.g), hardMix255(cbq.b, csq.b)); }
    else if (u.mode == 20) { blended = vec3<f32>(subtract255(cbq.r, csq.r), subtract255(cbq.g, csq.g), subtract255(cbq.b, csq.b)); }
    else { blended = vec3<f32>(divide255(cbq.r, csq.r), divide255(cbq.g, csq.g), divide255(cbq.b, csq.b)); } // divide

    blended = blended / 255.0;

    // NO backdrop-alpha mix for custom modes — direct source-over.
    let outA = sa + da * (1.0 - sa);
    var outRGB = vec3<f32>(0.0, 0.0, 0.0);
    if (outA > 0.0) {
      outRGB = (blended * sa + cb * da * (1.0 - sa)) / outA;
    }
    return vec4<f32>(outRGB, outA);
  }

  var blended3: vec3<f32>;
  if (u.mode >= ${n.NONSEP_MODE_ID_START}) {
    blended3 = blendNonSeparableGlsl(u.mode, cb, cs);
  } else {
    blended3 = vec3<f32>(
      blendSeparable(u.mode, cb.r, cs.r),
      blendSeparable(u.mode, cb.g, cs.g),
      blendSeparable(u.mode, cb.b, cs.b)
    );
  }
  let mixC = clamp(
    cs * (1.0 - da) + blended3 * da,
    vec3<f32>(0.0, 0.0, 0.0),
    vec3<f32>(1.0, 1.0, 1.0)
  );
  let outA2 = sa + da * (1.0 - sa);
  var outRGB2 = vec3<f32>(0.0, 0.0, 0.0);
  if (outA2 > 0.0) {
    outRGB2 = (mixC * sa + cb * da * (1.0 - sa)) / outA2;
  }
  return vec4<f32>(outRGB2, outA2);
}
`,p="vs_lut",g="fs_lut",x=`
// Snapshot of mainTex (straight alpha), copied GPU-to-GPU before this pass.
@group(0) @binding(0) var u_source: texture_2d<f32>;
// 256x1 rgba8unorm lookup table — one texel per input byte 0..255.
@group(0) @binding(1) var u_lut: texture_2d<f32>;
struct LutUniforms {
  mode: i32, // 0 = perChannel, 1 = lumaIndexed
};
@group(0) @binding(2) var<uniform> u: LutUniforms;

@vertex
fn ${p}(@location(0) a_corner: vec2<f32>) -> @builtin(position) vec4<f32> {
  // Full-screen quad, clip-space remap only. Fragment stage addresses
  // u_source by fragCoord, so orientation is irrelevant (same reasoning
  // as WGSL_PRESENT_SHADER).
  let clip = a_corner * 2.0 - vec2<f32>(1.0, 1.0);
  return vec4<f32>(clip.x, clip.y, 0.0, 1.0);
}

// rgba8unorm -> exact byte index. v*255 for a unorm8 value is within
// float error of an integer; floor(x+0.5) recovers it exactly (never
// round(), whose half-to-even differs from JS Math.round at .5).
fn byteIndex(v: f32) -> i32 {
  return clamp(i32(floor(v * 255.0 + 0.5)), 0, 255);
}

fn lutTexel(idx: i32) -> vec4<f32> {
  return textureLoad(u_lut, vec2<i32>(idx, 0), 0);
}

@fragment
fn ${g}(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let p = vec2<i32>(i32(fragCoord.x), i32(fragCoord.y));
  let src = textureLoad(u_source, p, 0);

  if (u.mode == 0) {
    // Each channel indexes by its OWN byte and reads back its OWN slot
    // (photoFilter bakes three distinct curves) — applyLutPassReference's
    // perChannel branch, verbatim.
    let r = lutTexel(byteIndex(src.r)).r;
    let g = lutTexel(byteIndex(src.g)).g;
    let b = lutTexel(byteIndex(src.b)).b;
    return vec4<f32>(r, g, b, src.a);
  }

  // lumaIndexed: index by Rec.601 luma of the pixel's OWN bytes, then
  // alpha-composite lut.rgb over the ORIGINAL rgb using lut.a as the
  // weight (NOT the pixel's alpha, which is never read or written).
  let rb = f32(byteIndex(src.r));
  let gb = f32(byteIndex(src.g));
  let bb = f32(byteIndex(src.b));
  let luma = 0.299 * rb + 0.587 * gb + 0.114 * bb;
  let idx = clamp(i32(floor(luma + 0.5)), 0, 255);
  let t = lutTexel(idx);
  let w = t.a;
  let outRgb = t.rgb * w + src.rgb * (1.0 - w);
  return vec4<f32>(outRgb, src.a);
}
`,v="vs_direct",y="fs_direct",w=`
// Port of DIRECT_FRAGMENT_SHADER (adjustmentShadersDirect.ts). Every
// function below is a 1:1 transliteration of the GLSL function of the
// same name — never re-derived. Colors are worked in 0..1 float space,
// exactly like the GLSL.

// C5: MUST be array<vec4<f32>, 10> (160 B, stride 16) — a flat 40-scalar
// f32 array would need 640 B (16-byte-per-element uniform stride).
// Indexing: GLSL u_p[k].x -> u.params[k].x (same k).
struct DirectAdjustmentUniforms {
  typeId: i32,                    // offset 0
  params: array<vec4<f32>, 10>,   // offset 16
};

@group(0) @binding(0) var u_source: texture_2d<f32>;
@group(0) @binding(1) var<uniform> u: DirectAdjustmentUniforms;

@vertex
fn ${v}(@location(0) a_corner: vec2<f32>) -> @builtin(position) vec4<f32> {
  // Pointwise pass, reads/writes by fragCoord only — orientation is
  // irrelevant (same reasoning as WGSL_LUT_SHADER's vertex stage).
  let clip = a_corner * 2.0 - vec2<f32>(1.0, 1.0);
  return vec4<f32>(clip.x, clip.y, 0.0, 1.0);
}

// GLSL mod(x,y) = x - y*floor(x/y), sign of the RESULT follows y (the
// divisor). WGSL's % operator is truncating — sign follows x (the
// dividend) — a DIFFERENT function for negative x. Every GLSL mod() call
// below (hue-wrap math with a signed slider delta, and the two hue-sextant
// computations) needs this, never %.
fn glslMod(x: f32, y: f32) -> f32 {
  return x - y * floor(x / y);
}

// hueSaturationFilter.ts's rgbToHsl/hslToRgb, ported 1:1 (0..1 domain).
fn rgbToHsl(c: vec3<f32>) -> vec3<f32> {
  let mx = max(c.r, max(c.g, c.b));
  let mn = min(c.r, min(c.g, c.b));
  let l = (mx + mn) * 0.5;
  if (mx == mn) {
    return vec3<f32>(0.0, 0.0, l); // zero-chroma guard — avoids /0 below
  }
  let d = mx - mn;
  let s = select(d / (mx + mn), d / (2.0 - mx - mn), l > 0.5);
  var h: f32;
  if (mx == c.r) {
    h = glslMod((c.g - c.b) / d, 6.0) / 6.0;
  } else if (mx == c.g) {
    h = ((c.b - c.r) / d + 2.0) / 6.0;
  } else {
    h = ((c.r - c.g) / d + 4.0) / 6.0;
  }
  if (h < 0.0) {
    h = h + 1.0;
  }
  return vec3<f32>(h, s, l);
}
fn hue2rgb(pIn: f32, q: f32, tIn: f32) -> f32 {
  var t = tIn; // WGSL params are immutable — GLSL mutates t in place
  if (t < 0.0) {
    t = t + 1.0;
  }
  if (t > 1.0) {
    t = t - 1.0;
  }
  if (t < 1.0 / 6.0) {
    return pIn + (q - pIn) * 6.0 * t;
  }
  if (t < 0.5) {
    return q;
  }
  if (t < 2.0 / 3.0) {
    return pIn + (q - pIn) * (2.0 / 3.0 - t) * 6.0;
  }
  return pIn;
}
fn hslToRgb(h: f32, s: f32, l: f32) -> vec3<f32> {
  if (s == 0.0) {
    return vec3<f32>(l); // zero-saturation guard — GLSL's own early-out
  }
  let q = select(l + s - l * s, l * (1.0 + s), l < 0.5);
  let pp = 2.0 * l - q;
  return vec3<f32>(
    hue2rgb(pp, q, h + 1.0 / 3.0),
    hue2rgb(pp, q, h),
    hue2rgb(pp, q, h - 1.0 / 3.0),
  );
}
// hueSaturationFilter.ts's applySlider / replaceColor.ts's identical copy.
fn applySlider(v01: f32, slider: f32) -> f32 {
  return select(
    v01 + (1.0 - v01) * (slider / 100.0),
    v01 * (1.0 + slider / 100.0),
    slider < 0.0,
  );
}
// colorBalanceFilter.ts's tone-range weights (0..1 luminance domain).
fn shadowsWeight(l: f32) -> f32 {
  return max(0.0, 1.0 - l / (128.0 / 255.0));
}
fn highlightsWeight(l: f32) -> f32 {
  return max(0.0, (l - 128.0 / 255.0) / (127.0 / 255.0));
}
fn midtonesWeight(l: f32) -> f32 {
  return 1.0 - shadowsWeight(l) - highlightsWeight(l);
}
// selectiveColorFilter.ts's computeRangeWeights, full 9-range version —
// GLSL used 3 vec3 out-params; WGSL has none, so this returns a struct.
struct RangeWeights9 {
  chromaticLow: vec3<f32>,
  chromaticHigh: vec3<f32>,
  achromatic: vec3<f32>,
};
fn computeRangeWeights9(c: vec3<f32>) -> RangeWeights9 {
  let mx = max(c.r, max(c.g, c.b));
  let mn = min(c.r, min(c.g, c.b));
  let l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  let chroma = mx - mn;
  let s = chroma; // already 0..1 domain (CPU divides by 255)
  var h = 0.0;
  if (chroma > 0.0) { // zero-chroma guard around the /chroma hue block
    if (mx == c.r) {
      h = 60.0 * glslMod((c.g - c.b) / chroma, 6.0);
    } else if (mx == c.g) {
      h = 60.0 * ((c.b - c.r) / chroma + 2.0);
    } else {
      h = 60.0 * ((c.r - c.g) / chroma + 4.0);
    }
    if (h < 0.0) {
      h = h + 360.0;
    }
  }
  // centers: reds=0,yellows=60,greens=120,cyans=180,blues=240,magentas=300
  var centers: array<f32, 6>;
  centers[0] = 0.0; centers[1] = 60.0; centers[2] = 120.0;
  centers[3] = 180.0; centers[4] = 240.0; centers[5] = 300.0;
  var w: array<f32, 6>;
  for (var i = 0; i < 6; i++) {
    var d = abs(h - centers[i]);
    d = glslMod(d, 360.0);
    if (d > 180.0) {
      d = 360.0 - d;
    }
    w[i] = s * max(0.0, 1.0 - d / 60.0);
  }
  var out: RangeWeights9;
  out.chromaticLow = vec3<f32>(w[0], w[1], w[2]);
  out.chromaticHigh = vec3<f32>(w[3], w[4], w[5]);
  out.achromatic = vec3<f32>(
    (1.0 - s) * shadowsWeight(l),
    (1.0 - s) * midtonesWeight(l),
    (1.0 - s) * highlightsWeight(l),
  );
  return out;
}

fn applyChannelMixer(c: vec3<f32>) -> vec3<f32> {
  // rrow.w (the constant term, rc/gc/bc) is on the SAME 0-255 byte scale
  // as the pixel channels (channelMixerFilter.ts's real CPU semantics:
  // clamp(rr*r + rg*g + rb*b + rc), r/g/b/rc all bytes; types.ts says
  // "Constants in -255..255") -- divide by 255 before adding it in this
  // shader's 0..1 domain. A real bug (constant added un-scaled) was found
  // live by this port's own evidence harness in the GLSL twin
  // (DIRECT_FRAGMENT_SHADER) and fixed there too (mememaker-gpu-backlog.md
  // item #8) — this WGSL and the GLSL now agree, both matching the CPU
  // oracle.
  let rrow = u.params[0]; let grow = u.params[1]; let brow = u.params[2];
  let r = rrow.x * c.r + rrow.y * c.g + rrow.z * c.b + rrow.w / 255.0;
  let g = grow.x * c.r + grow.y * c.g + grow.z * c.b + grow.w / 255.0;
  let b = brow.x * c.r + brow.y * c.g + brow.z * c.b + brow.w / 255.0;
  return clamp(vec3<f32>(r, g, b), vec3<f32>(0.0), vec3<f32>(1.0));
}
fn applyColorBalance(c: vec3<f32>) -> vec3<f32> {
  let l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  let sw = shadowsWeight(l); let mw = midtonesWeight(l); let hw = highlightsWeight(l);
  let sh = u.params[0]; let mid = u.params[1]; let hi = u.params[2];
  let dr = (sh.x * sw + mid.x * mw + hi.x * hw) / 255.0;
  let dg = (sh.y * sw + mid.y * mw + hi.y * hw) / 255.0;
  let db = (sh.z * sw + mid.z * mw + hi.z * hw) / 255.0;
  return clamp(c + vec3<f32>(dr, dg, db) * 0.6, vec3<f32>(0.0), vec3<f32>(1.0));
}
fn applyHueSaturation(c: vec3<f32>) -> vec3<f32> {
  let master = u.params[0];
  let colorizeP = u.params[7];
  if (colorizeP.x > 0.5) {
    let hsl0 = rgbToHsl(c);
    let l2 = applySlider(hsl0.z, colorizeP.w);
    return hslToRgb(colorizeP.y / 360.0, colorizeP.z / 100.0, l2);
  }
  let rw9 = computeRangeWeights9(c);
  var rw: array<f32, 6>;
  rw[0] = rw9.chromaticLow.x; rw[1] = rw9.chromaticLow.y; rw[2] = rw9.chromaticLow.z;
  rw[3] = rw9.chromaticHigh.x; rw[4] = rw9.chromaticHigh.y; rw[5] = rw9.chromaticHigh.z;
  var dH = master.x; var dS = master.y; var dL = master.z;
  for (var i = 0; i < 6; i++) {
    let ch = u.params[1 + i];
    dH = dH + rw[i] * ch.x;
    dS = dS + rw[i] * ch.y;
    dL = dL + rw[i] * ch.z;
  }
  let hsl = rgbToHsl(c);
  // HAZARD: dH is a SIGNED slider delta — must use glslMod, never %.
  let h = glslMod(glslMod(hsl.x * 360.0 + dH, 360.0) + 360.0, 360.0) / 360.0;
  let s = applySlider(hsl.y, clamp(dS, -100.0, 100.0));
  let l = applySlider(hsl.z, clamp(dL, -100.0, 100.0));
  return hslToRgb(h, s, l);
}
fn applyVibrance(c: vec3<f32>) -> vec3<f32> {
  let hsl = rgbToHsl(c);
  if (hsl.y == 0.0) {
    return c; // zero-saturation guard — GLSL's own early-out
  }
  let vibranceAmt = u.params[0].x / 100.0;
  let saturationAmt = u.params[0].y / 100.0;
  let boost = hsl.y * (1.0 - hsl.y) * vibranceAmt;
  let newS = clamp(hsl.y + boost + saturationAmt, 0.0, 1.0);
  return hslToRgb(hsl.x, newS, hsl.z);
}
fn applySelectiveColor(c: vec3<f32>) -> vec3<f32> {
  let rw9 = computeRangeWeights9(c);
  var w: array<f32, 9>;
  w[0] = rw9.chromaticLow.x; w[1] = rw9.chromaticLow.y; w[2] = rw9.chromaticLow.z;
  w[3] = rw9.chromaticHigh.x; w[4] = rw9.chromaticHigh.y; w[5] = rw9.chromaticHigh.z;
  // whites,neutrals,blacks order matches JS "whites,neutrals,blacks".
  w[6] = rw9.achromatic.z; w[7] = rw9.achromatic.y; w[8] = rw9.achromatic.x;
  let absolute = u.params[0].x > 0.5;
  let cyanInk = 1.0 - c.r; let magentaInk = 1.0 - c.g; let yellowInk = 1.0 - c.b;
  var dr = 0.0; var dg = 0.0; var db = 0.0;
  for (var i = 0; i < 9; i++) {
    let adj = u.params[1 + i]; // cyan, magenta, yellow, black (0..100 scale)
    let wv = w[i];
    if (wv == 0.0) {
      continue; // skip a range with zero weight at this pixel
    }
    let scaleR = select(cyanInk, 1.0, absolute);
    let scaleG = select(magentaInk, 1.0, absolute);
    let scaleB = select(yellowInk, 1.0, absolute);
    dr = dr - wv * (adj.x / 100.0) * scaleR;
    dg = dg - wv * (adj.y / 100.0) * scaleG;
    db = db - wv * (adj.z / 100.0) * scaleB;
    dr = dr - wv * (adj.w / 100.0) * scaleR;
    dg = dg - wv * (adj.w / 100.0) * scaleG;
    db = db - wv * (adj.w / 100.0) * scaleB;
  }
  return clamp(c + vec3<f32>(dr, dg, db), vec3<f32>(0.0), vec3<f32>(1.0));
}
fn applyReplaceColor(c: vec3<f32>, alpha: f32) -> vec3<f32> {
  // replaceColor.ts's applyReplaceColor skips any pixel whose (frozen
  // sample) alpha is exactly 0 — never touches fully-transparent texels.
  if (alpha == 0.0) {
    return c;
  }
  let targetFuzz = u.params[0];
  let targetRgb = targetFuzz.rgb / 255.0; // "target" is a WGSL reserved keyword
  let fuzziness = targetFuzz.w / 255.0;
  let d = abs(c - targetRgb);
  if (d.r > fuzziness || d.g > fuzziness || d.b > fuzziness) {
    return c;
  }
  let hslAdj = u.params[1];
  let hsl = rgbToHsl(c);
  // HAZARD: hslAdj.x is a SIGNED hue delta — glslMod, never %.
  let h = glslMod(glslMod(hsl.x * 360.0 + hslAdj.x, 360.0) + 360.0, 360.0) / 360.0;
  let s = applySlider(hsl.y, clamp(hslAdj.y, -100.0, 100.0));
  let l = applySlider(hsl.z, clamp(hslAdj.z, -100.0, 100.0));
  return hslToRgb(h, s, l);
}
fn applyBlackAndWhite(c: vec3<f32>) -> vec3<f32> {
  let sliders1 = u.params[0]; // reds,yellows,greens,cyans
  let sliders2 = u.params[1]; // blues,magentas,_,_
  let tintP = u.params[2]; // tint flag, hue, sat, _
  let mx = max(c.r, max(c.g, c.b));
  let mn = min(c.r, min(c.g, c.b));
  let mid = c.r + c.g + c.b - mx - mn;
  var primary: f32;
  var secondary: f32;
  if (mx == c.r) {
    primary = sliders1.x; // reds
    secondary = select(sliders2.y, sliders1.y, c.g >= c.b); // yellows : magentas
  } else if (mx == c.g) {
    primary = sliders1.z; // greens
    secondary = select(sliders1.w, sliders1.y, c.r >= c.b); // yellows : cyans
  } else {
    primary = sliders2.x; // blues
    secondary = select(sliders2.y, sliders1.w, c.g >= c.r); // cyans : magentas
  }
  let lum = clamp(
    mn + (mid - mn) * (secondary / 100.0) + (mx - mid) * (primary / 100.0),
    0.0,
    1.0,
  );
  if (tintP.x > 0.5) {
    // tintP.y (hue) AND tintP.z (saturation) are BOTH already 0..1
    // fractions — rgbToHsl's own domain — NOT 0..360/0..100 slider
    // values, so neither gets a /360 or /100 here.
    return hslToRgb(tintP.y, tintP.z, lum);
  }
  return vec3<f32>(lum);
}

@fragment
fn ${y}(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let p = vec2<i32>(i32(fragCoord.x), i32(fragCoord.y));
  let src = textureLoad(u_source, p, 0);
  let rgb = src.rgb;
  var result = rgb;
  switch (u.typeId) {
    case 0: { result = applyChannelMixer(rgb); }
    case 1: { result = applyColorBalance(rgb); }
    case 2: { result = applyHueSaturation(rgb); }
    case 3: { result = applyVibrance(rgb); }
    case 4: { result = applySelectiveColor(rgb); }
    case 5: { result = applyReplaceColor(rgb, src.a); }
    case 6: { result = applyBlackAndWhite(rgb); }
    default: { }
  }
  return vec4<f32>(result, src.a); // A1: alpha passed through unchanged
}
`,S="vs_colorLookup3d",T="fs_colorLookup3d",B=`
// C5: three scalars + one flag, no arrays -- no 16-byte array-stride
// hazard here (unlike the direct-adjustment shader's params array above).
struct ColorLookup3dUniforms {
  ditherFlag: i32,
  lutSize: f32,
  coordOffsetX: f32,
  coordOffsetY: f32,
}

@group(0) @binding(0) var u_source: texture_2d<f32>;      // mainTex snapshot, STRAIGHT alpha
@group(0) @binding(1) var u_lut3d: texture_3d<f32>;       // NxNxN rgba8unorm, alpha unused
@group(0) @binding(2) var u_lutSampler: sampler;          // linear/linear, clamp-to-edge UVW
@group(0) @binding(3) var<uniform> u: ColorLookup3dUniforms;

@vertex
fn ${S}(@location(0) a_corner: vec2<f32>) -> @builtin(position) vec4<f32> {
  // No Y-flip (deliberately unlike the LUT/direct-adjustment vertex
  // shaders above): this fragment stage reads u_source and writes its
  // result purely by fragCoord, never by an interpolated UV varying from
  // this vertex stage, so a full-screen quad's winding/orientation has
  // zero effect on which texel lands where -- same reasoning as
  // WGSL_PRESENT_SHADER in blendShaders.wgsl.ts.
  let clip = a_corner * 2.0 - vec2<f32>(1.0, 1.0);
  return vec4<f32>(clip.x, clip.y, 0.0, 1.0);
}

// Port of gradientMapFilter.ts's bayerDitherOffset / the GLSL twin's
// BAYER4 -- identical flattened table (row-major, y*4+x).
const BAYER4 = array<i32, 16>(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
fn bayerDitherOffset(x: i32, y: i32, strength: f32) -> f32 {
  let idx = (y & 3) * 4 + (x & 3);
  return ((f32(BAYER4[idx]) + 0.5) / 16.0 - 0.5) * strength;
}

@fragment
fn ${T}(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let p = vec2<i32>(i32(fragCoord.x), i32(fragCoord.y));
  let src = textureLoad(u_source, p, 0);
  // Half-texel-inset 3D-LUT formula: grid index i -> texel center (i+0.5)/N.
  let uvw = (src.rgb * (u.lutSize - 1.0) + 0.5) / u.lutSize;
  var sampled = textureSample(u_lut3d, u_lutSampler, uvw).rgb;
  if (u.ditherFlag != 0) {
    let gx = p.x + i32(u.coordOffsetX);
    let gy = p.y + i32(u.coordOffsetY);
    let offset = bayerDitherOffset(gx, gy, 8.0) / 255.0;
    sampled = clamp(sampled + vec3<f32>(offset), vec3<f32>(0.0), vec3<f32>(1.0));
  }
  // A1: straight alpha passes through unchanged.
  return vec4<f32>(sampled, src.a);
}
`,k="rgba8unorm";class I extends c.BackendUnavailableError{constructor(e){super(`WebGPUBackend: cannot be constructed — ${e}`),this.name="BackendUnavailableWebGPUError"}}class L{capabilities;device;static TILE_CACHE_BUDGET_BYTES=0x4000000;tiles=new s.TileCache(L.TILE_CACHE_BUDGET_BYTES);disposed=!1;lostReason=null;pipeline=null;quadBuffer=null;uniformBuffer=null;presentFormat;presentPipeline=null;presentBindGroup=null;presentSurface=null;presentContext=null;mainTex=null;mainWidth=0;mainHeight=0;lutPipeline=null;lutUniformBuffer=null;lutSourceTex=null;lutSourceWidth=0;lutSourceHeight=0;directPipeline=null;directUniformBuffer=null;directBindGroup=null;directBindGroupTex=null;colorLookup3dPipeline=null;lut3dSampler=null;colorLookup3dUniformBuf=null;static LUT_3D_SIZE=33;backdropTex=null;layerTex=null;maskTex=null;outputTex=null;bindGroup=null;stackScratchTex=null;stackAccumA=null;stackAccumB=null;stackWidth=0;stackHeight=0;stackMaskTex=null;stackMaskWidth=0;stackMaskHeight=0;constructor(e,t,i,s){this.device=e,this.presentFormat=i,e.lost?.then(e=>{"destroyed"!==e.reason&&(this.lostReason=e.message||e.reason||"unknown")}),this.capabilities={kind:"webgpu",maxTextureSize:Math.min(r.MAX_CANVAS_DIMENSION,t),nonSeparableBlendInBackend:!0,supportedBlendModes:new Set([...o.BLEND_MODES,...o.EXTENDED_BLEND_MODES]),colorLookup3d:s>=L.LUT_3D_SIZE}}static async create(e){let t,r;if("u"<typeof navigator||!("gpu"in navigator))throw new I("navigator.gpu is not present");try{t=await navigator.gpu.requestAdapter()}catch(e){throw new I(`requestAdapter() rejected: ${String(e)}`)}if(!t)throw new I("requestAdapter() resolved null");try{r=await t.requestDevice()}catch(e){throw new I(`requestDevice() rejected: ${String(e)}`)}let i=navigator.gpu.getPreferredCanvasFormat?.()??k,s=new L(r,t.limits.maxTextureDimension2D,i,t.limits.maxTextureDimension3D??0);try{await s.initPipeline()}catch(e){throw s.destroy(),new I(`pipeline construction failed: ${String(e)}`)}return s}async initPipeline(){let e=this.device.createShaderModule({code:b}),t=(await e.getCompilationInfo()).messages.filter(e=>"error"===e.type);if(t.length>0)throw Error(`WGSL compilation error(s): ${t.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join("; ")}`);this.pipeline=this.device.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:u,buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:e,entryPoint:d,targets:[{format:k}]},primitive:{topology:"triangle-strip"}}),this.quadBuffer=this.device.createBuffer({size:32,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.quadBuffer,0,new Float32Array([0,0,1,0,0,1,1,1])),this.uniformBuffer=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let r=this.device.createShaderModule({code:m}),i=(await r.getCompilationInfo()).messages.filter(e=>"error"===e.type);if(i.length>0)throw Error(`WGSL present-shader compilation error(s): ${i.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join("; ")}`);this.presentPipeline=this.device.createRenderPipeline({layout:"auto",vertex:{module:r,entryPoint:h,buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:r,entryPoint:f,targets:[{format:this.presentFormat}]},primitive:{topology:"triangle-strip"}});let s=this.device.createShaderModule({code:x}),a=(await s.getCompilationInfo()).messages.filter(e=>"error"===e.type);if(a.length>0)throw Error(`WGSL LUT-shader compilation error(s): ${a.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join("; ")}`);this.lutPipeline=this.device.createRenderPipeline({layout:"auto",vertex:{module:s,entryPoint:p,buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:s,entryPoint:g,targets:[{format:k}]},primitive:{topology:"triangle-strip"}}),this.lutUniformBuffer=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});let l=this.device.createShaderModule({code:w}),o=(await l.getCompilationInfo()).messages.filter(e=>"error"===e.type);if(o.length>0)throw Error(`WGSL direct-adjustment-shader compilation error(s): ${o.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join("; ")}`);if(this.directPipeline=this.device.createRenderPipeline({layout:"auto",vertex:{module:l,entryPoint:v,buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:l,entryPoint:y,targets:[{format:k}]},primitive:{topology:"triangle-strip"}}),this.directUniformBuffer=this.device.createBuffer({size:176,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.capabilities.colorLookup3d){let e=this.device.createShaderModule({code:B,label:"colorLookup3d"}),t=(await e.getCompilationInfo()).messages.filter(e=>"error"===e.type);if(t.length>0)throw Error(`WGSL colorLookup3d-shader compilation error(s): ${t.map(e=>`${e.lineNum}:${e.linePos} ${e.message}`).join("; ")}`);this.colorLookup3dPipeline=this.device.createRenderPipeline({layout:"auto",vertex:{module:e,entryPoint:S,buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:e,entryPoint:T,targets:[{format:k}]},primitive:{topology:"triangle-strip"}}),this.lut3dSampler=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",addressModeW:"clamp-to-edge",label:"colorLookup3d-sampler"}),this.colorLookup3dUniformBuf=this.device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,label:"colorLookup3d-uniform"})}}ensureTile(e,t,r,i,s){return this.tiles.ensureTile(e,t,r,i,s)}peekTile(e,t,r,i,s){return this.tiles.peekTile(e,t,r,i,s)}beginBatch(){this.tiles.beginBatch()}endBatch(){this.tiles.endBatch()}releaseLayer(e){this.tiles.releaseLayer(e)}stats(){return this.tiles.stats()}destroy(){this.mainTex?.destroy(),this.backdropTex?.destroy(),this.layerTex?.destroy(),this.maskTex?.destroy(),this.outputTex?.destroy(),this.destroyStackRunResources(),this.quadBuffer?.destroy(),this.uniformBuffer?.destroy(),this.lutSourceTex?.destroy(),this.lutUniformBuffer?.destroy(),this.lutSourceTex=null,this.lutSourceWidth=0,this.lutSourceHeight=0,this.lutUniformBuffer=null,this.lutPipeline=null,this.directUniformBuffer?.destroy(),this.directUniformBuffer=null,this.directPipeline=null,this.directBindGroup=null,this.directBindGroupTex=null,this.colorLookup3dUniformBuf?.destroy(),this.colorLookup3dUniformBuf=null,this.colorLookup3dPipeline=null,this.lut3dSampler=null,this.presentContext?.unconfigure(),this.presentContext=null,this.presentSurface=null,this.presentBindGroup=null,this.presentPipeline=null,this.device.destroy(),this.tiles.clear(),this.disposed=!0}async dispose(){this.destroy()}assertNotDisposed(){if(this.disposed)throw new c.BackendDisposedError("WebGPUBackend");if(null!==this.lostReason)throw new c.BackendContextLostError("WebGPUBackend",this.lostReason)}get isLost(){return null!==this.lostReason}beginTarget(e){if(this.assertNotDisposed(),e.width>this.capabilities.maxTextureSize||e.height>this.capabilities.maxTextureSize)throw Error(`WebGPUBackend.beginTarget: ${e.width}\xd7${e.height} exceeds maxTextureSize ${this.capabilities.maxTextureSize}`);this.mainTex&&this.mainWidth===e.width&&this.mainHeight===e.height||(this.mainTex?.destroy(),this.mainTex=this.device.createTexture({size:{width:e.width,height:e.height},format:k,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC|GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING}),this.mainWidth=e.width,this.mainHeight=e.height,this.presentBindGroup=null,this.lutSourceTex?.destroy(),this.lutSourceTex=null,this.directBindGroup=null,this.directBindGroupTex=null);let t=this.device.createCommandEncoder();t.beginRenderPass({colorAttachments:[{view:this.mainTex.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]}).end(),this.device.queue.submit([t.finish()])}ensureDefaultMaskTex(){return this.maskTex||(this.maskTex=this.device.createTexture({size:{width:1,height:1},format:k,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.device.queue.writeTexture({texture:this.maskTex},new Uint8Array([255,255,255,255]),{bytesPerRow:4},{width:1,height:1})),this.maskTex}ensureTileResources(){if(this.backdropTex)return;let e=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST;this.backdropTex=this.device.createTexture({size:{width:t.TILE_SIZE,height:t.TILE_SIZE},format:k,usage:e}),this.layerTex=this.device.createTexture({size:{width:t.TILE_SIZE,height:t.TILE_SIZE},format:k,usage:e});let r=this.ensureDefaultMaskTex();this.outputTex=this.device.createTexture({size:{width:t.TILE_SIZE,height:t.TILE_SIZE},format:k,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),this.bindGroup=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.backdropTex.createView()},{binding:1,resource:this.layerTex.createView()},{binding:2,resource:r.createView()},{binding:3,resource:{buffer:this.uniformBuffer}}]})}ensureLutSourceTex(){return this.lutSourceTex&&this.lutSourceWidth===this.mainWidth&&this.lutSourceHeight===this.mainHeight||(this.lutSourceTex?.destroy(),this.lutSourceTex=this.device.createTexture({size:{width:this.mainWidth,height:this.mainHeight},format:k,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.lutSourceWidth=this.mainWidth,this.lutSourceHeight=this.mainHeight),this.lutSourceTex}applyLutPass(e){if(this.assertNotDisposed(),!this.mainTex)throw Error("WebGPUBackend.applyLutPass: no current target — call beginTarget() first");if(1024!==e.data.length)throw Error(`WebGPUBackend.applyLutPass: lut.data must be 1024 bytes (256\xd7RGBA), got ${e.data.length}`);let t=this.ensureLutSourceTex(),r=this.device.createTexture({size:{width:256,height:1},format:k,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});try{this.device.queue.writeTexture({texture:r},e.data,{bytesPerRow:1024},{width:256,height:1});let i=new ArrayBuffer(16);new DataView(i).setInt32(0,+("perChannel"!==e.mode),!0),this.device.queue.writeBuffer(this.lutUniformBuffer,0,i);let s=this.device.createBindGroup({layout:this.lutPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:t.createView()},{binding:1,resource:r.createView()},{binding:2,resource:{buffer:this.lutUniformBuffer}}]}),a=this.device.createCommandEncoder();a.copyTextureToTexture({texture:this.mainTex},{texture:t},{width:this.mainWidth,height:this.mainHeight});let l=a.beginRenderPass({colorAttachments:[{view:this.mainTex.createView(),loadOp:"load",storeOp:"store"}]});l.setPipeline(this.lutPipeline),l.setVertexBuffer(0,this.quadBuffer),l.setBindGroup(0,s),l.draw(4),l.end(),this.device.queue.submit([a.finish()])}finally{r.destroy()}}applyDirectAdjustmentPass(e,t){if(this.assertNotDisposed(),!this.mainTex)throw Error("WebGPUBackend.applyDirectAdjustmentPass: no current target — call beginTarget() first");let r=this.ensureLutSourceTex();this.device.queue.writeBuffer(this.directUniformBuffer,0,function(e,t){if(40!==t.length)throw Error(`packDirectAdjustmentUniformBuffer: expected 40 floats, got ${t.length}`);let r=new ArrayBuffer(176);return new DataView(r).setInt32(0,0|e,!0),new Float32Array(r,16,40).set(t),r}(e,t)),(null===this.directBindGroup||this.directBindGroupTex!==r)&&(this.directBindGroup=this.device.createBindGroup({layout:this.directPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:r.createView()},{binding:1,resource:{buffer:this.directUniformBuffer}}]}),this.directBindGroupTex=r);let i=this.device.createCommandEncoder();i.copyTextureToTexture({texture:this.mainTex},{texture:r},{width:this.mainWidth,height:this.mainHeight});let s=i.beginRenderPass({colorAttachments:[{view:this.mainTex.createView(),loadOp:"load",storeOp:"store"}]});s.setPipeline(this.directPipeline),s.setVertexBuffer(0,this.quadBuffer),s.setBindGroup(0,this.directBindGroup),s.draw(4),s.end(),this.device.queue.submit([i.finish()])}applyColorLookup3dPass(e,t,r,i){if(this.assertNotDisposed(),!this.capabilities.colorLookup3d||!this.colorLookup3dPipeline)throw Error("WebGPUBackend.applyColorLookup3dPass: capabilities.colorLookup3d is false");if(!this.mainTex)throw Error("WebGPUBackend.applyColorLookup3dPass: no current target — call beginTarget() first");if(e.length!==t*t*t*4)throw Error(`WebGPUBackend.applyColorLookup3dPass: expected ${t*t*t*4} RGBA bytes for size ${t}, got ${e.length}`);let s=this.ensureLutSourceTex(),a=this.device.createTexture({size:{width:t,height:t,depthOrArrayLayers:t},dimension:"3d",format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST,label:"colorLookup3d-lut"});try{this.device.queue.writeTexture({texture:a},e,{offset:0,bytesPerRow:4*t,rowsPerImage:t},{width:t,height:t,depthOrArrayLayers:t});let l=new ArrayBuffer(16);new Int32Array(l,0,1)[0]=+!!r;let o=new Float32Array(l,4,3);o[0]=t,o[1]=i.x,o[2]=i.y,this.device.queue.writeBuffer(this.colorLookup3dUniformBuf,0,l);let n=this.device.createBindGroup({layout:this.colorLookup3dPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:s.createView()},{binding:1,resource:a.createView({dimension:"3d"})},{binding:2,resource:this.lut3dSampler},{binding:3,resource:{buffer:this.colorLookup3dUniformBuf}}]}),c=this.device.createCommandEncoder({label:"colorLookup3d"});c.copyTextureToTexture({texture:this.mainTex},{texture:s},{width:this.mainWidth,height:this.mainHeight});let u=c.beginRenderPass({colorAttachments:[{view:this.mainTex.createView(),loadOp:"load",storeOp:"store"}]});u.setPipeline(this.colorLookup3dPipeline),u.setVertexBuffer(0,this.quadBuffer),u.setBindGroup(0,n),u.draw(4),u.end(),this.device.queue.submit([c.finish()])}finally{a.destroy()}}compositeTile(e,r,i,s,a){this.assertNotDisposed();let l=this.tiles.findBySlice(e),o=r*t.TILE_SIZE,c=i*t.TILE_SIZE;this.ensureTileResources(),this.device.queue.writeTexture({texture:this.layerTex},l.data,{bytesPerRow:4*t.TILE_SIZE},{width:t.TILE_SIZE,height:t.TILE_SIZE});let u=new ArrayBuffer(16),d=new DataView(u);d.setInt32(0,0,!0),d.setFloat32(4,E(a),!0),d.setInt32(8,n.GPU_BLEND_MODE_ID[s]??0,!0),d.setInt32(12,0,!0),this.device.queue.writeBuffer(this.uniformBuffer,0,u);let h=this.device.createCommandEncoder();h.copyTextureToTexture({texture:this.mainTex,origin:{x:o,y:c}},{texture:this.backdropTex},{width:t.TILE_SIZE,height:t.TILE_SIZE});let f=h.beginRenderPass({colorAttachments:[{view:this.outputTex.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});f.setPipeline(this.pipeline),f.setVertexBuffer(0,this.quadBuffer),f.setBindGroup(0,this.bindGroup),f.draw(4),f.end(),h.copyTextureToTexture({texture:this.outputTex},{texture:this.mainTex,origin:{x:o,y:c}},{width:t.TILE_SIZE,height:t.TILE_SIZE}),this.device.queue.submit([h.finish()])}compositeLayer(e,t){this.assertNotDisposed();let r=(0,l.pixelSourceOf)(e);if(r&&"tiled"===r.kind){this.beginBatch();try{for(let[i,s]of r.grid.tiles){let[r,a]=i.split(","),l=Number(r),o=Number(a),n=this.ensureTile(e.id,t.level,l,o,s);this.compositeTile(n,l,o,e.blendMode,e.opacity??1)}}finally{this.endBatch()}}}ensureStackRunResources(e,t){if(!this.stackScratchTex||this.stackWidth!==e||this.stackHeight!==t){this.destroyStackRunResources();try{let r=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST,i={width:e,height:t};this.stackScratchTex=this.device.createTexture({size:i,format:k,usage:r});let s=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT;this.stackAccumA=this.device.createTexture({size:i,format:k,usage:s}),this.stackAccumB=this.device.createTexture({size:i,format:k,usage:s})}catch(e){throw this.destroyStackRunResources(),e}this.stackWidth=e,this.stackHeight=t}}ensureStackMaskTex(e,t){return this.stackMaskTex&&this.stackMaskWidth===e&&this.stackMaskHeight===t||(this.stackMaskTex?.destroy(),this.stackMaskTex=null,this.stackMaskWidth=this.stackMaskHeight=0,this.stackMaskTex=this.device.createTexture({size:{width:e,height:t},format:k,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),this.stackMaskWidth=e,this.stackMaskHeight=t),this.stackMaskTex}destroyStackRunResources(){this.stackScratchTex?.destroy(),this.stackAccumA?.destroy(),this.stackAccumB?.destroy(),this.stackMaskTex?.destroy(),this.stackScratchTex=this.stackAccumA=this.stackAccumB=null,this.stackMaskTex=null,this.stackWidth=this.stackHeight=0,this.stackMaskWidth=this.stackMaskHeight=0}async compositeStackRun(e){this.assertNotDisposed();let{originX:r,originY:i,width:s,height:a,members:l}=e;if(0===l.length)throw Error("WebGPUBackend.compositeStackRun: stack run has zero members");if(!Number.isInteger(r)||!Number.isInteger(i)||!Number.isInteger(s)||!Number.isInteger(a)||r<0||i<0||s<=0||a<=0)throw Error(`WebGPUBackend.compositeStackRun: originX/originY/width/height must be non-negative integers with width/height > 0 (got ${r},${i} ${s}\xd7${a})`);if(s>this.capabilities.maxTextureSize||a>this.capabilities.maxTextureSize)throw Error(`WebGPUBackend.compositeStackRun: ${s}\xd7${a} exceeds maxTextureSize ${this.capabilities.maxTextureSize}`);if(!this.mainTex||this.mainWidth!==s||this.mainHeight!==a)throw Error(`WebGPUBackend.compositeStackRun: target is ${this.mainWidth}\xd7${this.mainHeight}, run is ${s}\xd7${a} — call beginTarget({ width, height }) first`);let o=[],u=s*a*4;this.beginBatch();try{let e;for(let e of l){let t=n.GPU_BLEND_MODE_ID[e.blendMode];if(void 0===t)throw Error(`WebGPUBackend.compositeStackRun: unimplemented blend mode ${e.blendMode}`);if(o.push(t),e.mask&&e.mask.byteLength!==u)throw Error(`WebGPUBackend.compositeStackRun: mask size mismatch (expected ${u} bytes, got ${e.mask.byteLength})`);for(let t of e.tiles){if(!Number.isInteger(t.tx)||!Number.isInteger(t.ty))throw Error(`WebGPUBackend.compositeStackRun: tile coordinates must be integers (got ${t.tx},${t.ty})`);this.tiles.findBySlice(t.ref)}}let d=this.ensureDefaultMaskTex();this.ensureStackRunResources(s,a);let h=this.stackScratchTex,f=this.pipeline.getBindGroupLayout(0);this.device.pushErrorScope?.("validation");try{{let e=this.device.createCommandEncoder();_(e,this.stackAccumA),_(e,h),this.device.queue.submit([e.finish()])}let e=this.stackAccumA,n=this.stackAccumB;for(let c=0;c<l.length;c++){let u,m=l[c],b=c===l.length-1;for(let e of m.tiles){let l=function(e,r,i,s,a,l){let o=e*t.TILE_SIZE-i,n=r*t.TILE_SIZE-s,c=Math.max(0,o),u=Math.max(0,n),d=Math.min(a,o+t.TILE_SIZE),h=Math.min(l,n+t.TILE_SIZE);return d<=c||h<=u?null:{dstX:c,dstY:u,srcOffsetBytes:((u-n)*t.TILE_SIZE+(c-o))*4,width:d-c,height:h-u}}(e.tx,e.ty,r,i,s,a);if(!l)continue;let o=this.tiles.findBySlice(e.ref);this.device.queue.writeTexture({texture:h,origin:{x:l.dstX,y:l.dstY}},o.data,{offset:l.srcOffsetBytes,bytesPerRow:4*t.TILE_SIZE},{width:l.width,height:l.height})}if(m.mask){let e=this.ensureStackMaskTex(s,a);this.device.queue.writeTexture({texture:e},m.mask,{bytesPerRow:4*s},{width:s,height:a}),u=e.createView()}else u=d.createView();let p=new ArrayBuffer(16),g=new DataView(p);g.setInt32(0,+!!m.mask,!0),g.setFloat32(4,E(m.opacity),!0),g.setInt32(8,o[c],!0),g.setInt32(12,(m.dissolveSeed??0)|0,!0),this.device.queue.writeBuffer(this.uniformBuffer,0,p);let x=this.device.createBindGroup({layout:f,entries:[{binding:0,resource:e.createView()},{binding:1,resource:h.createView()},{binding:2,resource:u},{binding:3,resource:{buffer:this.uniformBuffer}}]}),v=b?this.mainTex:n,y=this.device.createCommandEncoder(),w=y.beginRenderPass({colorAttachments:[{view:v.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});if(w.setPipeline(this.pipeline),w.setVertexBuffer(0,this.quadBuffer),w.setBindGroup(0,x),w.draw(4),w.end(),b||_(y,h),this.device.queue.submit([y.finish()]),!b){let t=e;e=n,n=t}}}catch(e){try{await this.device.popErrorScope?.()}catch{}throw e}try{e=await this.device.popErrorScope?.()}catch{e=null}if(null!==this.lostReason)throw new c.BackendContextLostError("WebGPUBackend",this.lostReason);if(e)throw Error(`WebGPUBackend.compositeStackRun: GPU validation error — ${e.message}`)}finally{this.endBatch()}}async endTarget(){let e;this.assertNotDisposed();let t=this.mainWidth,r=this.mainHeight,i=4*t,s=256*Math.ceil(i/256),l=this.device.createBuffer({size:s*r,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let i=this.device.createCommandEncoder();i.copyTextureToBuffer({texture:this.mainTex},{buffer:l,bytesPerRow:s},{width:t,height:r}),this.device.queue.submit([i.finish()]),await l.mapAsync(GPUMapMode.READ),e=new Uint8ClampedArray(l.getMappedRange().slice(0)),l.unmap()}finally{l.destroy()}let o=new Uint8ClampedArray(i*r);for(let t=0;t<r;t++){let r=t*s;o.set(e.subarray(r,r+i),t*i)}return createImageBitmap((0,a.toBrowserImageData)(o,t,r))}presentToSurface(e){if(this.assertNotDisposed(),!this.mainTex)throw Error("WebGPUBackend.presentToSurface: no target — call beginTarget() first");let t=this.mainWidth,r=this.mainHeight;if(t>this.capabilities.maxTextureSize||r>this.capabilities.maxTextureSize)throw Error(`WebGPUBackend.presentToSurface: ${t}\xd7${r} exceeds maxTextureSize ${this.capabilities.maxTextureSize}`);if(this.presentSurface!==e||e.width!==t||e.height!==r){let i=e.getContext("webgpu");if(!i)throw new I("presentToSurface: surface.getContext('webgpu') returned null");this.presentContext&&this.presentContext!==i&&this.presentContext.unconfigure(),e.width=t,e.height=r,i.configure({device:this.device,format:this.presentFormat,alphaMode:"premultiplied"}),this.presentSurface=e,this.presentContext=i,this.presentBindGroup=null}this.presentBindGroup||(this.presentBindGroup=this.device.createBindGroup({layout:this.presentPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.mainTex.createView()}]}));let i=this.presentContext.getCurrentTexture(),s=this.device.createCommandEncoder(),a=s.beginRenderPass({colorAttachments:[{view:i.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]});return a.setPipeline(this.presentPipeline),a.setVertexBuffer(0,this.quadBuffer),a.setBindGroup(0,this.presentBindGroup),a.draw(4),a.end(),this.device.queue.submit([s.finish()]),e.transferToImageBitmap()}}function E(e){return e<0?0:e>1?1:e}function _(e,t){e.beginRenderPass({colorAttachments:[{view:t.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:"clear",storeOp:"store"}]}).end()}e.s(["BackendUnavailableWebGPUError",0,I,"WebGPUBackend",0,L],904566),e.s([],792834),e.s([],169460),e.s(["publishTile",0,function(e,t){return{data:e,rev:t}},"tileKey",0,function(e,t){return`${e},${t}`}],193378)}]);