(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,856651,e=>{"use strict";e.s(["blendPixelSourceOver",0,function(e,t,r,a,l,o){if(o<=0)return;let n=e[t],i=e[t+1],s=e[t+2],c=e[t+3]/255,h=o+c*(1-o);if(0===h){e[t]=e[t+1]=e[t+2]=e[t+3]=0;return}e[t]=Math.round((r*o+n*c*(1-o))/h),e[t+1]=Math.round((a*o+i*c*(1-o))/h),e[t+2]=Math.round((l*o+s*c*(1-o))/h),e[t+3]=Math.round(255*h)}])},802132,559949,e=>{"use strict";var t=e.i(856651),r=e.i(399100),a=e.i(312564);let l=["dissolve","linear-burn","linear-dodge","darker-color","lighter-color","vivid-light","linear-light","pin-light","hard-mix","subtract","divide"],o=new Set(l);function n(e){return!!e&&o.has(e)}let i=[{label:"Normal",modes:["normal","dissolve"]},{label:"Darken",modes:["darken","multiply","color-burn","linear-burn","darker-color"]},{label:"Lighten",modes:["lighten","screen","color-dodge","linear-dodge","lighter-color"]},{label:"Overlay / Contrast",modes:["overlay","soft-light","hard-light","vivid-light","linear-light","pin-light","hard-mix"]},{label:"Difference",modes:["difference","exclusion","subtract","divide"]},{label:"Component",modes:["hue","saturation","color","luminosity"]}],s=i.flatMap(e=>e.modes);function c(e){let t=e>>>0;return()=>{let e=t=t+0x6d2b79f5>>>0;return e=Math.imul(e^e>>>15,1|e),(((e^=e+Math.imul(e^e>>>7,61|e))^e>>>14)>>>0)/0x100000000}}function h(e){return e&&"normal"!==e?e:"source-over"}function u(e){return e<0?0:e>1?1:e}function d(e,t,r){switch(e){case"normal":return r;case"multiply":return t*r;case"screen":return t+r-t*r;case"darken":return Math.min(t,r);case"lighten":return Math.max(t,r);case"color-dodge":if(0===t)return 0;if(1===r)return 1;return Math.min(1,t/(1-r));case"color-burn":if(1===t)return 1;if(0===r)return 0;return 1-Math.min(1,(1-t)/r);case"hard-light":return r<=.5?d("multiply",t,2*r):d("screen",t,2*r-1);case"overlay":return d("hard-light",r,t);case"soft-light":{if(r<=.5)return t-(1-2*r)*t*(1-t);let e=t<=.25?((16*t-12)*t+4)*t:Math.sqrt(t);return t+(2*r-1)*(e-t)}case"difference":return Math.abs(t-r);case"exclusion":return t+r-2*t*r;default:throw Error(`blendSeparableChannel: unhandled mode ${e}`)}}function m([e,t,r]){return .3*e+.59*t+.11*r}function g(e,t){let r=t-m(e);return function(e){let t=m(e),r=Math.min(...e),a=Math.max(...e),[l,o,n]=e;return r<0&&(l=t+(l-t)*t/(t-r),o=t+(o-t)*t/(t-r),n=t+(n-t)*t/(t-r)),a>1&&(l=t+(l-t)*(1-t)/(a-t),o=t+(o-t)*(1-t)/(a-t),n=t+(n-t)*(1-t)/(a-t)),[l,o,n]}([e[0]+r,e[1]+r,e[2]+r])}function f([e,t,r]){return Math.max(e,t,r)-Math.min(e,t,r)}function p(e,t){let[r,a,l]=[0,1,2].sort((t,r)=>e[t]-e[r]),o=[0,0,0];return e[l]>e[r]?(o[a]=(e[a]-e[r])*t/(e[l]-e[r]),o[l]=t):(o[a]=0,o[l]=0),o[r]=0,o}function b(e,t,r){switch(e){case"hue":return g(p(r,f(t)),m(t));case"saturation":return g(p(t,f(r)),m(t));case"color":return g(r,m(t));case"luminosity":return g(t,m(r))}}i.length;let w=new Set(["hue","saturation","color","luminosity"]),y=e=>e<0?0:e>255?255:Math.round(e),v=(e,t)=>y(e+t-255),x=(e,t)=>y(e+2*t-255);function M(e,l,o,i=Date.now(),s=1){(0,a.assertBlendableFormat)(e.format,"compositeWithBlendMode"),(0,r.isSamePixelFormat)(l.format,e.format)||(0,a.isRgbAdditive8)(l.format)||(0,a.assertBlendableFormat)(l.format,"compositeWithBlendMode");let h=(0,r.bytesPerPixel)(e.format),m=h-1,{width:g,height:f}=e,p=s<0?0:s>1?1:s;if(l.width!==g||l.height!==f)throw Error("compositeWithBlendMode: base/fill dimension mismatch");let _=g*f*h;if(e.data.length!==_)throw Error(`compositeWithBlendMode: base buffer length ${e.data.length} does not match ${g}\xd7${f} (bpp=${h}, need ${_})`);let B=(0,r.bytesPerPixel)(l.format),z=g*f*B;if(l.data.length!==z)throw Error(`compositeWithBlendMode: fill buffer length ${l.data.length} does not match ${g}\xd7${f} (bpp=${B}, need ${z})`);let S=e.data,C=l.data,k=new Uint8ClampedArray(S);if(n(o)){let r=c(i);for(let e=0;e<k.length;e+=h)C[e+m]<=0||function(e,r,a,l,o,n,i=1,s=3){let c,h,u,d=a[r],m=a[r+1],g=a[r+2],f=l[r],p=l[r+1],b=l[r+2],w=l[r+s];if("dissolve"===o){n()<w/255*i&&(0,t.blendPixelSourceOver)(e,r,f,p,b,1);return}switch(o){case"linear-burn":c=v(d,f),h=v(m,p),u=v(g,b);break;case"linear-dodge":c=y(d+f),h=y(m+p),u=y(g+b);break;case"linear-light":c=x(d,f),h=x(m,p),u=x(g,b);break;case"vivid-light":{let e=(e,t)=>{let r,a;return t<=127?0==(r=2*t)?0:y(255-(255-e)*255/r):255==(a=2*t-255)?255:y(255*e/(255-a))};c=e(d,f),h=e(m,p),u=e(g,b);break}case"pin-light":{let e=(e,t)=>t<=127?Math.min(e,2*t):Math.max(e,2*t-255);c=y(e(d,f)),h=y(e(m,p)),u=y(e(g,b));break}case"hard-mix":{let e=(e,t)=>e+2*t-255<128?0:255;c=e(d,f),h=e(m,p),u=e(g,b);break}case"darker-color":{let e=.2126*d+.7152*m+.0722*g<=.2126*f+.7152*p+.0722*b;[c,h,u]=e?[d,m,g]:[f,p,b];break}case"lighter-color":{let e=.2126*d+.7152*m+.0722*g>=.2126*f+.7152*p+.0722*b;[c,h,u]=e?[d,m,g]:[f,p,b];break}case"subtract":c=y(d-f),h=y(m-p),u=y(g-b);break;case"divide":{let e=(e,t)=>0===t?255:y(255*e/t);c=e(d,f),h=e(m,p),u=e(g,b)}}(0,t.blendPixelSourceOver)(e,r,c,h,u,w/255*i)}(k,e,S,C,o,r,p,m);return{data:k,width:g,height:f,format:e.format}}let E=w.has(o);for(let e=0;e<k.length;e+=h){let r=C[e+m]/255*p;if(r<=0)continue;let a=S[e+m]/255,l=[S[e]/255,S[e+1]/255,S[e+2]/255],n=[C[e]/255,C[e+1]/255,C[e+2]/255],i=E?b(o,l,n):[d(o,l[0],n[0]),d(o,l[1],n[1]),d(o,l[2],n[2])],s=255*u(n[0]*(1-a)+i[0]*a),c=255*u(n[1]*(1-a)+i[1]*a),h=255*u(n[2]*(1-a)+i[2]*a);(0,t.blendPixelSourceOver)(k,e,s,c,h,r)}return{data:k,width:g,height:f,format:e.format}}e.s(["BLEND_MODES",0,["normal","darken","multiply","color-burn","lighten","screen","color-dodge","overlay","soft-light","hard-light","difference","exclusion","hue","saturation","color","luminosity"],"BLEND_MODE_GROUPS",0,i,"EXTENDED_BLEND_MODES",0,l,"FILL_BLEND_MODES",0,["normal","dissolve","darken","multiply","color-burn","linear-burn","darker-color","lighten","screen","color-dodge","linear-dodge","lighter-color","overlay","soft-light","hard-light","vivid-light","linear-light","pin-light","hard-mix","difference","exclusion","subtract","divide","hue","saturation","color","luminosity"],"LAYER_BLEND_MODES",0,s,"blendModeToGCO",0,h,"blendNonSeparable",0,b,"compositeWithBlendMode",0,function(e,t,a,l=Date.now(),o=1){let n=M((0,r.asPixelBuffer)(e),(0,r.asPixelBuffer)(t),a,l,o);return(0,r.pixelBufferToImageData)(n,e.colorSpace)},"compositeWithBlendModePx",0,M,"isCustomBlendMode",0,n,"layerBlendGCO",0,function(e){return e&&n(e)?"source-over":h(e)},"mulberry32",0,c],559949),e.s([],802132)},856520,e=>{"use strict";e.s(["applyPosterize",0,function(e,t){let r=Math.max(2,Math.min(255,Math.round(t.levels)));if(255===r)return;let a=new Uint8ClampedArray(256);for(let e=0;e<256;e++)a[e]=Math.round(Math.round(e/255*(r-1))/(r-1)*255);let l=e.data;for(let e=0;e<l.length;e+=4)l[e]=a[l[e]],l[e+1]=a[l[e+1]],l[e+2]=a[l[e+2]]}])},312564,98842,399100,e=>{"use strict";function t(e,t,r,a){let l=t*r*4;if(e.length!==l)throw Error(`toBrowserImageData: buffer length ${e.length} does not match ${t}\xd7${r} RGBA (${l} bytes)`);if("u"<typeof ImageData)return{data:e,width:t,height:r,colorSpace:a??"srgb"};let o="u">typeof SharedArrayBuffer&&e.buffer instanceof SharedArrayBuffer?new Uint8ClampedArray(e):e;return a?new ImageData(o,t,r,{colorSpace:a}):new ImageData(o,t,r)}e.s(["toBrowserImageData",0,t],98842);let r=Object.freeze({colorChannels:3,polarity:"additive",depth:8});function a(e){return e.colorChannels+1}class l extends Error{operation;format;constructor(e,t){super(`${e}: unsupported pixel format (${function(e){return`colorChannels=${e.colorChannels}, polarity=${e.polarity}, depth=${e.depth}`}(t)}) — only RGBA8 (or, for CPU blend, any RGB-additive-8 format) is supported until P3c (the not-yet-planned native-CMYK follow-up to mememaker-color-management-phase3b-pixelformat-core) defines real CMYK semantics`),this.name="UnsupportedPixelFormatError",this.operation=e,this.format=t}}function o(e,t){return e.colorChannels===t.colorChannels&&e.polarity===t.polarity&&e.depth===t.depth}function n(e){return e===r||3===e.colorChannels&&"additive"===e.polarity&&8===e.depth}e.s(["RGBA8",0,r,"UnsupportedPixelFormatError",0,l,"asPixelBuffer",0,function(e){if(!Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<=0||e.height<=0)throw Error(`asPixelBuffer: width/height must be positive integers (got ${e.width}x${e.height})`);let t=e.width*e.height*4;if(e.data.length!==t)throw Error(`asPixelBuffer: data length ${e.data.length} does not match ${e.width}\xd7${e.height}\xd74 (${t} bytes) — malformed ImageData-shaped input`);return{data:e.data,width:e.width,height:e.height,format:r}},"assertRgba8",0,function(e,t){if(t!==r)throw new l(e,t)},"bytesPerPixel",0,a,"isSamePixelFormat",0,o,"pixelBufferToImageData",0,function(e,l="srgb"){if(!o(e.format,r))throw Error(`pixelBufferToImageData: only RGBA8 can become a browser ImageData (got ${e.format.colorChannels} colour channels, polarity "${e.format.polarity}", depth ${e.format.depth})`);if(!Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<=0||e.height<=0)throw Error(`pixelBufferToImageData: width/height must be positive integers (got ${e.width}x${e.height})`);let n=e.width*e.height*a(e.format);if(e.data.length!==n)throw Error(`pixelBufferToImageData: buffer length ${e.data.length} does not match ${e.width}\xd7${e.height}\xd7${a(e.format)} (${n} bytes)`);return t(e.data,e.width,e.height,l)}],399100),e.s(["assertBlendableFormat",0,function(e,t="blend"){if(!n(e))throw new l(t,e)},"isRgbAdditive8",0,n],312564)},46801,e=>{"use strict";var t=e.i(322623),r=e.i(628339),a=e.i(694053);let l=new Set(["levels","curves","posterize","brightnessContrast","exposure","invert","threshold","gradientMap","photoFilter"]),o=new Set(["threshold","gradientMap"]);e.s(["applyLutPassReference",0,function(e,t,r){if("perChannel"===r){for(let r=0;r<e.length;r+=4)e[r]=t[4*e[r]],e[r+1]=t[4*e[r+1]+1],e[r+2]=t[4*e[r+2]+2];return}for(let r=0;r<e.length;r+=4){let a=e[r],l=e[r+1],o=e[r+2],n=4*Math.max(0,Math.min(255,Math.round(.299*a+.587*l+.114*o))),i=t[n],s=t[n+1],c=t[n+2],h=t[n+3]/255;e[r]=i*h+a*(1-h),e[r+1]=s*h+l*(1-h),e[r+2]=c*h+o*(1-h)}},"bakeAdjustmentLUT",0,function(e,l,n,i){if("gradientMap"===e){let e=l??a.DEFAULT_GRADIENT_MAP_VALUES,t=(0,r.resolveGradientById)(e.gradientId,n,i),o=(0,r.buildGradientMapLUT)(t,e.reverse),s=new Uint8Array(1024);return s.set(o),{data:s,mode:"lumaIndexed"}}let s=function(){let e=new Uint8ClampedArray(1024);for(let t=0;t<256;t++)e[4*t]=t,e[4*t+1]=t,e[4*t+2]=t,e[4*t+3]=255;return new ImageData(e,256,1)}();(0,t.buildAdjustmentFilter)(e,l,n,i)(s);let c=new Uint8Array(1024);for(let e=0;e<256;e++)c[4*e]=s.data[4*e],c[4*e+1]=s.data[4*e+1],c[4*e+2]=s.data[4*e+2],c[4*e+3]=s.data[4*e+3];return{data:c,mode:o.has(e)?"lumaIndexed":"perChannel"}},"isLutBypassEligible",0,function(e){let t=e.adjustmentType;return!(!t||!l.has(t)||e.mask?.enabled)&&("gradientMap"!==t||!(e.gradientMap??a.DEFAULT_GRADIENT_MAP_VALUES).dither)&&("photoFilter"!==t||!(e.photoFilter??a.DEFAULT_PHOTO_FILTER_VALUES).preserveLuminosity)&&!0}])},272840,e=>{"use strict";function t(e){return Math.max(0,1-e/128)}function r(e){return Math.max(0,(e-128)/127)}function a(e){return 1-t(e)-r(e)}function l(e){return Math.min(255,Math.max(0,Math.round(e)))}e.s(["applyColorBalance",0,function(e,o){let n=e.data;for(let e=0;e<n.length;e+=4){let i=n[e],s=n[e+1],c=n[e+2],h=.3*i+.59*s+.11*c,u=t(h),d=a(h),m=r(h),g=o.shadows.cyanRed*u+o.midtones.cyanRed*d+o.highlights.cyanRed*m,f=o.shadows.magentaGreen*u+o.midtones.magentaGreen*d+o.highlights.magentaGreen*m,p=o.shadows.yellowBlue*u+o.midtones.yellowBlue*d+o.highlights.yellowBlue*m;n[e]=l(i+.6*g),n[e+1]=l(s+.6*f),n[e+2]=l(c+.6*p)}},"highlightsWeight",0,r,"midtonesWeight",0,a,"shadowsWeight",0,t])},65956,e=>{"use strict";var t=e.i(592605);let r={channelMixer:0,colorBalance:1,hueSaturation:2,vibrance:3,selectiveColor:4,replaceColor:5,blackAndWhite:6},a=new Set(Object.keys(r)),l=["reds","yellows","greens","cyans","blues","magentas"],o=`#version 300 es
layout(location = 0) in vec2 a_corner;
void main() {
  vec2 clip = a_corner * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`,n=`#version 300 es
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
  // Bug fix (found live 2026-09-04 by the WebGPU port's gpu-parity
  // harness, mememaker-gpu-backlog.md item #8): the constant term
  // (rc/gc/bc, u_p[0..2].w) is on the SAME 0-255 byte scale as the pixel
  // channels (channelMixerFilter.ts's real CPU semantics: clamp(rr*r +
  // rg*g + rb*b + rc) with r/g/b/rc all bytes; types.ts says "Constants
  // in -255..255") -- this shader works in 0..1 normalized space, so the
  // constant must be divided by 255 before being added, matching the WGSL
  // sibling (adjustmentShaders.wgsl.ts) and the CPU oracle exactly.
  vec4 rrow = u_p[0]; vec4 grow = u_p[1]; vec4 brow = u_p[2];
  float r = rrow.x*c.r + rrow.y*c.g + rrow.z*c.b + rrow.w/255.0;
  float g = grow.x*c.r + grow.y*c.g + grow.z*c.b + grow.w/255.0;
  float b = brow.x*c.r + brow.y*c.g + brow.z*c.b + brow.w/255.0;
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
}`;e.s(["DIRECT_ADJUSTMENT_TYPES",0,a,"DIRECT_FRAGMENT_SHADER",0,n,"DIRECT_VERTEX_SHADER",0,o,"directAdjustmentTypeIdOrDefault",0,function(e){return Object.prototype.hasOwnProperty.call(r,e)?r[e]:-1},"packDirectAdjustmentUniforms",0,function(e,r,a,o){let n=new Float32Array(40);switch(e){case"channelMixer":{let e=r??{rr:1,rg:0,rb:0,rc:0,gr:0,gg:1,gb:0,gc:0,br:0,bg:0,bb:1,bc:0};n.set([e.rr,e.rg,e.rb,e.rc,e.gr,e.gg,e.gb,e.gc,e.br,e.bg,e.bb,e.bc]);break}case"colorBalance":{let e=r??{shadows:{cyanRed:0,magentaGreen:0,yellowBlue:0},midtones:{cyanRed:0,magentaGreen:0,yellowBlue:0},highlights:{cyanRed:0,magentaGreen:0,yellowBlue:0}};n.set([e.shadows.cyanRed,e.shadows.magentaGreen,e.shadows.yellowBlue,0,e.midtones.cyanRed,e.midtones.magentaGreen,e.midtones.yellowBlue,0,e.highlights.cyanRed,e.highlights.magentaGreen,e.highlights.yellowBlue,0]);break}case"hueSaturation":{let e=r??{channels:Object.fromEntries(["master",...l].map(e=>[e,{hue:0,saturation:0,lightness:0}])),colorize:!1,colorizeHue:0,colorizeSaturation:25,colorizeLightness:0},t=e.channels.master,a=[t.hue,t.saturation,t.lightness,0];for(let t of l){let r=e.channels[t];a.push(r.hue,r.saturation,r.lightness,0)}a.push(+!!e.colorize,e.colorizeHue,e.colorizeSaturation,e.colorizeLightness),n.set(a);break}case"vibrance":{let e=r??{vibrance:0,saturation:0};n.set([e.vibrance,e.saturation,0,0]);break}case"selectiveColor":{let e=r??{mode:"relative",ranges:Object.fromEntries(["reds","yellows","greens","cyans","blues","magentas","whites","neutrals","blacks"].map(e=>[e,{cyan:0,magenta:0,yellow:0,black:0}]))},t=[+("absolute"===e.mode),0,0,0];for(let r of["reds","yellows","greens","cyans","blues","magentas","whites","neutrals","blacks"]){let a=e.ranges[r];t.push(a.cyan,a.magenta,a.yellow,a.black)}n.set(t);break}case"replaceColor":{let e=r??{target:[255,255,255],fuzziness:40,hue:0,saturation:0,lightness:0};n.set([e.target[0],e.target[1],e.target[2],e.fuzziness,e.hue,e.saturation,e.lightness,0]);break}case"blackAndWhite":{let e=r??{reds:40,yellows:60,greens:40,cyans:60,blues:20,magentas:80,tint:!1,tintColor:"#e2c39b"},[a,l]=e.tint?function(e){let r=e.replace("#",""),a=parseInt(r.slice(0,2),16),l=parseInt(r.slice(2,4),16),o=parseInt(r.slice(4,6),16),[n,i]=(0,t.rgbToHsl)(a,l,o);return[n,i]}(e.tintColor):[0,0];n.set([e.reds,e.yellows,e.greens,e.cyans,e.blues,e.magentas,0,0,+!!e.tint,a,l,0])}}return n}])},262512,e=>{"use strict";e.s(["buildLevelsLUT",0,function(e){let{inputBlack:t,inputWhite:r,gamma:a,outputBlack:l,outputWhite:o}=e,n=new Uint8ClampedArray(256),i=r-t;for(let e=0;e<256;e++){let r=0===i?e<t?0:1:(e-t)/i;r=Math.pow(r=Math.min(1,Math.max(0,r)),1/a),n[e]=l+(o-l)*r}return n}])},57540,e=>{"use strict";function t(e,t,r){let a=r;return(a<0&&(a+=1),a>1&&(a-=1),a<1/6)?e+(t-e)*6*a:a<.5?t:a<2/3?e+(t-e)*(2/3-a)*6:e}e.s(["applyVibrance",0,function(e,r){let{vibrance:a,saturation:l}=r;if(0===a&&0===l)return;let o=e.data,n=a/100,i=l/100;for(let e=0;e<o.length;e+=4){let[r,a,l]=function(e,t,r){let a=e/255,l=t/255,o=r/255,n=Math.max(a,l,o),i=Math.min(a,l,o),s=(n+i)/2;if(n===i)return[0,0,s];let c=n-i;return[n===a?((l-o)/c+6*(l<o))/6:n===l?((o-a)/c+2)/6:((a-l)/c+4)/6,s>.5?c/(2-n-i):c/(n+i),s]}(o[e],o[e+1],o[e+2]);if(0===a)continue;let s=a*(1-a)*n,c=a+s+i,[h,u,d]=function(e,r,a){if(0===r){let e=Math.round(255*a);return[e,e,e]}let l=a<.5?a*(1+r):a+r-a*r,o=2*a-l;return[Math.round(255*t(o,l,e+1/3)),Math.round(255*t(o,l,e)),Math.round(255*t(o,l,e-1/3))]}(r,c=Math.max(0,Math.min(1,c)),l);o[e]=h,o[e+1]=u,o[e+2]=d}}])}]);