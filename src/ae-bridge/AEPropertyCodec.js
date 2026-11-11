/* Converts AE's recursive Property/PropertyGroup export into a typed, lossless property tree. */
(function(root){
 'use strict';
 const clone=v=>root.PEG.Schema.clone(v);
 const typeOfValue=v=>v===null?'null':Array.isArray(v)?'vector':typeof v==='number'?'number':typeof v==='boolean'?'boolean':typeof v==='string'?'string':typeof v==='object'?(v.$type||'object'):'unknown';
 function normalizeKey(k,duration){
  const time=Number.isFinite(+k.time)?+k.time:null,local=Number.isFinite(+k.localTime)?+k.localTime:(time===null?null:time);
  const normalized=Number.isFinite(+k.normalizedTime)?+k.normalizedTime:(local===null||!(duration>0)?null:local/duration);
  return{
   time,localTime:local,normalizedTime:normalized,
   value:clone(k.value),valueType:k.valueType||typeOfValue(k.value),
   interpolation:k.interpolation||'unknown',inInterpolation:k.inInterpolation||k.interpolation||'unknown',
   outInterpolation:k.outInterpolation||k.interpolation||'unknown',
   inTemporalEase:clone(k.inTemporalEase||[]),outTemporalEase:clone(k.outTemporalEase||[]),
   temporalAutoBezier:!!k.temporalAutoBezier,temporalContinuous:!!k.temporalContinuous,
   spatialAutoBezier:!!k.spatialAutoBezier,spatialContinuous:!!k.spatialContinuous,
   inSpatialTangent:clone(k.inSpatialTangent||null),outSpatialTangent:clone(k.outSpatialTangent||null),
   roving:!!k.roving,selected:!!k.selected,
   sourceIndex:Number.isFinite(+k.sourceIndex)?+k.sourceIndex:null
  }
 }
 function normalizeNode(node,duration,path){
  node=node||{};const name=String(node.name||node.matchName||'Property'),matchName=String(node.matchName||'');
  const fullPath=path?path.concat([{name,matchName,index:Number(node.propertyIndex)||0}]):[{name,matchName,index:Number(node.propertyIndex)||0}];
  const children=Array.isArray(node.children)?node.children:[];
  const keys=Array.isArray(node.keys)?node.keys.map(k=>normalizeKey(k,duration)):[];
  const result={
   nodeType:node.nodeType||(children.length?'group':'property'),
   name,matchName,displayName:String(node.displayName||name),
   propertyIndex:Number(node.propertyIndex)||0,
   propertyValueType:node.propertyValueType??null,
   propertyValueTypeName:String(node.propertyValueTypeName||''),
   valueType:node.valueType||typeOfValue(node.value),
   value:clone(node.value),defaultValue:clone(node.defaultValue),
   canVaryOverTime:!!node.canVaryOverTime,enabled:node.enabled!==false,
   expression:String(node.expression||''),expressionEnabled:!!node.expressionEnabled,
   expressionError:String(node.expressionError||''),
   isSeparationLeader:!!node.isSeparationLeader,isSeparationFollower:!!node.isSeparationFollower,
   dimensionsSeparated:!!node.dimensionsSeparated,dimensions:Number(node.dimensions)||0,
   isSpatial:!!node.isSpatial,hasMin:!!node.hasMin,minValue:clone(node.minValue),
   hasMax:!!node.hasMax,maxValue:clone(node.maxValue),
   keys,children:[],path:fullPath,
   source:clone(node.source||{})
  };
  result.children=children.map(c=>normalizeNode(c,duration,fullPath));
  return result
 }
 function flatten(nodes){
  const out=[];
  const visit=(node,path)=>{
   const p=(path||[]).concat([{name:node.name,matchName:node.matchName,index:node.propertyIndex}]);
   if(node.nodeType!=='group'&&!node.children.length)out.push({...node,path:p.map(x=>({...x})),pathName:p.map(x=>x.name).join(' / '),pathMatchName:p.map(x=>x.matchName).filter(Boolean).join(' > ')});
   else node.children.forEach(c=>visit(c,p))
  };
  (nodes||[]).forEach(n=>visit(n,[]));return out
 }
 function normalizeEffects(effects,duration){
  return(effects||[]).map((effect,index)=>{
   const props=(effect.properties||[]).map(p=>normalizeNode(p,duration,[]));
   return{
    sourceIndex:Number.isFinite(+effect.sourceIndex)?+effect.sourceIndex:index,
    name:String(effect.name||effect.matchName||'Unknown Effect'),matchName:String(effect.matchName||''),
    enabled:effect.enabled!==false,active:effect.active!==false,
    properties:props,flatProperties:flatten(props),
    source:clone(effect.source||{})
   }
  })
 }
 root.PEG.PropertyCodec={typeOfValue,normalizeKey,normalizeNode,flatten,normalizeEffects};
})(window);