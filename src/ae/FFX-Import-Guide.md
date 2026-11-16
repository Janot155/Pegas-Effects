# Pegas Effects — After Effects FFX bridge

## Reliable FFX import workflow

An Adobe `.ffx` file is a proprietary After Effects preset. A browser cannot safely reconstruct every effect, plug-in parameter, expression, or keyframe from its binary bytes. Pegas preserves the original file and uses After Effects itself to interpret it.

1. Import the `.ffx` file into Pegas Effects' Presets panel. Pegas stores the original bytes and explains that conversion is still required.
2. Open Adobe After Effects and a composition. Select the target layer.
3. Run `Pegas-FFX-to-JSON.jsx` using **File → Scripts → Run Script File…** and choose the same `.ffx` file when prompted.
4. The script applies the preset to the selected layer and exports a `cutroom-ae-export` JSON file containing the changed/new effects, readable parameter values, supported keyframes, and changed basic transforms.
5. Import that JSON file in Pegas Effects' Presets panel. Review the conversion report, then use **Apply supported approximations** on a selected video/image/text clip.

## Compatibility notes

- Supported native mappings include common blur, sharpen, glow, directional/radial blur, wave warp, noise/grain, pixelate, drop shadow, color correction, light sweep, and light rays parameters.
- Compatible parameters and keyframes are mapped into Pegas native effects. Values outside a native effect's range are clamped and reported through the source metadata.
- Unsupported third-party plug-ins, expression execution, 3D cameras, and proprietary effect internals cannot be reproduced as native browser effects. Their source data is retained in the JSON/report rather than replaced with invented defaults.
- Bezier/ease information is retained as metadata; Pegas uses its own approximate native interpolation where an exact After Effects curve is not available.
- The legacy `pegas-effects-ae-preset` JSON schema is also accepted and normalized during import.

## Performance

Audio waveform analysis runs one file at a time. Long files are skipped for automatic waveform decoding to avoid large simultaneous memory allocations; their clips can still be edited and exported. Preview quality adapts separately from export quality, so reducing preview resolution does not lower the final export resolution.
