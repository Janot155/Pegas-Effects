/* Conservative per-device budgets: avoid reserving desktop-sized frame caches on phones. */
(function(){
 const nav=window.navigator||{},mobile=matchMedia("(max-width: 760px), (pointer: coarse)").matches;
 const memory=Math.max(1,Number(nav.deviceMemory)||4),threads=Math.max(1,Number(nav.hardwareConcurrency)||4);
 const cacheMB=mobile?Math.min(48,memory*12):Math.min(192,memory*32);
 window.CutroomRuntimeProfile=Object.freeze({
   mobile, memoryGB:memory, threads,
   cacheBytes:cacheMB*1024*1024,
   maxPreviewFps:mobile?30:60,
   recommendedPreviewScale:mobile?.35:(threads<=4?.5:.65)
 });
})();