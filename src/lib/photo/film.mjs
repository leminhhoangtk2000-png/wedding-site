// Pure, deterministic sRGB transform shared by browser Canvas and server Sharp.
// Inspired looks, not Fujifilm's proprietary film simulations.
export const ENGINE_VERSION = 'wedding-film-v1';
export const FRAME_VERSION = 'wedding-floral-v1';
export const FRAMES = {
  portrait: { width:1181, height:1748, left:178, top:264, photoWidth:824, photoHeight:1220 },
  landscape: { width:1748, height:1181, left:245, top:205, photoWidth:1258, photoHeight:850 },
};
const settings = (brightness=0,warmth=0,contrast=0,saturation=0,fade=0,grain=0) => ({brightness,warmth,contrast,saturation,fade,grain});
const preset = (id,name,subtitle,tags,profile,defaultIntensity,values,isDefault=false,monochrome=false) =>
  ({id,name,subtitle,tags,profile,defaultIntensity,settings:values,enabled:true,isDefault,monochrome,icon:monochrome?'◐':'✦'});
export const DEFAULT_PRESETS = [
  preset('natural','Original','Keep original camera colors',[], 'original',100,settings()),
  preset('soft_wedding','Soft Wedding','Natural skin tones with gentle transitions',['Afternoon','Portrait'],'astia',70,settings(2,0,-3,1,1,2),true),
  preset('golden_memory','Golden Memory','Amber sunset glow with nostalgic warmth',['Afternoon'],'nostalgic',60,settings(1,0,-2,-3,2,3)),
  preset('clean_portrait','Clean Portrait','Smooth skin tones for indoor lighting & flash',['Portrait'],'pro_neg',60,settings(1,0,-4,-4,0,1)),
  preset('evening_cinema','Evening Cinema','Subtle cinema palette with soft shadows',['Evening'],'eterna',60,settings(0,0,-6,-8,2,1)),
  preset('classic_story','Classic Story','Documentary tones with cool crisp contrast',['Afternoon','Evening'],'chrome',60,settings(0,0,2,-6,1,3)),
  preset('timeless_bw','Timeless B&W','Monochrome elegance with fine film grain',['Evening','Portrait'],'acros',100,settings(1,0,3,0,0,4),false,true),
];
// Old IDs stay distinct. Never remap a restored draft to a different look.
export const LEGACY_PRESETS = [
  preset('warm_film','Warm Film (Legacy)','Previous draft preset',[],'legacy',100,settings(5,26,8,-6,10,16)),
  preset('vintage_soft','Soft Vintage (Legacy)','Previous draft preset',[],'legacy',100,settings(8,12,-12,-18,18,12)),
  preset('bw_classic','Classic B&W (Legacy)','Previous draft preset',[],'acros',100,settings(2,0,16,-100,8,20),false,true),
];
export const DEFAULT_GUEST_ADJUSTMENTS = {intensity:70,brightness:0,warmth:0};
export const defaultAdjustments = p => ({intensity:p?.defaultIntensity??100,brightness:0,warmth:0});
const clamp = (v,lo=0,hi=1) => Math.max(lo,Math.min(hi,v));
const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const curves = {
  original:[0,.25,.5,.75,1],legacy:[0,.25,.5,.75,1],
  astia:[0,.27,.52,.76,1],nostalgic:[.012,.27,.53,.78,1],
  pro_neg:[0,.27,.51,.74,1],eterna:[.018,.29,.51,.73,1],
  chrome:[0,.23,.50,.76,1],acros:[0,.23,.52,.78,1],
};
function curve(v,points) {const n=clamp(v)*4,i=Math.min(3,Math.floor(n));return points[i]+(points[i+1]-points[i])*(n-i);}
export function computeEffectiveFilter(p,adjustments=defaultAdjustments(p)) {
  const t=clamp(adjustments.intensity??p.defaultIntensity,0,100)/100;
  const s=p.settings;
  return {profile:p.profile,monochrome:p.monochrome,intensity:t*100,
    brightness:clamp(s.brightness*t+(adjustments.brightness??0),-50,50),
    warmth:p.monochrome?0:clamp(s.warmth*t+(adjustments.warmth??0),-50,50),
    contrast:s.contrast*t,saturation:s.saturation*t,fade:s.fade*t,grain:s.grain*t};
}
export function seedFor(value) {let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function noise(x,y,seed) {let h=Math.imul(x+1,374761393)^Math.imul(y+1,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295-.5;}
export function transformPixels(data,width,height,filter={},seed=0,referenceWidth=width,referenceHeight=height) {
  const f={brightness:0,warmth:0,contrast:0,saturation:0,fade:0,grain:0,intensity:100,profile:'original',...filter};
  const t=clamp(f.intensity,0,100)/100, points=curves[f.profile]||curves.legacy;
  if(!f.monochrome && !f.brightness && !f.warmth && !f.contrast && !f.saturation && !f.fade && !f.grain && (t===0 || ['original','legacy'].includes(f.profile)))return data;
  const exposure=2**(f.brightness/100), contrast=1+f.contrast*.006;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const i=(y*width+x)*4;let r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255;
    const l=.2126*r+.7152*g+.0722*b;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),chroma=max-min;
    // Soft masks, not inferred faces. Protect low-chroma whites from amber tint.
    const colorful=smooth(.035,.22,chroma), highlights=smooth(.45,.9,l);
    const shadows=1-smooth(.08,.5,l), skin=(r>=g&&g>=b)?smooth(.015,.12,r-b):0;
    const d=(curve(l,points)-l)*t;
    r+=d;g+=d;b+=d;
    if(f.profile==='nostalgic') {r+=.025*highlights*colorful*t;g+=.008*highlights*colorful*t;b-=.022*highlights*colorful*t;}
    if(f.profile==='chrome') {r-=.012*shadows*t;b+=.018*shadows*t;g+=.003*shadows*t;}
    // Selective foliage and blue saturation; skin receives a gentler adjustment.
    const foliage=(g>r&&g>b)?1:0, blue=(b>r&&b>g)?1:0;
    const sat=clamp(1+f.saturation*.01,0,1.5);
    const group=f.profile==='astia'?1+.055*foliage*t:f.profile==='chrome'?1-.09*(foliage+blue)*t:f.profile==='eterna'?1-.04*blue*t:1;
    const saturation=(1+(sat-1)*(1-.45*skin))*group;
    let lum=.2126*r+.7152*g+.0722*b;
    r=lum+(r-lum)*saturation;g=lum+(g-lum)*saturation;b=lum+(b-lum)*saturation;
    // Temperature is an RGB balance adjustment, not hue rotation or sepia.
    const warmth=f.warmth*.00065*(1-.8*highlights*(1-colorful));
    r+=warmth;g+=warmth*.15;b-=warmth;
    r=(r-.5)*contrast+.5;g=(g-.5)*contrast+.5;b=(b-.5)*contrast+.5;
    const lift=f.fade*.0008*(1-smooth(.05,.65,l));
    r=r*exposure+lift;g=g*exposure+lift;b=b*exposure+lift;
    if(f.monochrome) {lum=.2126*r+.7152*g+.0722*b;r=g=b=lum;}
    // Fine luminance grain at final print coordinates; suppressed in dark inputs.
    const n=noise(Math.floor(x*referenceWidth/width),Math.floor(y*referenceHeight/height),seed)*f.grain*.0008*smooth(.08,.4,l);
    data[i]=Math.round(clamp(r+n)*255);data[i+1]=Math.round(clamp(g+n)*255);data[i+2]=Math.round(clamp(b+n)*255);
  }
  return data;
}
export function validateAdjustments(a) {
  if(!a||typeof a!=='object'||Array.isArray(a))throw new Error('INVALID_FILTER');
  const out={};for(const [key,lo,hi] of [['intensity',0,100],['brightness',-50,50],['warmth',-50,50]]) {
    const v=a[key];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new Error('INVALID_FILTER');out[key]=v;
  }return out;
}
export function canonicalFilter(input) {
  if(input==null)return null;
  if(typeof input.preset_id!=='string'||!Number.isInteger(input.config_version)||input.config_version<0)throw new Error('INVALID_FILTER');
  return {preset_id:input.preset_id,config_version:input.config_version,adjustments:validateAdjustments(input.adjustments)};
}
export function validatePresets(input) {
  if(!Array.isArray(input)||input.length!==DEFAULT_PRESETS.length)throw new Error('INVALID_FILTER');
  const result=DEFAULT_PRESETS.map(def=>{
    const matches=input.filter(p=>p.id===def.id);if(matches.length!==1)throw new Error('INVALID_FILTER');const p=matches[0];
    if(typeof p.enabled!=='boolean'||typeof p.isDefault!=='boolean')throw new Error('INVALID_FILTER');
    const s={};for(const key of Object.keys(def.settings)) {
      const lo=['grain','fade'].includes(key)?0:key==='saturation'?-100:-50;
      const v=p.settings?.[key];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>50)throw new Error('INVALID_FILTER');s[key]=v;
    }
    if(def.id==='natural'&&(!p.enabled||Object.values(s).some(v=>v!==0)))throw new Error('INVALID_FILTER');
    return {...def,settings:s,enabled:p.enabled,isDefault:p.isDefault};
  });
  if(result.filter(p=>p.isDefault).length!==1||!result.find(p=>p.isDefault).enabled)throw new Error('INVALID_FILTER');
  return result;
}
