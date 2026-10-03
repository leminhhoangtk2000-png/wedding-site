'use client';

import { useEffect, useRef, useState } from 'react';
import { FRAMES, transformPixels, seedFor } from '@/lib/photo/film.mjs';

// Decode cache prevents seven preset thumbnails from downloading the same photo.
const images = new Map();
function loadImage(url) {
  if (!images.has(url)) {
    const promise = new Promise((resolve,reject) => {
      const image = new Image(); image.crossOrigin='anonymous';
      image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Failed to load photo preview.'));
      image.src=url;
    });
    images.set(url,promise);promise.catch(()=>images.delete(url));
    if(images.size>12)images.delete(images.keys().next().value);
  }
  return images.get(url);
}

export default function FilmPhoto({ imageUrl, crop, orientation='portrait', filter, seed=0, thumbnail=false, onStateChange }) {
  const ref=useRef(null), [state,setState]=useState('loading');
  const filterKey=JSON.stringify(filter||{}), cropKey=JSON.stringify(crop||null);
  useEffect(()=>{
    let active=true;
    const update = value => { if(active){setState(value);onStateChange?.(value);} };
    update('loading');
    loadImage(imageUrl).then(image=>{
      if(!active||!ref.current)return;
      const f=FRAMES[orientation],canvas=ref.current;
      const scale=thumbnail?Math.min(1,240/f.photoWidth):1;
      canvas.width=Math.round(f.photoWidth*scale);canvas.height=Math.round(f.photoHeight*scale);
      const context=canvas.getContext('2d',{willReadFrequently:true});
      const savedCrop=JSON.parse(cropKey);
      let region;
      if(savedCrop) {
        const left=Math.floor(savedCrop.x*image.naturalWidth),top=Math.floor(savedCrop.y*image.naturalHeight);
        region=[left,top,Math.min(Math.round(savedCrop.width*image.naturalWidth),image.naturalWidth-left),Math.min(Math.round(savedCrop.height*image.naturalHeight),image.naturalHeight-top)];
      }else {
        const ratio=f.photoWidth/f.photoHeight,w=Math.min(image.naturalWidth,image.naturalHeight*ratio),h=w/ratio;
        region=[(image.naturalWidth-w)/2,(image.naturalHeight-h)/2,w,h];
      }
      context.drawImage(image,...region,0,0,canvas.width,canvas.height);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height);
      transformPixels(pixels.data,canvas.width,canvas.height,JSON.parse(filterKey),typeof seed==='string'?seedFor(seed):seed,f.photoWidth,f.photoHeight);
      context.putImageData(pixels,0,0);update('ready');
    }).catch(()=>update('error'));
    return ()=>{active=false;};
  },[imageUrl,cropKey,filterKey,orientation,seed,thumbnail,onStateChange]);
  return <>
    <canvas ref={ref} aria-label="Photo with selected film tone" role="img" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none',opacity:state==='ready'?1:0}} />
    {state!=='ready'&&<span role={state==='error'?'alert':'status'} style={{position:'absolute',inset:0,display:'grid',placeItems:'center',padding:8,fontSize:12,color:'#231d16',background:'#ebe4d8'}}>{state==='error'?'Unable to load color preview. Please reload photo to retry.':'Applying film tone…'}</span>}
  </>;
}
