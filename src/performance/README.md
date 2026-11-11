# Pegas Effects — performance configuration

The performance system is split into small modules so that preview pacing, device budgets, and reverse-frame caching can be tuned independently.

## Modules

- `src/config/PerformanceConfig.js` — presets, device detection, validation, and persisted user settings.
- `src/performance/PerformanceController.js` — preview FPS pacing and adaptive preview resolution.
- `src/performance/RetimeFrameCache.js` — bounded ImageBitmap cache and optional source-frame pre-rendering for reverse/boomerang.
- `src/performance/RuntimeProfile.js` — one-time device profile used to initialise the GPU and preview memory budgets.

## Profiles

| Profile | Preview | Heavy CPU effects during playback | Export FPS limit |
| --- | --- | --- | --- |
| Auto | Selects a conservative setting from device memory, CPU threads and mobile/desktop input | Smart preview | Up to 60 |
| Maximum performance | Lower preview scale and frame rate; smaller caches | Smart preview | Up to 60 |
| Balanced | Medium preview scale and frame rate | Smart preview | Up to 60 |
| High quality | Higher preview scale and frame rate; larger caches | All effects | Up to 120 |
| Custom | Uses the values set in the Performance panel | Smart or All | User-selected cap |

Smart preview only omits selected expensive effects from a playing preview when the effect stack contains at least eight effects and that effect would otherwise use the CPU path. Paused preview and export continue to render the full effect chain.

## Tunable settings

| Setting | Purpose |
| --- | --- |
| `previewFps` | Maximum editor preview update rate. |
| `previewScale` | Preview render scale; does not alter export dimensions. |
| `adaptiveQuality` | Lowers preview scale after sustained slow frames and recovers gradually when there is headroom. |
| `minPreviewScale`, `maxPreviewScale` | Adaptive preview scale limits. |
| `previewCacheMB` | Memory budget for paused/scrubbed composite preview frames. |
| `gpuCacheMB` | GPU render-target memory budget. The renderer stops allocating when the budget is exhausted and falls back to the CPU path. |
| `retimeCacheMB` | Memory budget for decoded source frames used by Reverse/Boomerang. |
| `retimeCacheEnabled` | Enables or disables reverse-frame caching and pre-rendering. |
| `effectPreviewMode` | `smart` or `all`; export always uses all effects. |
| `exportMaxPixels` | Maximum output pixels per frame before export is rejected to protect browser memory. |
| `exportMaxFps` | FPS ceiling for the active device profile. |
| `exportBitrateCapMbps` | Maximum requested video encoder bitrate. |
| `exportYieldEveryFrames` | Extra event-loop yield interval when an export frame takes longer than its target frame interval. |
| `exportProgressEvery` | How often the progress bar and text are updated. |

## Reverse/boomerang workflow

1. Select a video clip and choose Reverse, Reverse Ramp, Boomerang, or Smooth Boomerang.
2. For clips that need reliable reverse preview, click **Pre-cache reverse / boomerang frames** in the Retime section.
3. The cache stores downscaled snapshots with a bounded LRU policy. The current cache renderer scales stored frames to a maximum 720-pixel longest edge.
4. The cache is preview-only. Export continues to decode exact source frames at the requested export dimensions.

## Limits

This remains a browser-based editor. The active device, source codec, browser decoder, GPU driver, and effect stack still determine actual playback and export speed. A memory budget prevents unbounded allocations; it cannot guarantee real-time playback for every combination of 4K media, high FPS, and hundreds of effects.
