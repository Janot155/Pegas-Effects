/* Structural FFX inspection. It never guesses proprietary effect parameters from arbitrary bytes. */
(function(root){
 'use strict';
 const fourcc=(b,o)=>String.fromCharCode(b[o],b[o+1],b[o+2],b[o+3]);
 const u32=(b,o)=>((b[o]*0x1000000)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3])>>>0;
 function inspect(input){
  const b=input instanceof Uint8Array?input:new Uint8Array(input),valid=b.length>=12&&fourcc(b,0)==='RIFX'&&fourcc(b,8)==='FaFX';
  const report={valid,signature:fourcc(b,0),form:b.length>=12?fourcc(b,8):'',declaredSize:b.length>=8?u32(b,4):0,bytes:b.length,chunks:[],strings:[],warnings:[]};
  if(!valid){report.warnings.push('Expected RIFX / FaFX header was not found. Raw bytes can still be stored unchanged.');return report}
  const parse=(start,end,parent,depth)=>{
   if(depth>12){report.warnings.push('Chunk nesting limit reached.');return}
   let p=start,guard=0;
   while(p+8<=end&&guard++<50000){
    const id=fourcc(b,p),size=u32(b,p+4),body=p+8,finish=body+size;
    if(finish>end||finish<body){report.warnings.push('Invalid chunk length at byte '+p+'.');break}
    const row={id,size,offset:p,bodyOffset:body,endOffset:finish,parent:parent||null,depth};
    report.chunks.push(row);
    if(id==='LIST'||id==='FORM'){
     if(size>=4){row.listType=fourcc(b,body);parse(body+4,finish,id+':'+row.listType,depth+1)}
    }
    const next=finish+(size&1);if(next<=p||next>end)break;p=next
   }
  };
  const contentEnd=Math.min(b.length,12+report.declaredSize);
  parse(12,contentEnd,'FaFX',0);
  const decoded=new TextDecoder('latin1').decode(b);
  const re=/(?:ADBE|CC|VC|BCC)[\w .:+()\/-]{2,100}/g;let m;
  while((m=re.exec(decoded))&&report.strings.length<1000){
   const value=m[0].replace(/[^\x20-\x7e].*$/,'').replace(/\s+/g,' ').trim();
   if(value.length>3)report.strings.push({value,offset:m.index})
  }
  if(!report.chunks.length)report.warnings.push('The FaFX form was recognised but its child chunks could not be traversed safely.');
  report.warnings.push('Chunk IDs and readable strings are evidence only. The importer does not interpret unknown payload bytes as effect settings.');
  return report
 }
 root.PEG.FFXChunkReader={inspect,fourcc,u32};
})(window);