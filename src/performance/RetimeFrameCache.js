/* Bounded, downscaled frame cache and optional retime pre-renderer. */
(function(){
 'use strict';
 const entries=new Map();let bytes=0,budget=160*1024*1024,pending=0,enabled=true;
 const MAX_DIMENSION=720;
 const key=(clip,frame,w,h)=>clip+'|'+frame+'|'+w+'x'+h;
 function drop(k,item){entries.delete(k);bytes=Math.max(0,bytes-(item.bytes||0));try{item.bitmap?.close?.()}catch{}}
 function trim(){
  while(bytes>budget&&entries.size){
   let oldest=null;for(const [k,v] of entries)if(!oldest||v.used<oldest[1].used)oldest=[k,v];
   if(!oldest)break;drop(oldest[0],oldest[1])
  }
 }
 function get(clip,frame,w,h){
  if(!enabled)return null;const k=key(clip,frame,w,h),v=entries.get(k);if(!v)return null;
  v.used=performance.now();entries.delete(k);entries.set(k,v);return v.bitmap
 }
 function has(clip,frame,w,h){return !!get(clip,frame,w,h)}
 function store(clip,frame,w,h,canvas){
  if(!enabled||typeof createImageBitmap!=='function'||pending>=4||w*h*4>budget*.7)return Promise.resolve(false);
  const k=key(clip,frame,w,h),existing=entries.get(k);
  if(existing){existing.used=performance.now();return Promise.resolve(true)}
  let source=canvas;
  const factor=Math.min(1,MAX_DIMENSION/Math.max(w,h));
  if(factor<1){
   const down=document.createElement('canvas'),dw=Math.max(1,Math.round(w*factor)),dh=Math.max(1,Math.round(h*factor));
   down.width=dw;down.height=dh;const dc=down.getContext('2d',{alpha:true});
   if(!dc)return Promise.resolve(false);dc.drawImage(canvas,0,0,dw,dh);source=down;
  }
  pending++;
  return createImageBitmap(source).then(bitmap=>{
   if(!enabled){bitmap.close?.();return false}
   const bytesNow=Math.max(4,bitmap.width*bitmap.height*4);
   entries.set(k,{bitmap,bytes:bytesNow,used:performance.now()});bytes+=bytesNow;trim();return entries.has(k)
  }).catch(()=>false).finally(()=>pending=Math.max(0,pending-1))
 }
 function clearClip(clip){for(const [k,v] of entries)if(k.startsWith(clip+'|'))drop(k,v)}
 function clear(){for(const [k,v] of entries)drop(k,v);entries.clear();bytes=0}
 function configure(opts={}){
  if(Number.isFinite(opts.budgetMB))budget=Math.max(16,Math.min(512,opts.budgetMB))*1024*1024;
  if(typeof opts.enabled==='boolean')enabled=opts.enabled;
  trim()
 }
 const waitEvent=(video,event,timeout=12000)=>new Promise((resolve,reject)=>{
  let done=false;const finish=(ok,value)=>{if(done)return;done=true;clearTimeout(timer);video.removeEventListener(event,onOk);video.removeEventListener('error',onErr);ok?resolve(value):reject(value)};
  const onOk=()=>finish(true),onErr=()=>finish(false,new Error('Video decoding failed while pre-rendering retime frames.'));
  const timer=setTimeout(()=>finish(false,new Error('Timed out while decoding a retime frame.')),timeout);
  video.addEventListener(event,onOk,{once:true});video.addEventListener('error',onErr,{once:true});
 });
 async function precacheVideo(options={}){
  const {clipId,src,start=0,end=0,fps=30,width,height,fit='cover',onProgress}=options;
  if(!enabled)throw new Error('Retime frame cache is disabled in Performance settings.');
  if(typeof createImageBitmap!=='function')throw new Error('This browser does not support frame caching.');
  if(!clipId||!src||!width||!height)throw new Error('Missing retime pre-cache input.');
  const rate=Math.max(1,Math.min(120,Number(fps)||30)),first=Math.max(0,Math.ceil(Math.max(0,start)*rate)),last=Math.max(first,Math.floor(Math.max(start,end-1/rate)*rate));
  const total=last-first+1,video=document.createElement('video'),canvas=document.createElement('canvas');
  video.muted=true;video.playsInline=true;video.preload='auto';video.src=src;canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not create a retime cache canvas.');
  let cached=0,skipped=0;
  try{
   video.load();
   if(video.readyState<1)await waitEvent(video,'loadedmetadata');
   if(video.videoWidth<=0||video.videoHeight<=0)throw new Error('Source video has no decodable frames.');
   const scale=fit==='cover'?Math.max(width/video.videoWidth,height/video.videoHeight):Math.min(width/video.videoWidth,height/video.videoHeight);
   const dw=video.videoWidth*scale,dh=video.videoHeight*scale,dx=(width-dw)/2,dy=(height-dh)/2;
   for(let frame=first;frame<=last;frame++){
    if(has(clipId,frame,width,height)){cached++;continue}
    const time=frame/rate;
    if(Math.abs((Number(video.currentTime)||0)-time)>0.0005||video.readyState<2){
     const seek=waitEvent(video,'seeked');video.currentTime=time;await seek;
    }
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.drawImage(video,dx,dy,dw,dh);
    if(await store(clipId,frame,width,height,canvas))cached++;else skipped++;
    if((frame-first)%4===0){onProgress?.({done:frame-first+1,total,cached,skipped});await new Promise(resolve=>setTimeout(resolve,0))}
   }
   onProgress?.({done:total,total,cached,skipped});
   return{total,cached,skipped,first,last,bytes};
  }finally{
   try{video.pause();video.removeAttribute('src');video.load()}catch{}
  }
 }
 window.CutroomRetimeCache={get,has,store,clearClip,clear,configure,precacheVideo,stats:()=>({frames:entries.size,bytes,budget,enabled,pending})};
})();