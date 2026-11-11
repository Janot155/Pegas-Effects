/* AE temporal-ease metadata is kept intact; scalar mapped values can use AE-like temporal Bezier curves. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const easeList=v=>Array.isArray(v)?v:[];
 const scalarEase=v=>{const x=easeList(v)[0]||{};return{speed:Number(x.speed)||0,influence:clamp(Number(x.influence)||0,0,100)}};
 function interpName(k){
  const s=String(k.outInterpolation||k.interpolation||'').toLowerCase();
  if(s==='hold')return'hold';if(s==='bezier'||k.inTemporalEase?.length||k.outTemporalEase?.length||k.temporalAutoBezier)return'bezier';
  if(s==='linear')return'linear';return'linear'
 }
 function toPresetKey(k,duration){
  const t=Number.isFinite(+k.normalizedTime)?+k.normalizedTime:(duration>0?(+k.localTime||0)/duration:(+k.time||0));
  const v=k.value;
  if(typeof v!=='number'||!Number.isFinite(v))return null;
  return{t:clamp(t,0,1),v,e:interpName(k),meta:{ae:{
   inInterpolation:k.inInterpolation||k.interpolation||'unknown',
   outInterpolation:k.outInterpolation||k.interpolation||'unknown',
   inTemporalEase:easeList(k.inTemporalEase),outTemporalEase:easeList(k.outTemporalEase),
   temporalAutoBezier:!!k.temporalAutoBezier,temporalContinuous:!!k.temporalContinuous,
   spatialAutoBezier:!!k.spatialAutoBezier,spatialContinuous:!!k.spatialContinuous,
   inSpatialTangent:k.inSpatialTangent||null,outSpatialTangent:k.outSpatialTangent||null,
   roving:!!k.roving,originalTime:k.time??null,originalLocalTime:k.localTime??null
  }}}
 }
 const cubic=(t,p1,p2)=>3*(1-t)*(1-t)*t*p1+3*(1-t)*t*t*p2+t*t*t;
 function bezierEase(a,b,u){
  const ma=a?.meta?.ae,mb=b?.meta?.ae;
  if(!ma&&!mb)return null;
  const dt=Math.max(1e-9,b.t-a.t),delta=b.v-a.v;
  if(Math.abs(delta)<1e-12)return a.v;
  const out=scalarEase(ma?.outTemporalEase),inn=scalarEase(mb?.inTemporalEase);
  let x1=out.influence/100,x2=1-inn.influence/100;
  if(!ma?.outTemporalEase?.length)x1=1/3;
  if(!mb?.inTemporalEase?.length)x2=2/3;
  let y1=ma?.temporalAutoBezier?x1:(out.speed*dt*x1/delta);
  let y2=mb?.temporalAutoBezier?1-x2:1-(inn.speed*dt*(1-x2)/delta);
  if(!Number.isFinite(y1))y1=x1;if(!Number.isFinite(y2))y2=x2;
  y1=clamp(y1,-4,5);y2=clamp(y2,-4,5);
  let lo=0,hi=1,t=clamp(u,0,1);
  for(let i=0;i<24;i++){t=(lo+hi)/2;if(cubic(t,x1,x2)<u)lo=t;else hi=t}
  return a.v+delta*cubic(t,y1,y2)
 }
 function evaluate(a,b,u,fallback){
  if(a?.e==='hold')return a.v;
  const exact=bezierEase(a,b,u);if(exact!==null)return exact;
  return fallback?fallback(u):a.v+(b.v-a.v)*u
 }
 root.PEG.KeyframeCodec={interpName,toPresetKey,bezierEase,evaluate};
})(window);