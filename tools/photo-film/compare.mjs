// Reproducible shared-renderer QA on an existing local image, not a camera/LUT match.
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {DEFAULT_PRESETS,FILM_STOCK_PRESETS,FRAMES,computeEffectiveFilter,seedFor} from '../../src/lib/photo/film.mjs';
import {normalizePhoto,renderPrintPhoto} from '../../src/lib/photo/image.mjs';
const source=resolve(process.argv[2]||'public/images/000047.webp');
const destination=resolve(process.argv[3]||'photo-film-qa/stocks-indoor');
await mkdir(destination,{recursive:true});
const input=await normalizePhoto(await sharp(source).toBuffer());
const ratio=148/100,w=Math.min(input.width,input.height*ratio),h=w/ratio;
const crop={x:(input.width-w)/2/input.width,y:(input.height-h)/2/input.height,width:w/input.width,height:h/input.height};
const find=id=>DEFAULT_PRESETS.find(p=>p.id===id);
const choices=[find('natural'),...FILM_STOCK_PRESETS,find('soft_wedding'),find('classic_story'),find('timeless_bw')];
const f=FRAMES.landscape,layers=[];
for(const [i,p] of choices.entries()) {
 const jpeg=await renderPrintPhoto(input.bytes,crop,'landscape',input.width,input.height,{computed:computeEffectiveFilter(p),seed:seedFor(source)});
 await writeFile(join(destination,p.id+'.jpg'),jpeg);
 const left=(i%3)*480,top=Math.floor(i/3)*370;
 layers.push({input:await sharp(jpeg).extract({left:f.left,top:f.top,width:f.photoWidth,height:f.photoHeight}).resize(480,324).toBuffer(),left,top});
 const label=Buffer.from(`<svg width="480" height="46"><rect width="480" height="46" fill="#fdfaf5"/><text x="12" y="29" font-size="20" fill="#231d16">${p.name.replaceAll('&','&amp;')} · ${p.defaultIntensity}%</text></svg>`);
 layers.push({input:label,left,top:top+324});
}
await sharp({create:{width:1440,height:1110,channels:3,background:'#fdfaf5'}}).composite(layers).png().toFile(join(destination,'comparison.png'));
console.log(join(destination,'comparison.png'));
