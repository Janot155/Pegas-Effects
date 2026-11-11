/* Expressions are source code, not values. This module never evals or executes imported JavaScript. */
(function(root){
 'use strict';
 const KNOWN=[
  {id:'identity-value',re:/^\s*value\s*;?\s*$/i},
  {id:'loop-out-cycle',re:/^\s*loopOut\s*\(\s*["']cycle["']\s*\)\s*;?\s*$/i},
  {id:'loop-out-pingpong',re:/^\s*loopOut\s*\(\s*["']pingpong["']\s*\)\s*;?\s*$/i},
  {id:'loop-in-cycle',re:/^\s*loopIn\s*\(\s*["']cycle["']\s*\)\s*;?\s*$/i},
  {id:'loop-in-pingpong',re:/^\s*loopIn\s*\(\s*["']pingpong["']\s*\)\s*;?\s*$/i},
  {id:'wiggle-call',re:/^\s*wiggle\s*\(\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)(?:\s*,\s*([-+0-9.eE]+))?(?:\s*,\s*([-+0-9.eE]+))?\s*\)\s*;?\s*$/i},
  {id:'posterize-time',re:/^\s*posterizeTime\s*\(\s*([-+0-9.eE]+)\s*\)\s*;?\s*value\s*;?\s*$/i},
  {id:'linear-value',re:/^\s*linear\s*\(\s*time\s*,\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*\)\s*;?\s*$/i},
  {id:'ease-value',re:/^\s*ease\s*\(\s*time\s*,\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*\)\s*;?\s*$/i}
 ];
 function classify(source){
  const text=String(source||'');if(!text.trim())return{status:'none',source:text,ir:null};
  for(const entry of KNOWN){const m=text.match(entry.re);if(m)return{status:'recognized-subset',source:text,ir:{op:entry.id,args:m.slice(1).map(Number)}}}
  return{status:'opaque',source:text,ir:null,reason:'Expression uses After Effects APIs or JavaScript syntax outside the safe PEG expression subset.'}
 }
 root.PEG.ExpressionCodec={classify,known:KNOWN.map(x=>x.id)};
})(window);