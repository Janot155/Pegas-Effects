/* Reuses decoded source frames for reverse/boomerang playback and repeated exports. */
(function(){
 'use strict';
 const entries=new Map();let bytes=0,budget=96*1024*1024,pending=0,enabled=true;
 const key=(clip,frame,w,h)=>clip+'|'+frame+'|'+w+'x'+h;
 function drop(k,item){entries.delete(k);bytes=Math.max(0,bytes-(item.bytes||0));try{item.bitmap?.close?.()}catch{}}
 function trim(){
  while(bytes>budget&&entries.size){let oldest=null;for(const [k,v] of entries){if(!oldest||v.used<oldest[1].used)oldest=[k,v]}if(!oldest)break;drop(oldest[0],oldest[1])}
 }
 function get(clip,frame,w,h){
  if(!enabled)return null;const k=key(clip,frame,w,h),v=entries.get(k);if(!v)return null;
  v.used=performance.now();entries.delete(k);entries.set(k,v);return v.bitmap;
 }
 function has(clip,frame,w,h){return !!get(clip,frame,w,h)}
 function store(clip,frame,w,h,canvas){
  if(!enabled||typeof createImageBitmap!=='function'||pending>=4||w*h*4>budget*.35)return;
  const k=key(clip,frame,w,h);if(entries.has(k)){const v=entries.get(k);v.used=performance.now();return}
  pending++;
  createImageBitmap(canvas).then(bitmap=>{
   if(!enabled){bitmap.close?.();return}
   const bytesNow=Math.max(4,w*h*4);entries.set(k,{bitmap,bytes:bytesNow,used:performance.now()});bytes+=bytesNow;trim();
  }).catch(()=>{}).finally(()=>pending=Math.max(0,pending-1));
 }
 function clearClip(clip){for(const [k,v] of entries)if(k.startsWith(clip+'|'))drop(k,v)}
 function clear(){for(const [k,v] of entries)drop(k,v);entries.clear();bytes=0}
 function configure(opts={}){
  if(Number.isFinite(opts.budgetMB)){budget=Math.max(16,Math.min(512,opts.budgetMB))*1024*1024}
  if(typeof opts.enabled==='boolean')enabled=opts.enabled;
  trim();
 }
 window.CutroomRetimeCache={get,has,store,clearClip,clear,configure,stats:()=>({frames:entries.size,bytes,budget,enabled,pending})};
})();