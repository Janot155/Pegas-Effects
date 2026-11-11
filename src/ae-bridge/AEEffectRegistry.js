/* Match-name-first AE mapping registry. Every browser-side render is labelled approximate unless explicitly certified. */
(function(root){
 'use strict';
 const rules=[
  {id:'gaussian-blur',match:[/^ADBE Gaussian Blur 2?$/i,/^ADBE Fast Blur$/i],name:[/Gaussian Blur|Fast Blur|Box Blur/i],target:'blur',params:{r:['Blurriness','Blur Amount','Radius','Blur']},convert:{r:v=>v}},
  {id:'unsharp-mask',match:[/^ADBE Unsharp Mask$/i],name:[/Unsharp Mask/i],target:'unsharp',params:{amt:['Amount'],r:['Radius'],thr:['Threshold']}},
  {id:'sharpen',match:[/^ADBE Sharpen$/i],name:[/^Sharpen$/i],target:'sharpen',params:{amt:['Sharpness','Amount']}},
  {id:'glow',match:[/^ADBE Glo2$/i,/^ADBE Glow$/i],name:[/Glow/i],target:'glow',params:{r:['Glow Radius','Radius','Glow Threshold'],amt:['Glow Intensity','Intensity','Amount']},convert:{amt:v=>v>=0&&v<=10?v*100:v}},
  {id:'directional-blur',match:[/^ADBE Directional Blur$/i],name:[/Directional Blur|Motion Blur/i],target:'dirblur',params:{len:['Blur Length','Length','Amount'],ang:['Direction','Angle']}},
  {id:'cc-radial-fast-blur',match:[/^CC Radial Fast Blur$/i,/^CC Zoom Blur$/i],name:[/CC Radial Fast Blur|CC Zoom Blur|Zoom Blur/i],target:'zoomblur',params:{amt:['Amount','Zoom Amount','Blurriness']}},
  {id:'cc-radial-blur',match:[/^CC Radial Blur$/i],name:[/CC Radial Blur|Radial Blur/i],target:'radblur',params:{ang:['Amount','Angle','Blur Amount']}},
  {id:'wave-warp',match:[/^ADBE Wave Warp$/i],name:[/Wave Warp/i],target:'wave',params:{amp:['Wave Height','Height','Amplitude'],len:['Wave Width','Width','Wavelength'],spd:['Wave Speed','Speed']},convert:{spd:v=>Math.abs(v)<=2?v*10:v}},
  {id:'posterize-time',match:[/^ADBE Posterize Time$/i],name:[/Posterize Time/i],target:'ptime',params:{fps:['Frame Rate','Framerate']}},
  {id:'noise',match:[/^ADBE Noise$/i],name:[/^Noise$/i,/Add Grain|Grain/i],target:'grain',params:{amt:['Amount of Noise','Amount','Noise Amount']}},
  {id:'mosaic',match:[/^ADBE Mosaic$/i],name:[/Mosaic/i],target:'pixelate',params:{size:['Block Size','Pixel Size']}},
  {id:'drop-shadow',match:[/^ADBE Drop Shadow$/i],name:[/Drop Shadow/i],target:'shadow',params:{x:['Distance','Offset'],b:['Softness','Blur'],op:['Opacity']}},
  {id:'brightness-contrast',match:[/^ADBE Brightness & Contrast 2?$/i],name:[/Brightness & Contrast/i],target:'color',params:{bright:['Brightness'],contrast:['Contrast']}},
  {id:'hue-saturation',match:[/^ADBE HUE SATURATION$/i],name:[/Hue\/Saturation/i],target:'hueshift',params:{hue:['Master Hue','Hue'],sat:['Master Saturation','Saturation'],bright:['Lightness','Brightness']}},
  {id:'exposure',match:[/^ADBE Exposure2?$/i],name:[/^Exposure$/i],target:'color',params:{exp:['Exposure'],bright:['Offset']}},
  {id:'cc-light-sweep',match:[/^CC Light Sweep$/i],name:[/CC Light Sweep|Light Sweep/i],target:'ccsweep',params:{width:['Width'],ang:['Direction','Angle'],amt:['Intensity','Amount']}},
  {id:'cc-light-rays',match:[/^CC Light Rays$/i],name:[/CC Light Rays|Light Rays/i],target:'ccrays',params:{x:['Center X','X Position'],y:['Center Y','Y Position'],len:['Ray Length','Length'],amt:['Intensity','Amount']}},
  {id:'cc-mirror',match:[/^CC Mirror$/i],name:[/CC Mirror/i],target:'ccmirror',params:{}},
  {id:'cc-kaleida',match:[/^CC Kaleida$/i,/^CC Kaleidoscope$/i],name:[/CC Kaleida|Kaleidoscope/i],target:'cckal',params:{n:['Segments','Number Of Segments'],rot:['Rotation'],zoom:['Size','Zoom'],cx:['Center X'],cy:['Center Y']}},
  {id:'cc-repetile',match:[/^CC RepeTile$/i],name:[/CC RepeTile|Repetile/i],target:'ccrep',params:{tiles:['Tiles'],mirror:['Mirror Edges']}},
  {id:'cc-lens',match:[/^CC Lens$/i],name:[/CC Lens/i],target:'cclens',params:{x:['Center X'],y:['Center Y'],size:['Size'],mag:['Magnification']}},
  {id:'cc-toner',match:[/^CC Toner$/i],name:[/CC Toner/i],target:'cctoner',params:{shadow:['Shadow Hue'],high:['Highlight Hue'],amt:['Blend With Original']}},
  {id:'vignette',match:[],name:[/Vignette/i],target:'vignette',params:{amt:['Amount','Intensity']}},
  {id:'scanlines',match:[],name:[/Scan Lines|Scanlines/i],target:'scanlines',params:{amt:['Amount','Opacity'],spacing:['Spacing']}},
  {id:'lens-flare',match:[],name:[/Lens Flare/i],target:'lensflare',params:{x:['Center X'],y:['Center Y'],size:['Lens Size'],amt:['Brightness','Intensity']}},
 ];
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 function resolve(effect,available){
  const matchName=String(effect?.matchName||''),name=String(effect?.name||'');
  const r=rules.find(x=>x.match.some(re=>re.test(matchName))||x.name.some(re=>re.test(name)));
  if(!r)return null;
  if(available&&!available[r.target])return{...r,available:false};
  return{...r,available:true}
 }
 function resolveParam(rule,property){
  const n=norm(property?.matchName),name=norm(property?.name),path=norm(property?.pathName);
  for(const [target,aliases]of Object.entries(rule?.params||{})){
   if(aliases.some(a=>{const x=norm(a);return x===n||x===name||x===path||name.endsWith(x)||path.endsWith(x)}))return target
  }
  return null
 }
 function convert(rule,param,value){
  if(typeof value!=='number'||!Number.isFinite(value))return null;
  const fn=rule?.convert?.[param];return fn?fn(value):value
 }
 root.PEG.EffectRegistry={rules,resolve,resolveParam,convert};
})(window);