/* Central configuration for preview, GPU memory, retime caching and export. */
(function(){
 'use strict';
 const KEY='pegas.effects.performance.v1';
 const BASE={
  profile:'auto',
  previewFps:30,previewScale:.58,adaptiveQuality:true,minPreviewScale:.32,maxPreviewScale:.82,
  previewCacheMB:72,gpuCacheMB:96,retimeCacheMB:160,
  exportMaxPixels:16777216,exportMaxFps:60,exportBitrateCapMbps:80,
  exportYieldEveryFrames:2,exportProgressEvery:3,
  effectPreviewMode:'all',retimeCacheEnabled:true
 };
 const PRESETS={
  performance:{previewFps:24,previewScale:.42,adaptiveQuality:true,minPreviewScale:.28,maxPreviewScale:.58,previewCacheMB:40,gpuCacheMB:48,retimeCacheMB:80,exportMaxPixels:12582912,exportMaxFps:60,exportBitrateCapMbps:48,exportYieldEveryFrames:1,exportProgressEvery:2,effectPreviewMode:'all',retimeCacheEnabled:true},
  balanced:{previewFps:30,previewScale:.58,adaptiveQuality:true,minPreviewScale:.32,maxPreviewScale:.78,previewCacheMB:72,gpuCacheMB:96,retimeCacheMB:160,exportMaxPixels:16777216,exportMaxFps:60,exportBitrateCapMbps:80,exportYieldEveryFrames:2,exportProgressEvery:3,effectPreviewMode:'all',retimeCacheEnabled:true},
  quality:{previewFps:60,previewScale:.82,adaptiveQuality:true,minPreviewScale:.5,maxPreviewScale:1,previewCacheMB:160,gpuCacheMB:160,retimeCacheMB:288,exportMaxPixels:25165824,exportMaxFps:120,exportBitrateCapMbps:120,exportYieldEveryFrames:4,exportProgressEvery:5,effectPreviewMode:'all',retimeCacheEnabled:true}
 };
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||a));
 function device(){
  const nav=window.navigator||{},mobile=matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const memory=Math.max(1,Number(nav.deviceMemory)||4),threads=Math.max(1,Number(nav.hardwareConcurrency)||4);
  const tier=(!mobile&&memory>=8&&threads>=10)?'high':(memory>=4&&threads>=6)?'medium':'low';
  return{mobile,memoryGB:memory,threads,tier};
 }
 function autoPreset(){
  const d=device();
  if(d.tier==='high')return{...PRESETS.balanced,previewScale:.64,maxPreviewScale:.86,previewCacheMB:96,gpuCacheMB:112,retimeCacheMB:224};
  if(d.tier==='medium')return{...PRESETS.balanced,previewScale:.52,maxPreviewScale:.72,previewCacheMB:64,gpuCacheMB:72,retimeCacheMB:128,previewFps:24};
  return{...PRESETS.performance,previewFps:20};
 }
 function clean(v){
  const out={...BASE,...v};
  if(!['auto','performance','balanced','quality','custom'].includes(out.profile))out.profile='auto';
  out.previewFps=Math.round(clamp(out.previewFps,15,60));
  out.previewScale=clamp(out.previewScale,.25,1);
  out.minPreviewScale=clamp(out.minPreviewScale,.2,.9);
  out.maxPreviewScale=clamp(out.maxPreviewScale,.3,1);
  if(out.minPreviewScale>out.maxPreviewScale)out.minPreviewScale=out.maxPreviewScale;
  for(const k of ['previewCacheMB','gpuCacheMB','retimeCacheMB'])out[k]=Math.round(clamp(out[k],16,512));
  out.exportMaxPixels=Math.round(clamp(out.exportMaxPixels,2073600,33554432));
  out.exportMaxFps=Math.round(clamp(out.exportMaxFps,24,120));
  out.exportBitrateCapMbps=clamp(out.exportBitrateCapMbps,12,160);
  out.exportYieldEveryFrames=Math.round(clamp(out.exportYieldEveryFrames,1,12));
  out.exportProgressEvery=Math.round(clamp(out.exportProgressEvery,1,20));
  out.adaptiveQuality=out.adaptiveQuality!==false;
  out.retimeCacheEnabled=out.retimeCacheEnabled!==false;
  if(!['all','smart'].includes(out.effectPreviewMode))out.effectPreviewMode='all';
  return out;
 }
 function read(){
  let stored={};try{stored=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
  const profile=stored.profile||BASE.profile;
  if(profile==='auto')return clean({...BASE,...autoPreset(),...stored,profile});
  if(PRESETS[profile])return clean({...BASE,...PRESETS[profile],...stored,profile});
  return clean({...BASE,...stored,profile});
 }
 let current=read();
 function save(patch){
  current=clean({...current,...patch});
  try{localStorage.setItem(KEY,JSON.stringify(current))}catch{}
  return current;
 }
 function setProfile(profile){
  if(profile==='auto')return save({...autoPreset(),profile:'auto'});
  if(PRESETS[profile])return save({...PRESETS[profile],profile});
  return save({profile:'custom'});
 }
 function reset(){try{localStorage.removeItem(KEY)}catch{}current=read();return current}
 window.CutroomPerformanceConfig={BASE,PRESETS,device,get:()=>({...current}),save,setProfile,reset,refresh:()=>{current=read();return current}};
})();