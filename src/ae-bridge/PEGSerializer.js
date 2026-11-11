/* Portable PEG JSON format. Original AE property values and opaque nodes remain in the graph. */
(function(root){
 'use strict';
 const isGraph=v=>root.PEG.Schema.isGraph(v);
 function encode(graph,space){
  const check=root.PEG.Validator.validate(graph);
  if(!check.valid)throw new Error('Cannot serialize invalid PEG graph: '+check.errors.join(' '));
  return JSON.stringify(graph,null,space===undefined?2:space)
 }
 function decode(input){
  const value=typeof input==='string'?JSON.parse(input):input;
  root.PEG.Schema.assertGraph(value);
  const check=root.PEG.Validator.validate(value);
  if(!check.valid)throw new Error('Invalid PEG JSON: '+check.errors.join(' '));
  return value
 }
 function summary(graph){
  const check=root.PEG.Validator.validate(graph);
  return{valid:check.valid,version:graph.version,composition:graph.composition?.name||'',layer:graph.layer?.name||'',
   effects:check.effects,opaque:check.opaque,expressions:check.expressions,
   mappedCandidates:graph.effects.filter(x=>x.matchName).length,warnings:check.warnings.length}
 }
 root.PEG.Serializer={encode,decode,summary,isGraph};
})(window);