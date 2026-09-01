(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,935451,(e,t,r)=>{var o={156:function(e){var t,r,o,a=e.exports={};function i(){throw Error("setTimeout has not been defined")}function l(){throw Error("clearTimeout has not been defined")}try{t="function"==typeof setTimeout?setTimeout:i}catch(e){t=i}try{r="function"==typeof clearTimeout?clearTimeout:l}catch(e){r=l}function n(e){if(t===setTimeout)return setTimeout(e,0);if((t===i||!t)&&setTimeout)return t=setTimeout,setTimeout(e,0);try{return t(e,0)}catch(r){try{return t.call(null,e,0)}catch(r){return t.call(this,e,0)}}}var c=[],s=!1,u=-1;function d(){s&&o&&(s=!1,o.length?c=o.concat(c):u=-1,c.length&&f())}function f(){if(!s){var e=n(d);s=!0;for(var t=c.length;t;){for(o=c,c=[];++u<t;)o&&o[u].run();u=-1,t=c.length}o=null,s=!1,function(e){if(r===clearTimeout)return clearTimeout(e);if((r===l||!r)&&clearTimeout)return r=clearTimeout,clearTimeout(e);try{r(e)}catch(t){try{return r.call(null,e)}catch(t){return r.call(this,e)}}}(e)}}function m(e,t){this.fun=e,this.array=t}function h(){}a.nextTick=function(e){var t=Array(arguments.length-1);if(arguments.length>1)for(var r=1;r<arguments.length;r++)t[r-1]=arguments[r];c.push(new m(e,t)),1!==c.length||s||n(f)},m.prototype.run=function(){this.fun.apply(null,this.array)},a.title="browser",a.browser=!0,a.env={},a.argv=[],a.version="",a.versions={},a.on=h,a.addListener=h,a.once=h,a.off=h,a.removeListener=h,a.removeAllListeners=h,a.emit=h,a.prependListener=h,a.prependOnceListener=h,a.listeners=function(e){return[]},a.binding=function(e){throw Error("process.binding is not supported")},a.cwd=function(){return"/"},a.chdir=function(e){throw Error("process.chdir is not supported")},a.umask=function(){return 0}}},a={};function i(e){var t=a[e];if(void 0!==t)return t.exports;var r=a[e]={exports:{}},l=!0;try{o[e](r,r.exports,i),l=!1}finally{l&&delete a[e]}return r.exports}i.ab="/ROOT/node_modules/next/dist/compiled/process/",t.exports=i(156)},247167,(e,t,r)=>{"use strict";var o,a;t.exports=(null==(o=e.g.process)?void 0:o.env)&&"object"==typeof(null==(a=e.g.process)?void 0:a.env)?e.g.process:e.r(935451)},193378,e=>{"use strict";e.i(247167),e.s(["publishTile",0,function(e,t){return{data:e,rev:t}},"tileKey",0,function(e,t){return`${e},${t}`}])},791057,e=>{"use strict";e.s(["TILE_SIZE",0,256])},46801,e=>{"use strict";var t=e.i(322623),r=e.i(628339),o=e.i(694053);let a=new Set(["levels","curves","posterize","brightnessContrast","exposure","invert","threshold","gradientMap","photoFilter"]),i=new Set(["threshold","gradientMap"]);e.s(["applyLutPassReference",0,function(e,t,r){if("perChannel"===r){for(let r=0;r<e.length;r+=4)e[r]=t[4*e[r]],e[r+1]=t[4*e[r+1]+1],e[r+2]=t[4*e[r+2]+2];return}for(let r=0;r<e.length;r+=4){let o=e[r],a=e[r+1],i=e[r+2],l=4*Math.max(0,Math.min(255,Math.round(.299*o+.587*a+.114*i))),n=t[l],c=t[l+1],s=t[l+2],u=t[l+3]/255;e[r]=n*u+o*(1-u),e[r+1]=c*u+a*(1-u),e[r+2]=s*u+i*(1-u)}},"bakeAdjustmentLUT",0,function(e,a,l,n){if("gradientMap"===e){let e=a??o.DEFAULT_GRADIENT_MAP_VALUES,t=(0,r.resolveGradientById)(e.gradientId,l,n),i=(0,r.buildGradientMapLUT)(t,e.reverse),c=new Uint8Array(1024);return c.set(i),{data:c,mode:"lumaIndexed"}}let c=function(){let e=new Uint8ClampedArray(1024);for(let t=0;t<256;t++)e[4*t]=t,e[4*t+1]=t,e[4*t+2]=t,e[4*t+3]=255;return new ImageData(e,256,1)}();(0,t.buildAdjustmentFilter)(e,a,l,n)(c);let s=new Uint8Array(1024);for(let e=0;e<256;e++)s[4*e]=c.data[4*e],s[4*e+1]=c.data[4*e+1],s[4*e+2]=c.data[4*e+2],s[4*e+3]=c.data[4*e+3];return{data:s,mode:i.has(e)?"lumaIndexed":"perChannel"}},"isLutBypassEligible",0,function(e){let t=e.adjustmentType;return!(!t||!a.has(t)||e.mask?.enabled)&&("gradientMap"!==t||!(e.gradientMap??o.DEFAULT_GRADIENT_MAP_VALUES).dither)&&("photoFilter"!==t||!(e.photoFilter??o.DEFAULT_PHOTO_FILTER_VALUES).preserveLuminosity)&&!0}])},65956,e=>{"use strict";var t=e.i(592605);let r={channelMixer:0,colorBalance:1,hueSaturation:2,vibrance:3,selectiveColor:4,replaceColor:5,blackAndWhite:6},o=new Set(Object.keys(r)),a=["reds","yellows","greens","cyans","blues","magentas"],i=`#version 300 es
layout(location = 0) in vec2 a_corner;
void main() {
  vec2 clip = a_corner * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`,l=`#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform int u_type;
uniform vec4 u_p[10];
out vec4 outColor;

// hueSaturationFilter.ts's rgbToHsl/hslToRgb, ported 1:1 (0..1 domain).
vec3 rgbToHsl(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float l = (mx + mn) * 0.5;
  if (mx == mn) return vec3(0.0, 0.0, l);
  float d = mx - mn;
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if (mx == c.r) h = mod((c.g - c.b) / d, 6.0) / 6.0;
  else if (mx == c.g) h = ((c.b - c.r) / d + 2.0) / 6.0;
  else h = ((c.r - c.g) / d + 4.0) / 6.0;
  if (h < 0.0) h += 1.0;
  return vec3(h, s, l);
}
float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}
vec3 hslToRgb(float h, float s, float l) {
  if (s == 0.0) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float pp = 2.0 * l - q;
  return vec3(
    hue2rgb(pp, q, h + 1.0 / 3.0),
    hue2rgb(pp, q, h),
    hue2rgb(pp, q, h - 1.0 / 3.0)
  );
}
// hueSaturationFilter.ts's applySlider / replaceColor.ts's identical copy.
float applySlider(float v01, float slider) {
  return slider < 0.0 ? v01 * (1.0 + slider / 100.0) : v01 + (1.0 - v01) * (slider / 100.0);
}
// colorBalanceFilter.ts's tone-range weights (0..1 luminance domain here,
// vs. the CPU's 0..255 — the formulas are linear so the /255 folds in).
float shadowsWeight(float l) { return max(0.0, 1.0 - l / (128.0/255.0)); }
float highlightsWeight(float l) { return max(0.0, (l - 128.0/255.0) / (127.0/255.0)); }
float midtonesWeight(float l) { return 1.0 - shadowsWeight(l) - highlightsWeight(l); }
// selectiveColorFilter.ts's computeRangeWeights, full 9-range version
// (chromaticW.x..chromaticW2.y = reds,yellows,greens,cyans,blues,magentas;
// achromaticW = blacks,neutrals,whites). Returns { chromaticW: vec3[2] via
// two vec3 out-params is awkward in GLSL — packed as a mat3 (rows =
// reds/yellows/greens, cyans/blues/magentas via a second call site) is
// also awkward, so this returns a fixed 9-float set via 3 vec3 out params.
void computeRangeWeights9(
  vec3 c, out vec3 chromaticLow, out vec3 chromaticHigh, out vec3 achromatic
) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
  float chroma = mx - mn;
  float s = chroma; // already 0..1 domain (CPU divides by 255)
  float h = 0.0;
  if (chroma > 0.0) {
    if (mx == c.r) h = 60.0 * mod((c.g - c.b) / chroma, 6.0);
    else if (mx == c.g) h = 60.0 * ((c.b - c.r) / chroma + 2.0);
    else h = 60.0 * ((c.r - c.g) / chroma + 4.0);
    if (h < 0.0) h += 360.0;
  }
  // centers: reds=0,yellows=60,greens=120,cyans=180,blues=240,magentas=300
  float centers[6];
  centers[0] = 0.0; centers[1] = 60.0; centers[2] = 120.0;
  centers[3] = 180.0; centers[4] = 240.0; centers[5] = 300.0;
  float w[6];
  for (int i = 0; i < 6; i++) {
    float d = abs(h - centers[i]);
    d = mod(d, 360.0);
    if (d > 180.0) d = 360.0 - d;
    w[i] = s * max(0.0, 1.0 - d / 60.0);
  }
  chromaticLow = vec3(w[0], w[1], w[2]);
  chromaticHigh = vec3(w[3], w[4], w[5]);
  achromatic = vec3((1.0 - s) * shadowsWeight(l), (1.0 - s) * midtonesWeight(l), (1.0 - s) * highlightsWeight(l));
}

vec3 applyChannelMixer(vec3 c) {
  vec4 rrow = u_p[0]; vec4 grow = u_p[1]; vec4 brow = u_p[2];
  float r = rrow.x*c.r + rrow.y*c.g + rrow.z*c.b + rrow.w;
  float g = grow.x*c.r + grow.y*c.g + grow.z*c.b + grow.w;
  float b = brow.x*c.r + brow.y*c.g + brow.z*c.b + brow.w;
  return clamp(vec3(r,g,b), 0.0, 1.0);
}
vec3 applyColorBalance(vec3 c) {
  float l = 0.3*c.r + 0.59*c.g + 0.11*c.b;
  float sw = shadowsWeight(l); float mw = midtonesWeight(l); float hw = highlightsWeight(l);
  vec4 sh = u_p[0]; vec4 mid = u_p[1]; vec4 hi = u_p[2];
  float dr = (sh.x*sw + mid.x*mw + hi.x*hw) / 255.0;
  float dg = (sh.y*sw + mid.y*mw + hi.y*hw) / 255.0;
  float db = (sh.z*sw + mid.z*mw + hi.z*hw) / 255.0;
  return clamp(c + vec3(dr,dg,db) * 0.6, 0.0, 1.0);
}
vec3 applyHueSaturation(vec3 c) {
  vec4 master = u_p[0];
  vec4 colorizeP = u_p[7];
  if (colorizeP.x > 0.5) {
    vec3 hsl0 = rgbToHsl(c);
    float l2 = applySlider(hsl0.z, colorizeP.w);
    return hslToRgb(colorizeP.y / 360.0, colorizeP.z / 100.0, l2);
  }
  vec3 low, high, achro;
  computeRangeWeights9(c, low, high, achro);
  float rw[6];
  rw[0]=low.x; rw[1]=low.y; rw[2]=low.z; rw[3]=high.x; rw[4]=high.y; rw[5]=high.z;
  float dH = master.x; float dS = master.y; float dL = master.z;
  for (int i = 0; i < 6; i++) {
    vec4 ch = u_p[1 + i];
    dH += rw[i] * ch.x;
    dS += rw[i] * ch.y;
    dL += rw[i] * ch.z;
  }
  vec3 hsl = rgbToHsl(c);
  float h = mod(mod(hsl.x*360.0 + dH, 360.0) + 360.0, 360.0) / 360.0;
  float s = applySlider(hsl.y, clamp(dS, -100.0, 100.0));
  float l = applySlider(hsl.z, clamp(dL, -100.0, 100.0));
  return hslToRgb(h, s, l);
}
vec3 applyVibrance(vec3 c) {
  vec3 hsl = rgbToHsl(c);
  if (hsl.y == 0.0) return c;
  float vibranceAmt = u_p[0].x / 100.0;
  float saturationAmt = u_p[0].y / 100.0;
  float boost = hsl.y * (1.0 - hsl.y) * vibranceAmt;
  float newS = clamp(hsl.y + boost + saturationAmt, 0.0, 1.0);
  return hslToRgb(hsl.x, newS, hsl.z);
}
vec3 applySelectiveColor(vec3 c) {
  vec3 low, high, achro;
  computeRangeWeights9(c, low, high, achro);
  float w[9];
  w[0]=low.x; w[1]=low.y; w[2]=low.z; w[3]=high.x; w[4]=high.y; w[5]=high.z;
  w[6]=achro.z; w[7]=achro.y; w[8]=achro.x; // whites,neutrals,blacks order matches JS "whites,neutrals,blacks"
  bool absolute = u_p[0].x > 0.5;
  float cyanInk = 1.0 - c.r; float magentaInk = 1.0 - c.g; float yellowInk = 1.0 - c.b;
  float dr = 0.0; float dg = 0.0; float db = 0.0;
  for (int i = 0; i < 9; i++) {
    vec4 adj = u_p[1 + i]; // cyan, magenta, yellow, black (0..100 scale)
    float wv = w[i];
    if (wv == 0.0) continue;
    float scaleR = absolute ? 1.0 : cyanInk;
    float scaleG = absolute ? 1.0 : magentaInk;
    float scaleB = absolute ? 1.0 : yellowInk;
    dr -= wv * (adj.x/100.0) * scaleR;
    dg -= wv * (adj.y/100.0) * scaleG;
    db -= wv * (adj.z/100.0) * scaleB;
    dr -= wv * (adj.w/100.0) * scaleR;
    dg -= wv * (adj.w/100.0) * scaleG;
    db -= wv * (adj.w/100.0) * scaleB;
  }
  return clamp(c + vec3(dr,dg,db), 0.0, 1.0);
}
vec3 applyReplaceColor(vec3 c, float alpha) {
  // replaceColor.ts's applyReplaceColor skips any pixel whose (frozen
  // sample) alpha is exactly 0 — never touches fully-transparent texels.
  if (alpha == 0.0) return c;
  vec4 targetFuzz = u_p[0];
  vec3 target = targetFuzz.rgb / 255.0;
  float fuzziness = targetFuzz.w / 255.0;
  vec3 d = abs(c - target);
  if (d.r > fuzziness || d.g > fuzziness || d.b > fuzziness) return c;
  vec4 hsl_adj = u_p[1];
  vec3 hsl = rgbToHsl(c);
  float h = mod(mod(hsl.x*360.0 + hsl_adj.x, 360.0) + 360.0, 360.0) / 360.0;
  float s = applySlider(hsl.y, clamp(hsl_adj.y, -100.0, 100.0));
  float l = applySlider(hsl.z, clamp(hsl_adj.z, -100.0, 100.0));
  return hslToRgb(h, s, l);
}
vec3 applyBlackAndWhite(vec3 c) {
  vec4 sliders1 = u_p[0]; // reds,yellows,greens,cyans
  vec4 sliders2 = u_p[1]; // blues,magentas,_,_
  vec4 tintP = u_p[2]; // tint flag, hue, sat, _
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float mid = c.r + c.g + c.b - mx - mn;
  float primary; float secondary;
  if (mx == c.r) {
    primary = sliders1.x; // reds
    secondary = c.g >= c.b ? sliders1.y : sliders2.y; // yellows : magentas
  } else if (mx == c.g) {
    primary = sliders1.z; // greens
    secondary = c.r >= c.b ? sliders1.y : sliders1.w; // yellows : cyans
  } else {
    primary = sliders2.x; // blues
    secondary = c.g >= c.r ? sliders1.w : sliders2.y; // cyans : magentas
  }
  float lum = clamp(mn + (mid - mn) * (secondary/100.0) + (mx - mid) * (primary/100.0), 0.0, 1.0);
  if (tintP.x > 0.5) {
    // tintP.y (hue) AND tintP.z (saturation) are BOTH already 0..1
    // fractions — rgbToHsl's own domain, packed verbatim by
    // tintHueSatJs — NOT 0..360/0..100 slider values like colorizeHue/
    // colorizeSaturation above, so neither gets a /360 or /100 here.
    return hslToRgb(tintP.y, tintP.z, lum);
  }
  return vec3(lum);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 src = texelFetch(u_source, p, 0);
  vec3 rgb = src.rgb;
  vec3 result = rgb;
  if (u_type == 0) result = applyChannelMixer(rgb);
  else if (u_type == 1) result = applyColorBalance(rgb);
  else if (u_type == 2) result = applyHueSaturation(rgb);
  else if (u_type == 3) result = applyVibrance(rgb);
  else if (u_type == 4) result = applySelectiveColor(rgb);
  else if (u_type == 5) result = applyReplaceColor(rgb, src.a);
  else if (u_type == 6) result = applyBlackAndWhite(rgb);
  outColor = vec4(result, src.a);
}`;e.s(["DIRECT_ADJUSTMENT_TYPES",0,o,"DIRECT_FRAGMENT_SHADER",0,l,"DIRECT_VERTEX_SHADER",0,i,"directAdjustmentTypeIdOrDefault",0,function(e){return Object.prototype.hasOwnProperty.call(r,e)?r[e]:-1},"packDirectAdjustmentUniforms",0,function(e,r,o,i){let l=new Float32Array(40);switch(e){case"channelMixer":{let e=r??{rr:1,rg:0,rb:0,rc:0,gr:0,gg:1,gb:0,gc:0,br:0,bg:0,bb:1,bc:0};l.set([e.rr,e.rg,e.rb,e.rc,e.gr,e.gg,e.gb,e.gc,e.br,e.bg,e.bb,e.bc]);break}case"colorBalance":{let e=r??{shadows:{cyanRed:0,magentaGreen:0,yellowBlue:0},midtones:{cyanRed:0,magentaGreen:0,yellowBlue:0},highlights:{cyanRed:0,magentaGreen:0,yellowBlue:0}};l.set([e.shadows.cyanRed,e.shadows.magentaGreen,e.shadows.yellowBlue,0,e.midtones.cyanRed,e.midtones.magentaGreen,e.midtones.yellowBlue,0,e.highlights.cyanRed,e.highlights.magentaGreen,e.highlights.yellowBlue,0]);break}case"hueSaturation":{let e=r??{channels:Object.fromEntries(["master",...a].map(e=>[e,{hue:0,saturation:0,lightness:0}])),colorize:!1,colorizeHue:0,colorizeSaturation:25,colorizeLightness:0},t=e.channels.master,o=[t.hue,t.saturation,t.lightness,0];for(let t of a){let r=e.channels[t];o.push(r.hue,r.saturation,r.lightness,0)}o.push(+!!e.colorize,e.colorizeHue,e.colorizeSaturation,e.colorizeLightness),l.set(o);break}case"vibrance":{let e=r??{vibrance:0,saturation:0};l.set([e.vibrance,e.saturation,0,0]);break}case"selectiveColor":{let e=r??{mode:"relative",ranges:Object.fromEntries(["reds","yellows","greens","cyans","blues","magentas","whites","neutrals","blacks"].map(e=>[e,{cyan:0,magenta:0,yellow:0,black:0}]))},t=[+("absolute"===e.mode),0,0,0];for(let r of["reds","yellows","greens","cyans","blues","magentas","whites","neutrals","blacks"]){let o=e.ranges[r];t.push(o.cyan,o.magenta,o.yellow,o.black)}l.set(t);break}case"replaceColor":{let e=r??{target:[255,255,255],fuzziness:40,hue:0,saturation:0,lightness:0};l.set([e.target[0],e.target[1],e.target[2],e.fuzziness,e.hue,e.saturation,e.lightness,0]);break}case"blackAndWhite":{let e=r??{reds:40,yellows:60,greens:40,cyans:60,blues:20,magentas:80,tint:!1,tintColor:"#e2c39b"},[o,a]=e.tint?function(e){let r=e.replace("#",""),o=parseInt(r.slice(0,2),16),a=parseInt(r.slice(2,4),16),i=parseInt(r.slice(4,6),16),[l,n]=(0,t.rgbToHsl)(o,a,i);return[l,n]}(e.tintColor):[0,0];l.set([e.reds,e.yellows,e.greens,e.cyans,e.blues,e.magentas,0,0,+!!e.tint,o,a,0])}}return l}])},362120,e=>{"use strict";let t={normal:0,multiply:1,screen:2,darken:3,lighten:4,"color-dodge":5,"color-burn":6,"hard-light":7,overlay:8,"soft-light":9,difference:10,exclusion:11,"linear-burn":12,"linear-dodge":13,"darker-color":14,"lighter-color":15,"vivid-light":16,"linear-light":17,"pin-light":18,"hard-mix":19,subtract:20,divide:21,dissolve:22,hue:23,saturation:24,color:25,luminosity:26},r=new Set,o=`#version 300 es
layout(location = 0) in vec2 a_corner;
void main() {
  vec2 clip = a_corner * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`,a=`#version 300 es
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

// --- native separable helpers (blendMode.ts's blendSeparableChannel) ---
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

// --- non-separable helpers (blendMode.ts's lum/clipColor/setLum/sat/
// setSat, W3C spec sec3.3 — a literal line-by-line port, not a
// branch-free reformulation, so this stays a textual diff against the
// CPU reference for review purposes). W3C luminance weights (0.3/0.59/
// 0.11) — DELIBERATELY DIFFERENT from darkerColorVal/lighterColorVal's
// Rec.709 weights (0.2126/0.7152/0.0722) below. Both are correct for
// their own spec context; do NOT "harmonize" them into one formula. ---
float lumNS(vec3 c) { return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; }
vec3 clipColorNS(vec3 c) {
  // BOTH branches test/divide against the SAME original l/n/x — never
  // recomputed after the first branch runs (mirrors blendMode.ts's own
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
  // Literal port of blendMode.ts's setSat: sort the 3 component INDICES
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

// --- custom 0-255-integer-domain helpers (blendMode.ts's blendPixelCustom) ---
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
// blendMode.ts's darker-color/lighter-color exactly (including the
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
}`;e.s(["BLEND_STACK_FRAGMENT_SHADER",0,a,"BLEND_STACK_VERTEX_SHADER",0,o,"GPU_BLEND_MODE_ID",0,t,"demoteBlendMode",0,function(e){r.add(e)},"isGpuBlendImplemented",0,function(e){return void 0!==t[e]&&!r.has(e)}])},157520,e=>{"use strict";var t=e.i(911579),r=e.i(791057),o=e.i(193378);let a=r.TILE_SIZE*r.TILE_SIZE*4;var i=e.i(65956),l=e.i(272422),n=e.i(502346);let c=new Map;var s=e.i(362120);let u=null,d=null,f=!1,m=!1,h=0,p=!1;function b(e){p||(p=!0,console.warn("[MemeMaker] GPU tile compositor unavailable/pinned — falling back to CPU compositing in this worker for the rest of the session.",e))}let g=`#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_tileOrigin;
layout(location = 2) in float a_slice;
uniform vec2 u_outputSize;
uniform float u_tileSize;
flat out float v_slice;
out vec2 v_uv;
void main() {
  vec2 pos = a_tileOrigin + a_corner * u_tileSize;
  vec2 clip = (pos / u_outputSize) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_corner;
  v_slice = a_slice;
}`,T=`#version 300 es
precision highp float;
precision highp sampler2DArray;
flat in float v_slice;
in vec2 v_uv;
uniform sampler2DArray u_tiles;
out vec4 outColor;
void main() {
  outColor = texture(u_tiles, vec3(v_uv, v_slice));
}`,E=`#version 300 es
layout(location = 0) in vec2 a_corner;
void main() {
  vec2 clip = a_corner * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`,v=`#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform sampler2D u_lut;
uniform int u_mode;
out vec4 outColor;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 src = texelFetch(u_source, p, 0);
  if (u_mode == 0) {
    int ri = int(src.r * 255.0 + 0.5);
    int gi = int(src.g * 255.0 + 0.5);
    int bi = int(src.b * 255.0 + 0.5);
    float r = texelFetch(u_lut, ivec2(ri, 0), 0).r;
    float g = texelFetch(u_lut, ivec2(gi, 0), 0).g;
    float b = texelFetch(u_lut, ivec2(bi, 0), 0).b;
    outColor = vec4(r, g, b, src.a);
  } else {
    float luma = 0.299 * src.r + 0.587 * src.g + 0.114 * src.b;
    int idx = int(clamp(luma * 255.0 + 0.5, 0.0, 255.0));
    vec4 lutv = texelFetch(u_lut, ivec2(idx, 0), 0);
    outColor = vec4(mix(src.rgb, lutv.rgb, lutv.a), src.a);
  }
}`,_=`#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D u_source;
uniform sampler3D u_lut3d;
uniform float u_size;
uniform int u_dither;
uniform vec2 u_coordOffset;
out vec4 outColor;
const int BAYER4[16] = int[16](0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5);
float bayerDitherOffset(int x, int y, float strength) {
  int idx = (y & 3) * 4 + (x & 3);
  return ((float(BAYER4[idx]) + 0.5) / 16.0 - 0.5) * strength;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 src = texelFetch(u_source, p, 0);
  vec3 uvw = (src.rgb * (u_size - 1.0) + 0.5) / u_size;
  vec3 sampled = texture(u_lut3d, uvw).rgb;
  if (u_dither != 0) {
    int gx = p.x + int(u_coordOffset.x);
    int gy = p.y + int(u_coordOffset.y);
    float offset = bayerDitherOffset(gx, gy, 8.0) / 255.0;
    sampled = clamp(sampled + vec3(offset), 0.0, 1.0);
  }
  outColor = vec4(sampled, src.a);
}`;function y(e,t,r){let o=e.createShader(t);if(!o)throw Error("[tileCompositorGpuWorker] createShader failed");if(e.shaderSource(o,r),e.compileShader(o),!e.getShaderParameter(o,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(o);throw e.deleteShader(o),Error(`[tileCompositorGpuWorker] shader compile failed: ${t}`)}return o}function x(e,t=g,r=T){let o=y(e,e.VERTEX_SHADER,t),a=y(e,e.FRAGMENT_SHADER,r),i=e.createProgram();if(!i)throw Error("[tileCompositorGpuWorker] createProgram failed");if(e.attachShader(i,o),e.attachShader(i,a),e.linkProgram(i),!e.getProgramParameter(i,e.LINK_STATUS)){let t=e.getProgramInfoLog(i);throw e.deleteProgram(i),Error(`[tileCompositorGpuWorker] program link failed: ${t}`)}return e.deleteShader(o),e.deleteShader(a),i}function R(e){let t=Number(e.getParameter(e.MAX_TEXTURE_SIZE)||0);if(t>0&&r.TILE_SIZE>t)throw Error(`[tileCompositorGpuWorker] TILE_SIZE (${r.TILE_SIZE}) exceeds this device's MAX_TEXTURE_SIZE (${t})`);let l=x(e),n=function(e,t=0x10000000){let i=Math.max(1,Math.min(Number(e.getParameter(e.MAX_ARRAY_TEXTURE_LAYERS)||256),2048)),l=Math.max(1,Math.floor(t/a)),n=[],c=new Map,s=0,u=null;function d(t,o,a){e.bindTexture(e.TEXTURE_2D_ARRAY,n[t].texture),e.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,o,r.TILE_SIZE,r.TILE_SIZE,1,e.RGBA,e.UNSIGNED_BYTE,a.data)}return{ensureTile:function(t,a,f,m,h){let p=t+"|"+a+"|"+(0,o.tileKey)(f,m);u?.add(p);let b=c.get(p);if(b){if(c.delete(p),b.rev===h.rev)return c.set(p,b),{...b};d(b.arrayIndex,b.slice,h);let e={arrayIndex:b.arrayIndex,slice:b.slice,rev:h.rev};return c.set(p,e),{...e}}let{arrayIndex:g,slice:T}=function(){for(let t=0;t<1e4;t++){for(let e=0;e<n.length;e++)if(n[e].freeList.length>0){let t=n[e].freeList.pop();return s++,{arrayIndex:e,slice:t}}if(s<l){let t=function(){let t=Math.max(1,Math.min(i,l-s)),o=e.createTexture();if(!o)throw Error("[gpuTilePool] createTexture failed");e.bindTexture(e.TEXTURE_2D_ARRAY,o),e.texStorage3D(e.TEXTURE_2D_ARRAY,1,e.RGBA8,r.TILE_SIZE,r.TILE_SIZE,t),e.texParameteri(e.TEXTURE_2D_ARRAY,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D_ARRAY,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D_ARRAY,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D_ARRAY,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);let a={texture:o,capacity:t,freeList:Array.from({length:t},(e,r)=>t-1-r)};return n.push(a),a}();if(t.freeList.length>0){let e=t.freeList.pop();return s++,{arrayIndex:n.length-1,slice:e}}}if(!function(){for(let e of c.keys()){if(u?.has(e))continue;let t=c.get(e);return c.delete(e),n[t.arrayIndex].freeList.push(t.slice),s--,!0}return!1}())throw Error(u&&u.size>0?"[gpuTilePool] unable to acquire a texture slice — the current job's own distinct-tile count already exceeds the VRAM budget (every evictable entry is protected by this in-flight batch); raise budgetBytes or shrink the job":"[gpuTilePool] unable to acquire a texture slice (budget too small for even one tile)")}throw Error("[gpuTilePool] acquireSlice: exceeded retry budget")}();d(g,T,h);let E={arrayIndex:g,slice:T,rev:h.rev};return c.set(p,E),{...E}},peekTile:function(e,t,r,a,i){let l=e+"|"+t+"|"+(0,o.tileKey)(r,a),n=c.get(l);if(n&&n.rev===i)return u?.add(l),c.delete(l),c.set(l,n),{...n}},releaseLayer:function(e){let t=e+"|";for(let[e,r]of[...c.entries()])e.startsWith(t)&&(c.delete(e),n[r.arrayIndex].freeList.push(r.slice),s--)},destroy:function(){for(let t of n)e.deleteTexture(t.texture);n.length=0,c.clear(),s=0,u=null},stats:function(){return{arrays:n.length,usedSlices:s,totalSlices:l,budgetBytes:t}},bindArrayForDraw:function(t){e.bindTexture(e.TEXTURE_2D_ARRAY,n[t].texture)},beginBatch:function(){u=new Set},endBatch:function(){u=null}}}(e),c=e.createBuffer();if(!c)throw Error("[tileCompositorGpuWorker] createBuffer (quad) failed");e.bindBuffer(e.ARRAY_BUFFER,c),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),e.STATIC_DRAW);let u=e.createBuffer();if(!u)throw Error("[tileCompositorGpuWorker] createBuffer (instance) failed");let d=x(e,E,v),f=x(e,i.DIRECT_VERTEX_SHADER,i.DIRECT_FRAGMENT_SHADER),m=x(e,i.DIRECT_VERTEX_SHADER,_),h=x(e,s.BLEND_STACK_VERTEX_SHADER,s.BLEND_STACK_FRAGMENT_SHADER);return{pool:n,program:l,quadBuffer:c,instanceBuffer:u,uOutputSize:e.getUniformLocation(l,"u_outputSize"),uTileSize:e.getUniformLocation(l,"u_tileSize"),uTiles:e.getUniformLocation(l,"u_tiles"),lutProgram:d,uLutSource:e.getUniformLocation(d,"u_source"),uLutTexture:e.getUniformLocation(d,"u_lut"),uLutMode:e.getUniformLocation(d,"u_mode"),directProgram:f,uDirectSource:e.getUniformLocation(f,"u_source"),uDirectType:e.getUniformLocation(f,"u_type"),uDirectParams:e.getUniformLocation(f,"u_p"),colorLookup3dProgram:m,uCl3dSource:e.getUniformLocation(m,"u_source"),uCl3dLut:e.getUniformLocation(m,"u_lut3d"),uCl3dSize:e.getUniformLocation(m,"u_size"),uCl3dDither:e.getUniformLocation(m,"u_dither"),uCl3dOffset:e.getUniformLocation(m,"u_coordOffset"),blendStackProgram:h,uBlendBackdrop:e.getUniformLocation(h,"u_backdrop"),uBlendLayer:e.getUniformLocation(h,"u_layer"),uBlendMask:e.getUniformLocation(h,"u_mask"),uBlendHasMask:e.getUniformLocation(h,"u_hasMask"),uBlendOpacity:e.getUniformLocation(h,"u_opacity"),uBlendMode:e.getUniformLocation(h,"u_mode"),uBlendDissolveSeed:e.getUniformLocation(h,"u_dissolveSeed")}}function A(){if(f||m)return null;if(d)return d;if(!u&&!(u=function(){if("u"<typeof OffscreenCanvas)return null;let e=new OffscreenCanvas(1,1),t=null;try{t=e.getContext("webgl2",{premultipliedAlpha:!1})}catch{t=null}return t?(e.addEventListener("webglcontextlost",e=>{e.preventDefault(),h++,m=!0,d=null,h>=2&&(f=!0,b("context lost twice in one worker session"),u=null)}),e.addEventListener("webglcontextrestored",()=>{if(!f){m=!1;try{d={gl:t,canvas:e,...R(t)}}catch(e){f=!0,b(e)}}}),{canvas:e,gl:t}):null}()))return f=!0,b("WebGL2 context creation failed"),null;try{d={gl:u.gl,canvas:u.canvas,...R(u.gl)}}catch(e){return f=!0,b(e),null}return d}function w(e,t,r,a){let i=new Map,l=[];for(let n of t){let t;if(n.buffer){let r=new Uint8ClampedArray(n.buffer),a=(0,o.publishTile)(r,n.rev);t=e.pool.ensureTile(n.layerId,n.level,n.tx,n.ty,a)}else if(!(t=e.pool.peekTile(n.layerId,n.level,n.tx,n.ty,n.rev))){l.push((0,o.tileKey)(n.tx,n.ty));continue}let c=n.tx*r-a.x,s=n.ty*r-a.y,u=i.get(t.arrayIndex)??[];u.push({originX:c,originY:s,slice:t.slice}),i.set(t.arrayIndex,u)}return{groups:i,missing:l}}function L(e,t,r,o,a){let{gl:i}=e;for(let[l,n]of(i.useProgram(e.program),i.uniform2f(e.uOutputSize,r,o),i.uniform1f(e.uTileSize,a),i.uniform1i(e.uTiles,0),i.activeTexture(i.TEXTURE0),i.bindBuffer(i.ARRAY_BUFFER,e.quadBuffer),i.enableVertexAttribArray(0),i.vertexAttribPointer(0,2,i.FLOAT,!1,0,0),i.vertexAttribDivisor(0,0),t)){let t=new Float32Array(3*n.length);n.forEach((e,r)=>{t[3*r]=e.originX,t[3*r+1]=e.originY,t[3*r+2]=e.slice}),i.bindBuffer(i.ARRAY_BUFFER,e.instanceBuffer),i.bufferData(i.ARRAY_BUFFER,t,i.DYNAMIC_DRAW),i.enableVertexAttribArray(1),i.vertexAttribPointer(1,2,i.FLOAT,!1,12,0),i.vertexAttribDivisor(1,1),i.enableVertexAttribArray(2),i.vertexAttribPointer(2,1,i.FLOAT,!1,12,8),i.vertexAttribDivisor(2,1),e.pool.bindArrayForDraw(l),i.drawArraysInstanced(i.TRIANGLES,0,6,n.length)}}async function S(e,t){let r,o,{gl:a}=e;if(a.isContextLost())throw Error("[tileCompositorGpuWorker] WebGL2 context is lost");let{id:s,outputWidth:u,outputHeight:d,rectInLevelSpace:f}=t;e.pool.beginBatch();try{({groups:r,missing:o}=w(e,t.tiles,t.tileSize,f))}finally{e.pool.endBatch()}if(o.length>0)return{id:s,ok:!1,error:"cache-cold",cacheCold:!0,missing:o};if(e.canvas.width=u,e.canvas.height=d,a.viewport(0,0,u,d),a.clearColor(0,0,0,0),a.clear(a.COLOR_BUFFER_BIT),a.disable(a.BLEND),L(e,r,u,d,t.tileSize),t.adjustmentLut&&function(e,t,r,o){let{gl:a}=e,i=a.createTexture(),l=a.createTexture();if(!i||!l)throw i&&a.deleteTexture(i),l&&a.deleteTexture(l),Error("[tileCompositorGpuWorker] applyLutPassGpu: createTexture failed");try{a.bindTexture(a.TEXTURE_2D,i),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),a.copyTexImage2D(a.TEXTURE_2D,0,a.RGBA8,0,0,r,o,0),a.bindTexture(a.TEXTURE_2D,l),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),a.texImage2D(a.TEXTURE_2D,0,a.RGBA8,256,1,0,a.RGBA,a.UNSIGNED_BYTE,t.data),a.viewport(0,0,r,o),a.disable(a.BLEND),a.useProgram(e.lutProgram),a.uniform1i(e.uLutSource,0),a.uniform1i(e.uLutTexture,1),a.uniform1i(e.uLutMode,+("perChannel"!==t.mode)),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,i),a.activeTexture(a.TEXTURE1),a.bindTexture(a.TEXTURE_2D,l),a.bindBuffer(a.ARRAY_BUFFER,e.quadBuffer),a.enableVertexAttribArray(0),a.vertexAttribPointer(0,2,a.FLOAT,!1,0,0),a.vertexAttribDivisor(0,0),a.drawArrays(a.TRIANGLES,0,6)}finally{a.deleteTexture(i),a.deleteTexture(l)}}(e,t.adjustmentLut,u,d),t.directAdjustment){let{type:r,params:o,fgColor:a,bgColor:l}=t.directAdjustment,n=(0,i.packDirectAdjustmentUniforms)(r,o,a,l);!function(e,t,r,o){let{gl:a}=e,l=D(a,r,o);try{a.viewport(0,0,r,o),a.disable(a.BLEND),a.useProgram(e.directProgram),a.uniform1i(e.uDirectSource,0);let n=(0,i.directAdjustmentTypeIdOrDefault)(t.type);a.uniform1i(e.uDirectType,n),a.uniform4fv(e.uDirectParams,t.params),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,l),a.bindBuffer(a.ARRAY_BUFFER,e.quadBuffer),a.enableVertexAttribArray(0),a.vertexAttribPointer(0,2,a.FLOAT,!1,0,0),a.vertexAttribDivisor(0,0),a.drawArrays(a.TRIANGLES,0,6)}finally{a.deleteTexture(l)}}(e,{type:r,params:n},u,d)}return t.colorLookup3d&&function(e,t,r,o,a){let{gl:i}=e,l=D(i,o,a),n=i.createTexture();if(!n)throw i.deleteTexture(l),Error("[tileCompositorGpuWorker] applyColorLookup3dPassGpu: createTexture failed");try{i.bindTexture(i.TEXTURE_3D,n),i.texParameteri(i.TEXTURE_3D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_3D,i.TEXTURE_MAG_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_3D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_3D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_3D,i.TEXTURE_WRAP_R,i.CLAMP_TO_EDGE),i.pixelStorei(i.UNPACK_ALIGNMENT,1),i.texImage3D(i.TEXTURE_3D,0,i.RGB8,t.size,t.size,t.size,0,i.RGB,i.UNSIGNED_BYTE,t.data),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.viewport(0,0,o,a),i.disable(i.BLEND),i.useProgram(e.colorLookup3dProgram),i.uniform1i(e.uCl3dSource,0),i.uniform1i(e.uCl3dLut,1),i.uniform1f(e.uCl3dSize,t.size),i.uniform1i(e.uCl3dDither,+!!t.dither),i.uniform2f(e.uCl3dOffset,r.x,r.y),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,l),i.activeTexture(i.TEXTURE1),i.bindTexture(i.TEXTURE_3D,n),i.bindBuffer(i.ARRAY_BUFFER,e.quadBuffer),i.enableVertexAttribArray(0),i.vertexAttribPointer(0,2,i.FLOAT,!1,0,0),i.vertexAttribDivisor(0,0),i.drawArrays(i.TRIANGLES,0,6)}finally{i.deleteTexture(l),i.deleteTexture(n)}}(e,{data:function(e){let t=c.get(e);if(t)return t;let r=(0,l.getColorLookupRecipe)(e),o=new Uint8ClampedArray(143748);for(let e=0;e<33;e++)for(let t=0;t<33;t++)for(let r=0;r<33;r++){let a=(r+33*t+33*e*33)*4;o[a]=Math.round(r/32*255),o[a+1]=Math.round(t/32*255),o[a+2]=Math.round(e/32*255),o[a+3]=255}let a=new ImageData(o,33,1089);(0,n.applyColorLookup)(a,r,!1);let i=new Uint8Array(107811);for(let e=0,t=0;e<35937;e++,t+=3)i[t]=a.data[4*e],i[t+1]=a.data[4*e+1],i[t+2]=a.data[4*e+2];return c.set(e,i),i}(t.colorLookup3d.lookId),size:33,dither:t.colorLookup3d.dither},f,u,d),{id:s,ok:!0,bitmap:e.canvas.transferToImageBitmap(),backend:"gpu"}}function D(e,t,r){let o=e.createTexture();if(!o)throw Error("[tileCompositorGpuWorker] copySourceCanvasToTexture: createTexture failed");return e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.copyTexImage2D(e.TEXTURE_2D,0,e.RGBA8,0,0,t,r,0),o}async function U(e){let r=e.tiles[0],a={id:e.id,protocolVersion:2,layerId:r?.layerId??"",level:r?.level??0,tileSize:e.tileSize,rectInLevelSpace:e.rectInLevelSpace,outputWidth:e.outputWidth,outputHeight:e.outputHeight,tiles:e.tiles.map(t=>({x:t.tx*e.tileSize,y:t.ty*e.tileSize,width:e.tileSize,height:e.tileSize,key:(0,o.tileKey)(t.tx,t.ty),rev:t.rev,buffer:t.buffer})),adjustmentLut:e.adjustmentLut,directAdjustment:e.directAdjustment,colorLookup3d:e.colorLookup3d},i=await (0,t.compositeJob)(a);return i.ok?{id:i.id,ok:!0,bitmap:i.bitmap,backend:"cpu"}:i}async function I(e){let t=A();if(!t)return U(e);try{return await S(t,e)}catch(t){return console.warn("[MemeMaker] GPU composite failed, falling back to CPU for this job",t),U(e)}}async function k(e){if(void 0===e.layerId||void 0===e.level)return{id:e.id,ok:!1,error:"[tileCompositorGpuWorker] job missing layerId/level"};let t={id:e.id,tileSize:e.tileSize,rectInLevelSpace:e.rectInLevelSpace,outputWidth:e.outputWidth,outputHeight:e.outputHeight,tiles:e.tiles.map(t=>({layerId:e.layerId,level:e.level,tx:Math.round(t.x/e.tileSize),ty:Math.round(t.y/e.tileSize),rev:t.rev??0,buffer:t.buffer})),adjustmentLut:e.adjustmentLut,directAdjustment:e.directAdjustment,colorLookup3d:e.colorLookup3d};return await I(t)}function C(e,t,r){let o=e.createTexture();if(!o)throw Error("[tileCompositorGpuWorker] createRenderTarget: createTexture failed");e.bindTexture(e.TEXTURE_2D,o),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,t,r,0,e.RGBA,e.UNSIGNED_BYTE,null);let a=e.createFramebuffer();if(!a)throw e.deleteTexture(o),Error("[tileCompositorGpuWorker] createRenderTarget: createFramebuffer failed");e.bindFramebuffer(e.FRAMEBUFFER,a),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,o,0);let i=e.checkFramebufferStatus(e.FRAMEBUFFER);if(i!==e.FRAMEBUFFER_COMPLETE)throw e.deleteFramebuffer(a),e.deleteTexture(o),Error(`[tileCompositorGpuWorker] createRenderTarget: framebuffer incomplete (status ${i})`);return{texture:o,framebuffer:a}}function B(e,t){e.deleteFramebuffer(t.framebuffer),e.deleteTexture(t.texture)}async function P(e,t){let{gl:r}=e;if(r.isContextLost())throw Error("[tileCompositorGpuWorker] WebGL2 context is lost");let{id:o,outputWidth:a,outputHeight:i,rectInLevelSpace:l,tileSize:n}=t;if(0===t.layers.length)return{id:o,ok:!1,error:"stack run has zero layers"};let c=[],u=[];e.pool.beginBatch();try{for(let r of t.layers){let t=w(e,r.tiles,n,l);c.push(t.groups),u.push(...t.missing)}}finally{e.pool.endBatch()}if(u.length>0)return{id:o,ok:!1,error:"cache-cold",cacheCold:!0,missing:u};e.canvas.width=a,e.canvas.height=i;let d=null,f=null,m=null;try{d=C(r,a,i),f=C(r,a,i),m=C(r,a,i),r.bindFramebuffer(r.FRAMEBUFFER,f.framebuffer),r.viewport(0,0,a,i),r.clearColor(0,0,0,0),r.clear(r.COLOR_BUFFER_BIT);let l=f,u=m;for(let f=0;f<t.layers.length;f++){let m=t.layers[f],h=s.GPU_BLEND_MODE_ID[m.blendMode];if(void 0===h)return{id:o,ok:!1,error:`[tileCompositorGpuWorker] unimplemented blend mode in stack run: ${m.blendMode}`};r.bindFramebuffer(r.FRAMEBUFFER,d.framebuffer),r.viewport(0,0,a,i),r.clearColor(0,0,0,0),r.clear(r.COLOR_BUFFER_BIT),r.disable(r.BLEND),L(e,c[f],a,i,n);let p=f===t.layers.length-1;r.bindFramebuffer(r.FRAMEBUFFER,p?null:u.framebuffer),r.viewport(0,0,a,i),r.disable(r.BLEND),r.useProgram(e.blendStackProgram),r.uniform1i(e.uBlendBackdrop,0),r.uniform1i(e.uBlendLayer,1),r.uniform1i(e.uBlendMask,2),r.uniform1i(e.uBlendHasMask,+!!m.maskBuffer),r.uniform1f(e.uBlendOpacity,m.opacity),r.uniform1i(e.uBlendMode,h),r.uniform1i(e.uBlendDissolveSeed,(m.dissolveSeed??0)|0),r.activeTexture(r.TEXTURE0),r.bindTexture(r.TEXTURE_2D,l.texture),r.activeTexture(r.TEXTURE1),r.bindTexture(r.TEXTURE_2D,d.texture);let b=null;try{if(m.maskBuffer){if(!(b=r.createTexture()))throw Error("[tileCompositorGpuWorker] compositeStackRunGpu: mask texture allocation failed");let e=a*i*4;if(m.maskBuffer.byteLength!==e)throw Error(`[tileCompositorGpuWorker] compositeStackRunGpu: maskBuffer size mismatch (expected ${e} bytes, got ${m.maskBuffer.byteLength})`);r.activeTexture(r.TEXTURE2),r.bindTexture(r.TEXTURE_2D,b),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!0),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,a,i,0,r.RGBA,r.UNSIGNED_BYTE,new Uint8Array(m.maskBuffer)),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!1),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.NEAREST),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE)}r.bindBuffer(r.ARRAY_BUFFER,e.quadBuffer),r.enableVertexAttribArray(0),r.vertexAttribPointer(0,2,r.FLOAT,!1,0,0),r.vertexAttribDivisor(0,0),r.drawArrays(r.TRIANGLES,0,6)}finally{b&&r.deleteTexture(b)}if(!p){let e=l;l=u,u=e}}}finally{d&&B(r,d),f&&B(r,f),m&&B(r,m),r.bindFramebuffer(r.FRAMEBUFFER,null)}return{id:o,ok:!0,bitmap:e.canvas.transferToImageBitmap()}}async function F(e){let t=A();if(!t)return{id:e.id,ok:!1,error:"[tileCompositorGpuWorker] GPU unavailable for stack-run compositing"};try{return await P(t,e)}catch(t){if(t instanceof Error&&/shader compile failed|program link failed/.test(t.message))for(let t of e.layers)(0,s.demoteBlendMode)(t.blendMode);return console.warn("[MemeMaker] GPU stack-run composite failed, this run falls back to per-layer rendering",t),{id:e.id,ok:!1,error:t instanceof Error?t.message:String(t)}}}if("u">typeof self&&"u">typeof WorkerGlobalScope){let e=self;e.onmessage=async t=>{let r="kind"in t.data&&"stackRun"===t.data.kind?await F(t.data):await k(t.data);r.ok?e.postMessage(r,[r.bitmap]):e.postMessage(r)}}e.s(["__resetForTests",0,function(){u=null,d=null,f=!1,m=!1,h=0,p=!1},"compositeJob",0,I,"compositeJobV2",0,k,"compositeStackRun",0,F],157520)},911579,e=>{"use strict";var t=e.i(46801),r=e.i(322623),o=e.i(272422),a=e.i(502346);let i=new Map,l=0;async function n(e,i,l,n,c,s,u,d,f){try{if("u"<typeof OffscreenCanvas)return{id:e,ok:!1,error:"OffscreenCanvas unavailable in this worker"};let i=new OffscreenCanvas(n,c),m=i.getContext("2d");if(!m)return{id:e,ok:!1,error:"2d context unavailable on OffscreenCanvas"};for(let e of s){let t=new ImageData(e.data,e.width,e.height);m.putImageData(t,e.x-l.x,e.y-l.y)}if(u){let e=m.getImageData(0,0,n,c);(0,t.applyLutPassReference)(e.data,u.data,u.mode),m.putImageData(e,0,0)}if(d){let e=m.getImageData(0,0,n,c);(0,r.buildAdjustmentFilter)(d.type,d.params,d.fgColor,d.bgColor)(e),m.putImageData(e,0,0)}if(f){let e=m.getImageData(0,0,n,c),t=(0,o.getColorLookupRecipe)(f.lookId);(0,a.applyColorLookup)(e,t,f.dither),m.putImageData(e,0,0)}let h=i.transferToImageBitmap();return{id:e,ok:!0,bitmap:h}}catch(t){return{id:e,ok:!1,error:String(t)}}}async function c(e){let t=e.tiles.map(e=>({x:e.x,y:e.y,width:e.width,height:e.height,data:new Uint8ClampedArray(e.buffer)}));return n(e.id,e.tileSize,e.rectInLevelSpace,e.outputWidth,e.outputHeight,t,e.adjustmentLut,e.directAdjustment,e.colorLookup3d)}async function s(e){let{layerId:t,level:r}=e;if(void 0===t||void 0===r)return{id:e.id,ok:!1,error:"protocol v2 job missing layerId/level"};let o=[],a=[];for(let n of e.tiles){if(n.buffer){let e=new Uint8ClampedArray(n.buffer);void 0!==n.key&&void 0!==n.rev&&function(e,t){let r=i.get(e);for(r&&(l-=r.data.byteLength),i.delete(e),i.set(e,t),l+=t.data.byteLength;l>0x4000000&&i.size>0;){let e=i.keys().next().value,t=i.get(e);i.delete(e),l-=t.data.byteLength}}(t+"|"+r+"|"+n.key,{rev:n.rev,data:e}),a.push({x:n.x,y:n.y,width:n.width,height:n.height,data:e});continue}if(void 0===n.key||void 0===n.rev)return{id:e.id,ok:!1,error:"protocol v2 tile missing both buffer and key/rev"};let c=t+"|"+r+"|"+n.key,s=i.get(c);if(!s||s.rev!==n.rev){o.push(n.key);continue}i.delete(c),i.set(c,s),a.push({x:n.x,y:n.y,width:n.width,height:n.height,data:s.data})}return o.length>0?{id:e.id,ok:!1,error:"cache-cold",cacheCold:!0,missing:o}:n(e.id,e.tileSize,e.rectInLevelSpace,e.outputWidth,e.outputHeight,a,e.adjustmentLut,e.directAdjustment,e.colorLookup3d)}async function u(e){try{if(2===e.protocolVersion)return await s(e);return await c(e)}catch(t){return{id:e.id,ok:!1,error:String(t)}}}if("u">typeof self&&"u">typeof WorkerGlobalScope){let e=self;e.onmessage=async t=>{let r=await u(t.data);r.ok?e.postMessage(r,[r.bitmap]):e.postMessage(r)}}e.s(["__resetCacheForTests",0,function(){i.clear(),l=0},"compositeJob",0,u])}]);