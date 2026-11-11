/* Device budget profile shared by the preview cache and GPU pipeline. */
(function(){
 const nav=window.navigator||{},cfg=window.CutroomPerformanceConfig?.get?.()||{};
 const mobile=matchMedia('(max-width: 760px), (pointer: coarse)').matches;
 const memory=Math.max(1,Number(nav.deviceMemory)||4),threads=Math.max(1,Number(nav.hardwareConcurrency)||4);
 const mb=(v,fallback)=>Math.max(16,Math.min(512,Number(v)||fallback))*1048576;
 window.CutroomRuntimeProfile=Object.freeze({
  mobile,memoryGB:memory,threads,
  cacheBytes:mb(cfg.previewCacheMB,mobile?40:72),
  gpuCacheBytes:mb(cfg.gpuCacheMB,mobile?48:96),
  retimeCacheBytes:mb(cfg.retimeCacheMB,mobile?48:96),
  maxPreviewFps:Math.max(15,Math.min(60,Number(cfg.previewFps)||30)),
  recommendedPreviewScale:Math.max(.25,Math.min(1,Number(cfg.previewScale)||.58)),
  maxExportPixels:Math.max(2073600,Number(cfg.exportMaxPixels)||16777216)
 });
 window.CutroomRetimeCache?.configure?.({budgetMB:cfg.retimeCacheMB,enabled:cfg.retimeCacheEnabled!==false});
})();