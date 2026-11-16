/* Small, dependency-free smoke tests for Pegas Effects integrations. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

global.window = global;
require('../src/audio/BeatDetection.js');

const synthetic = new Uint8Array(120);
synthetic[20] = 240;
synthetic[60] = 230;
synthetic[100] = 250;
const beats = global.PegasBeatDetection.detect(synthetic, 40, { minInterval: 0.2 });
assert.equal(beats.length, 3, 'beat detector should find three separated transients');
assert.ok(Math.abs(beats[0] - 0.5) < 1e-9);
assert.ok(Math.abs(beats[2] - 2.5) < 1e-9);

const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function normalizePegasAEExport(');
const end = html.indexOf('\nasync function importAEExport(', start);
assert.ok(start >= 0 && end > start, 'legacy AE normalizer must exist in index.html');
const helperSource = html.slice(start, end);
const context = { clamp: (n, min, max) => Math.min(max, Math.max(min, n)) };
vm.createContext(context);
vm.runInContext(helperSource, context);

const legacy = {
  format: 'pegas-effects-ae-preset',
  source: { fileName: 'Example.ffx', layer: 'Example Layer', composition: 'Example Comp' },
  effectsAdded: [{
    name: 'Gaussian Blur',
    matchName: 'ADBE Gaussian Blur',
    enabled: true,
    children: [{
      name: 'Blurriness',
      matchName: 'ADBE Gaussian Blur-0001',
      staticValue: 25,
      keyframes: [
        { time: 2, value: 10, inInterpolation: 'KeyframeInterpolationType.LINEAR', outInterpolation: 'KeyframeInterpolationType.LINEAR' },
        { time: 4, value: 50, inInterpolation: 'KeyframeInterpolationType.BEZIER', outInterpolation: 'KeyframeInterpolationType.BEZIER', inTemporalEase: [{ speed: 0, influence: 40 }], outTemporalEase: [{ speed: 5, influence: 60 }] }
      ]
    }]
  }]
};
const normalized = context.normalizePegasAEExport(legacy, 'Example.ffx');
assert.equal(normalized.format, 'cutroom-ae-export');
assert.equal(normalized.effects.length, 1);
assert.equal(normalized.effects[0].properties[0].value, 25);
assert.equal(normalized.effects[0].properties[0].keys[0].t, 0);
assert.equal(normalized.effects[0].properties[0].keys[1].t, 1);
assert.equal(normalized.effects[0].properties[0].keys[1].interpolation, 'bezier');

console.log('Pegas smoke tests passed: beat detection + legacy AE/FFX JSON normalization.');
