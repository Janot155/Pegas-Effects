/* Validate the lossless PEG graph independently of the native effect renderer. */
(function(root){
 'use strict';
 const fail=(errors,msg)=>errors.push(msg);
 function validate(graph){
  const errors=[],warnings=[];
  if(!graph||graph.format!=='pegas-effect-graph')fail(errors,'Unexpected PEG graph format.');
  if(!Number.isFinite(+graph?.version)||+graph.version<1)fail(errors,'Missing or invalid PEG schema version.');
  if(!Array.isArray(graph?.effects))fail(errors,'Effects must be an array.');
  if(!Array.isArray(graph?.transform))fail(errors,'Transform must be an array.');
  const visit=(p,path)=>{
   if(!p||typeof p!=='object'){fail(errors,path+' is not an object.');return}
   if(typeof p.name!=='string')fail(errors,path+' has no property name.');
   if(p.children!==undefined&&!Array.isArray(p.children))fail(errors,path+'.children must be an array.');
   if(p.keys!==undefined&&!Array.isArray(p.keys))fail(errors,path+'.keys must be an array.');
   (p.children||[]).forEach((x,i)=>visit(x,path+'.children['+i+']'));
   (p.keys||[]).forEach((k,i)=>{if(!Number.isFinite(+k.normalizedTime)&&!Number.isFinite(+k.localTime)&&!Number.isFinite(+k.time))warnings.push(path+' key '+i+' has no usable time field.')})
  };
  (graph?.effects||[]).forEach((fx,i)=>{
   if(!fx.matchName)warnings.push('Effect '+i+' has no stable matchName.');
   (fx.properties||[]).forEach((p,j)=>visit(p,'effects['+i+'].properties['+j+']'))
  });
  if(!graph?.provenance?.sourceFormat)warnings.push('Source format was not recorded.');
  return{valid:errors.length===0,errors,warnings,effects:graph?.effects?.length||0,opaque:graph?.opaque?.length||0,expressions:graph?.expressions?.length||0}
 }
 root.PEG.Validator={validate};
})(window);