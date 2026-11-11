/* Compiles a complete AE bridge export into PEG + the existing Cutroom-native preset schema. */
(function(root){
 'use strict';
 const S=()=>root.PEG.Schema,C=()=>root.PEG.PropertyCodec,K=()=>root.PEG.KeyframeCodec,R=()=>root.PEG.EffectRegistry,E=()=>root.PEG.ExpressionCodec;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const scalar=v=>number(v)!==null?number(v):Array.isArray(v)&&v.length?number(v[0]):null;
 function descriptor(effect,available){return R().resolve(effect,available)}
 function mapValue(rule,param,value){
  let v=scalar(value);if(v===null)return null;
  v=R().convert(rule,param,v);
  return Number.isFinite(v)?v:null
 }
 function toKeyframes(property,rule,param,duration){
  const keys=property.keys||[];
  return keys.map(key=>{
   const normalized=K().toPresetKey(key,duration);if(!normalized)return null;
   const v=mapValue(rule,param,key.value);if(v===null)return null;
   return{...normalized,v}
  }).filter(Boolean).sort((a,b)=>a.t-b.t)
 }
 function propExpressions(property,effectName,expressions,warnings){
  if(property.expressionEnabled&&property.expression){
   const x=E().classify(property.expression);
   expressions.push({effect:effectName,path:property.pathName||property.name,enabled:true,...x});
   if(x.status==='opaque')warnings.push(effectName+' · '+(property.pathName||property.name)+': expression was preserved but is not executed by Pegas.');
   else warnings.push(effectName+' · '+(property.pathName||property.name)+': recognized expression syntax was classified, but not executed by the native renderer.');
  }
 }
 function normalizeLegacyAE(json){
  const comp=json.composition||{},layer=json.layer||{},duration=Math.max(.0001,Number(layer.duration)||((Number(layer.outPoint)||0)-(Number(layer.inPoint)||0))||Number(comp.duration)||1);
  const effects=(json.effects||[]).map((effect,index)=>({
   ...effect,sourceIndex:index,properties:C().normalizeEffects([effect],duration)[0]?.properties||[]
  }));
  return{format:'cutroom-ae-export',schemaVersion:1,source:{application:'Adobe After Effects'},composition:comp,layer:{...layer,duration},effects,transform:json.transform||{},sourceData:json}
 }
 function convertTransform(json,graph,params){
  const src=json.transform||{},comp=json.composition||{},layer=json.layer||{},duration=Math.max(.0001,Number(layer.duration)||((+layer.outPoint||0)-(+layer.inPoint||0))||+comp.duration||1),transform={},kf={};
  const fields=[['position','x'],['scale','s'],['rotation','r'],['opacity','o']];
  function getComponent(value,key){
   if(key==='x'||key==='y'){
    const v=Array.isArray(value)?scalar(value[key==='x'?0:1]):scalar(value);
    return v===null?null:v-(key==='x'?(+comp.width||params.projectWidth||1920)/2:(+comp.height||params.projectHeight||1080)/2)
   }
   if(key==='s'&&Array.isArray(value)){const a=scalar(value[0]),b=scalar(value[1]);return a===null?b:b===null?a:(a+b)/2}
   return scalar(value)
  }
  const position=src.position||src['ADBE Position'];
  if(position){
   for(const axis of ['x','y']){
    const value=getComponent(position.value,axis);if(value!==null)transform[axis]=value;
    const keys=(position.keys||[]).map(k=>{const t=Number.isFinite(+k.normalizedTime)?+k.normalizedTime:(+k.localTime||0)/duration,v=getComponent(k.value,axis);const p=K().toPresetKey({...k,normalizedTime:t,value:v},duration);return p}).filter(Boolean);
    if(keys.length)kf['tr.'+axis]=keys
   }
  }
  const rest={scale:'s',rotation:'r',opacity:'o'};
  for(const [field,key] of Object.entries(rest)){
   const p=src[field]||src['ADBE '+field];if(!p)continue;
   const value=getComponent(p.value,key);if(value!==null)transform[key]=value;
   const keys=(p.keys||[]).map(k=>{
    const t=Number.isFinite(+k.normalizedTime)?+k.normalizedTime:(Number.isFinite(+k.localTime)?+k.localTime/duration:(+k.time||0)/duration);
    const v=getComponent(k.value,key);
    return K().toPresetKey({...k,normalizedTime:t,value:v},duration)
   }).filter(k=>k&&Number.isFinite(k.v));
   if(keys.length)kf['tr.'+key]=keys
  }
  const anchor=src.anchorPoint||src.anchor;
  if(anchor)graph.opaque.push({kind:'transform-property',name:'Anchor Point',source:anchor,reason:'Pegas transform currently has no anchor-point origin control.'});
  if(layer.threeDLayer)graph.warnings.push('The source layer is 3D; Pegas is currently a 2D renderer.');
  return{transform,kf,duration}
 }
 function compile(input,options={}){
  const available=options.FX||{},defaults=options.defs||(()=>({})),json=input?.format==='cutroom-ae-export'&&Array.isArray(input.effects)?input:normalizeLegacyAE(input);
  const comp=json.composition||{},layer=json.layer||{},duration=Math.max(.0001,Number(layer.duration)||((+layer.outPoint||0)-(+layer.inPoint||0))||+comp.duration||1);
  const graph=S().create(json.source||{});
  graph.source={...graph.source,...S().clone(json.source||{}),applicationVersion:json.source?.applicationVersion||json.source?.appVersion||null};
  graph.composition={...graph.composition,...S().clone(comp)};
  graph.layer={...graph.layer,...S().clone(layer),duration};
  graph.provenance={...graph.provenance,sourceSchemaVersion:json.schemaVersion||1,sourceFormat:json.format||'legacy-cutroom-ae-export'};
  graph.effects=C().normalizeEffects(json.effects||[],duration);
  graph.transform=Object.entries(json.transform||{}).map(([slot,node])=>({
   slot,property:C().normalizeNode(node,duration,[])
  }));
  const expressions=[],warnings=[],unsupported=[],rows=[],fx=[],kf={};
  const transformResult=convertTransform(json,graph,{projectWidth:options.projectWidth,projectHeight:options.projectHeight});
  Object.assign(kf,transformResult.kf);
  const walkTransform=(node,slot)=>{
   if(!node)return;
   if(node.expressionEnabled&&node.expression){
    const x=E().classify(node.expression);
    expressions.push({effect:'Layer Transform',slot,path:node.name||slot,enabled:true,...x});
    if(x.status==='opaque')warnings.push('Layer Transform · '+(node.name||slot)+': expression was preserved but is not executed by Pegas.');
   }
   (node.children||[]).forEach(child=>walkTransform(child,slot));
  };
  graph.transform.forEach(item=>walkTransform(item.property,item.slot));
  const rawEffects=json.effects||[];
  graph.effects.forEach((effect,index)=>{
   const source=rawEffects[index]||effect,rule=descriptor(effect,available);
   if(!rule||!rule.available){
    const reason=!rule?'No verified native adapter matches this AE effect.':'Pegas does not implement the mapped target effect.';
    graph.opaque.push({kind:'effect',sourceIndex:index,name:effect.name,matchName:effect.matchName,source:effect,reason});
    unsupported.push(effect.matchName+' · '+effect.name+' — '+reason);return
   }
   const params=defaults(rule.target),sourceProps=effect.flatProperties||C().flatten(effect.properties),mapped=[],unmapped=[];
   const nextIndex=fx.length;
   sourceProps.forEach(property=>{
    propExpressions(property,effect.name,expressions,warnings);
    const key=R().resolveParam(rule,property);
    if(!key||!Object.prototype.hasOwnProperty.call(params,key)){unmapped.push(property.pathName||property.name);return}
    const value=mapValue(rule,key,property.value);
    if(value!==null){
     const spec=available[rule.target].p[key];params[key]=clamp(value,spec[1],spec[2]);mapped.push((property.pathName||property.name)+' → '+key)
    }
    const keys=toKeyframes(property,rule,key,duration);
    if(keys.length){
     const spec=available[rule.target].p[key];keys.forEach(k=>{k.v=clamp(k.v,spec[1],spec[2])});
     kf['fx:'+nextIndex+':'+key]=keys;
     params[key]=keys[0].v;mapped.push((property.pathName||property.name)+' keyframes → '+key)
    }
   });
   if(!mapped.length){
    graph.opaque.push({kind:'effect',sourceIndex:index,name:effect.name,matchName:effect.matchName,source:effect,reason:'Effect name matched an adapter but no parameter values/keyframes matched its verified parameter aliases.'});
    unsupported.push(effect.matchName+' · '+effect.name+' — no supported parameter value/keyframe was mapped.');return
   }
   const exactness='native-approximation';
   fx.push({t:rule.target,p:params,off:effect.enabled===false,meta:{
    sourceEffectName:effect.name,sourceMatchName:effect.matchName,sourceIndex:index,
    conversion:exactness,compatibility:exactness,adapterId:rule.id,
    mappedProperties:mapped,unmappedProperties:unmapped,
    originalEffect:effect
   }});
   rows.push({source:effect.name+' ('+effect.matchName+')',target:available[rule.target].n||rule.target,kind:mapped.length+' property/value mappings · native approximation'});
   if(unmapped.length)warnings.push(effect.name+': '+unmapped.length+' property/properties were kept in the PEG source graph but are not rendered by the mapped native effect.')
  });
  graph.expressions=expressions;
  graph.warnings.push(...warnings);
  graph.opaque.forEach(node=>{if(node.kind==='effect'&&!unsupported.some(x=>x.includes(node.matchName+' · '+node.name)))unsupported.push((node.matchName||'Unknown')+' · '+node.name)});
  const transform=transformResult.transform;
  const preset={
   format:'cutroom-preset',version:4,name:String(layer.name||json.fileName||'After Effects import'),
   cat:'After Effects · Pegas Effect Graph',fx,kf,kfRel:true,timeMap:null,retimeSettings:null,transform,
   folder:'After Effects / Converted',description:'Translated from the lossless Pegas Effect Graph interchange format.',
   sourceOnly:!fx.length&&!Object.keys(transform).length&&!Object.keys(kf).length,
   compatibility:{
    source:'Pegas AE Bridge',level:fx.length?'mixed-native-approximations-and-preserved-source':'source-graph-preserved',
    visualParity:fx.length?'not-guaranteed-native-effect-approximations':'not-renderable-without-After-Effects',
    exactAEParityRequires:'Render the composition with After Effects itself; unsupported plug-ins and expressions cannot be reimplemented by a name-only preset mapping.',
    sourceComposition:S().clone(comp),sourceLayer:S().clone(layer),
    opaqueEffects:S().clone(graph.opaque),expressions:S().clone(expressions),
    unsupportedEffects:unsupported,sourceGraph:graph,sourceData:S().clone(json)
   }
  };
  return{graph,preset,rows,unsupported,warnings,counts:{sourceEffects:graph.effects.length,convertedEffects:fx.length,opaqueEffects:graph.opaque.filter(x=>x.kind==='effect').length,convertedKeyframes:Object.keys(kf).length,expressions:expressions.length}}
 }
 root.PEG.GraphCompiler={compile,normalizeLegacyAE};
})(window);