# Pegas Effect Graph (PEG) — After Effects bridge

PEG is an intermediate representation for After Effects effect stacks. It is intentionally separate from Pegas' renderer so that the original AE data can survive even when a matching browser effect does not exist.

## Files

- `PEGSchema.js` — graph contract and schema version.
- `AEPropertyCodec.js` — recursive AE property groups, typed values, flattened lookup paths and keyframe records.
- `AEKeyframeCodec.js` — AE temporal ease metadata and scalar Bezier segment evaluation.
- `AEExpressionCodec.js` — conservative classifier for a small expression subset. It never evaluates imported JavaScript.
- `AEEffectRegistry.js` — matchName-first effect adapter registry and parameter aliases.
- `AEGraphCompiler.js` — compiles the full source graph into PEG and a best-effort Cutroom preset.
- `FFXChunkReader.js` — structural RIFX/FaFX inspection; it does not invent meaning for unknown chunks.
- `PEGValidator.js` / `PEGSerializer.js` — graph integrity and portable JSON round trips.
- `PEGSelfTest.js` — synthetic regression checks.
- `tools/Cutroom_AE_Exporter.jsx` — runs inside After Effects and reads the actual selected layer/effect property tree.

## FFX conversion workflow

1. In After Effects, apply the original `.ffx` preset to a layer.
2. Select exactly that layer.
3. In After Effects choose **File → Scripts → Run Script File…** and run `tools/Cutroom_AE_Exporter.jsx`.
4. Save the generated JSON file and import it in Pegas' Presets panel.
5. Inspect the report. It shows which effects mapped to Pegas-native approximations and which were retained as opaque source graph nodes.

The JSX exporter collects effect match names, every nested property group, static values, keyframe values and times, interpolation mode, incoming/outgoing temporal ease, spatial tangents, expressions, layer transform and composition metadata.

## Exact visual parity

A browser cannot execute Adobe's installed native effects or arbitrary third-party AE plug-ins. Matching an effect's display name is not enough to reproduce its numerical pixel algorithm. The native Pegas adapters are therefore labelled **approximations**, not exact conversions.

The exporter can optionally queue a **full-composition reference render** in After Effects. That render is produced by the real AE host and plug-ins and can be imported into Pegas as video for pixel-identical visual reference to that AE composition. It is flattened and not an editable effect stack. The JSON graph remains separately editable where Pegas has a native adapter.

For an unsupported plug-in, expression, 3D layer, mask/path, or specialized effect, PEG preserves the source data and reports the gap rather than silently replacing it with an unrelated effect.

## Current limits

- A raw `.ffx` file is stored byte-for-byte and its RIFX/FaFX chunk table is inspected. The semantic stream is resolved through After Effects itself using the JSX exporter; the browser reader does not guess at opaque payloads.
- Native parameter mappings are not guaranteed pixel-identical to AE. More aliases can be added to `AEEffectRegistry.js`, but every mapping still needs visual comparison against a render from the corresponding AE version/plugin.
- Expressions are preserved as source and conservatively classified. The bridge does not execute arbitrary code.
- Spatial/3D/mask/text/custom plugin data remains in PEG source properties when Pegas has no equivalent renderer.
- The selected-layer JSON export describes one layer. The optional queued reference render is the whole composition, so it includes all visible layers in that composition.


## Pegas Effect Graph files

After a JSON import has been converted, the saved preset card exposes **Export lossless PEG graph**. The resulting `.peg.json` file contains the normalized PEG document rather than only the editable native effect approximations. Importing that file again recompiles the same graph and retains opaque effects and expression source.

Use the Presets panel's **Test AE translator** action to run the synthetic regression suite in the browser. It checks typed values, animated property values, temporal ease metadata, transform curves, opaque plugin preservation, PEG serialization, re-import and RIFX/FaFX chunk inspection.

The raw AE property tree is the authoritative source. A native Pegas preset is an additional derived representation for properties that have a registered adapter; it is not used as a replacement for the source graph.
