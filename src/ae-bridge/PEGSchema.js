/* Pegas Effect Graph (PEG) — lossless interchange model for AE-originated effects. */
(function(root){
 'use strict';
 const VERSION=1,FORMAT='pegas-effect-graph';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
 const clone=v=>{
  if(v===null||typeof v!=='object')return v;
  if(Array.isArray(v))return v.map(clone);
  const o={};Object.keys(v).forEach(k=>{o[k]=clone(v[k])});return o
 };
 function create(source){
  return{
   format:FORMAT,version:VERSION,
   source:{application:'Adobe After Effects',exporterVersion:null,applicationVersion:null,projectName:null,fileName:null},
   composition:{name:'',width:0,height:0,frameRate:30,duration:0,pixelAspect:1,displayStartTime:0},
   layer:{name:'',index:0,inPoint:0,outPoint:0,duration:0,startTime:0,stretch:100,threeD:false},
   transform:[],effects:[],expressions:[],opaque:[],warnings:[],
   provenance:{sourceFormat:'cutroom-ae-export',sourceSchemaVersion:null,createdAt:Date.now(),exactBytesPreserved:false}
  }
 }
 function isGraph(v){return !!v&&v.format===FORMAT&&v.version===VERSION&&Array.isArray(v.effects)}
 function assertGraph(v){
  if(!v||v.format!==FORMAT)throw new Error('Not a Pegas Effect Graph document.');
  if(!Number.isFinite(+v.version)||+v.version>VERSION)throw new Error('This Pegas Effect Graph version is newer than this editor.');
  if(!Array.isArray(v.effects)||!Array.isArray(v.transform))throw new Error('Malformed Pegas Effect Graph: effects/transform arrays are required.');
  return v
 }
 root.PEG=root.PEG||{};
 root.PEG.Schema={VERSION,FORMAT,own,clone,create,isGraph,assertGraph};
})(window);