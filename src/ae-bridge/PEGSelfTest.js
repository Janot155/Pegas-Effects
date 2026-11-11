/* Deterministic, asset-free bridge tests. Run from the Presets panel. */
(function(root){
 'use strict';
 function run(){
  const results=[],check=(name,ok,detail)=>results.push({name,pass:!!ok,detail:detail||''});
  try{
   const FX={blur:{n:'Gaussian Blur',p:{r:[10,0,100]}}};
   const defs=t=>Object.fromEntries(Object.entries(FX[t].p).map(([k,v])=>[k,v[0]]));
   const source={
    format:'cutroom-ae-export',schemaVersion:2,
    source:{application:'Adobe After Effects',applicationVersion:'test'},
    composition:{name:'PEG Self Test',width:1920,height:1080,frameRate:30,duration:2,pixelAspect:1},
    layer:{name:'Layer A',index:1,inPoint:0,outPoint:2,duration:2,threeD:false},
    transform:{position:{name:'Position',matchName:'ADBE Position',value:[970,520],keys:[]}},
    effects:[
     {name:'Gaussian Blur',matchName:'ADBE Gaussian Blur 2',enabled:true,properties:[
      {nodeType:'group',name:'Blur Settings',matchName:'ADBE Gaussian Blur-0001',children:[
       {nodeType:'property',name:'Blurriness',matchName:'ADBE Gaussian Blur-0001',value:22,keys:[
        {time:0,localTime:0,normalizedTime:0,value:12,interpolation:'bezier',inInterpolation:'bezier',outInterpolation:'bezier',inTemporalEase:[{speed:0,influence:33}],outTemporalEase:[{speed:10,influence:33}]},
        {time:2,localTime:2,normalizedTime:1,value:64,interpolation:'bezier',inInterpolation:'bezier',outInterpolation:'bezier',inTemporalEase:[{speed:0,influence:33}],outTemporalEase:[{speed:0,influence:33}]}
       ]}
      ]}
     ]},
     {name:'Third Party Magic FX',matchName:'Vendor Magic Glow',enabled:true,properties:[
      {nodeType:'property',name:'Intensity',matchName:'Vendor Magic-0001',value:77,keys:[]}
     ]}
    ]
   };
   const result=root.PEG.GraphCompiler.compile(source,{FX,defs,projectWidth:1920,projectHeight:1080});
   check('Known AE effect maps to native candidate',result.preset.fx.length===1&&result.preset.fx[0].t==='blur');
   check('Source numeric parameter retained',result.preset.fx[0]?.p.r===22);
   check('Keyframe time is normalized',result.preset.kf['fx:0:r']?.[1]?.t===1);
   check('AE temporal ease metadata is retained',!!result.preset.kf['fx:0:r']?.[0]?.meta?.ae?.outTemporalEase?.length);
   check('Unknown plugin remains opaque',result.graph.opaque.some(x=>x.matchName==='Vendor Magic Glow'));
   check('Original full source tree remains attached',!!result.preset.compatibility.sourceGraph.effects[0].properties[0].children[0].matchName);
   const packed=root.PEG.Serializer.encode(result.graph),unpacked=root.PEG.Serializer.decode(packed);
   check('PEG serialization round trip preserves effects',unpacked.effects.length===2&&unpacked.effects[0].matchName==='ADBE Gaussian Blur 2');
   const ease=root.PEG.KeyframeCodec.evaluate(result.preset.kf['fx:0:r'][0],result.preset.kf['fx:0:r'][1],.5,x=>x);
   check('AE Bezier temporal evaluator returns a finite value',Number.isFinite(ease));
   const ffx=new Uint8Array(24),put=(at,str)=>{for(let i=0;i<4;i++)ffx[at+i]=str.charCodeAt(i)};
   put(0,'RIFX');ffx[4]=0;ffx[5]=0;ffx[6]=0;ffx[7]=16;put(8,'FaFX');put(12,'TEST');ffx[16]=0;ffx[17]=0;ffx[18]=0;ffx[19]=4;put(20,'DATA');
   const inspected=root.PEG.FFXChunkReader.inspect(ffx);
   check('RIFX/FaFX chunk structure parses without guessing payload values',inspected.valid&&inspected.chunks.length===1&&inspected.chunks[0].id==='TEST');
  }catch(e){check('Self-test execution',false,String(e&&e.stack||e))}
  return{passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,results}
 }
 root.PEGSelfTest={run};
})(window);