/* Frame pacing and adaptive preview resolution. Export resolution is never changed here. */
(function(){
 'use strict';
 const config=window.CutroomPerformanceConfig;
 let settings=config?.get?.()||{},scale=settings.previewScale||.58,nextFrameAt=0,avg=0,samples=0,slow=0,fast=0,lastChange=0;
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 function refresh(next){
  settings=next||config?.get?.()||settings;
  scale=clamp(settings.previewScale||scale,settings.minPreviewScale||.28,settings.maxPreviewScale||1);
  avg=0;samples=slow=fast=0;nextFrameAt=0;
  return scale;
 }
 function shouldRender(now,playing,dirty){
  if(!playing&&!dirty)return false;
  if(!playing)return true;
  const fps=clamp(settings.previewFps||30,15,60),interval=1000/fps;
  if(now+0.25<nextFrameAt)return false;
  nextFrameAt=now+interval;
  return true;
 }
 function recordPreviewFrame(ms){
  if(!Number.isFinite(ms)||ms<0)return{scale,changed:false,avg};
  avg=samples?avg*.88+ms*.12:ms;samples++;
  if(!settings.adaptiveQuality||settings.profile==='quality')return{scale,changed:false,avg};
  const frameBudget=1000/clamp(settings.previewFps||30,15,60);
  if(avg>frameBudget*.88){slow++;fast=0}else if(avg<frameBudget*.48){fast++;slow=0}else{slow=Math.max(0,slow-1);fast=Math.max(0,fast-1)}
  const now=performance.now();let changed=false;
  if(slow>=5&&now-lastChange>1200){
   const min=settings.minPreviewScale||.28,newScale=Math.max(min,Math.round((scale-.06)*100)/100);
   if(newScale<scale){scale=newScale;changed=true}
   slow=0;lastChange=now;
  }else if(fast>=36&&now-lastChange>2500){
   const max=settings.maxPreviewScale||.85,newScale=Math.min(max,Math.round((scale+.025)*1000)/1000);
   if(newScale>scale){scale=newScale;changed=true}
   fast=0;lastChange=now;
  }
  return{scale,changed,avg};
 }
 function setScale(value){
  scale=clamp(value,settings.minPreviewScale||.25,settings.maxPreviewScale||1);
  settings=config?.save?.({profile:'custom',previewScale:scale})||{...settings,previewScale:scale};
  return scale;
 }
 window.CutroomPerformance={
  shouldRender,recordPreviewFrame,getScale:()=>scale,getSettings:()=>({...settings}),
  update:refresh,setScale,
  stats:()=>({scale,averageRenderMs:Math.round(avg*10)/10,samples,previewFps:settings.previewFps})
 };
})();