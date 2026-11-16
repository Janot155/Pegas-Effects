/* Lightweight beat/onset detection for Pegas Effects timeline clips.
   Input waveform bins are produced by the serial audio-analysis queue in index.html.
   Returns clip-source times in seconds; no audio file is uploaded or retained here. */
(function (root) {
  'use strict';

  function quantile(sorted, q) {
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))];
  }

  function detect(peaks, samplesPerSecond, options) {
    if (!peaks || !peaks.length) return [];
    const rate = Math.max(1, Number(samplesPerSecond) || 40);
    const opts = options || {};
    const minInterval = Math.max(0.12, Math.min(0.8, Number(opts.minInterval) || 0.2));
    const values = Array.from(peaks, value => Math.max(0, Math.min(255, Number(value) || 0)));
    const sorted = values.slice().sort((a, b) => a - b);
    const low = quantile(sorted, 0.55);
    const high = quantile(sorted, 0.92);
    const threshold = Math.max(9, low + (high - low) * 0.34);
    const minGap = Math.max(2, Math.round(rate * minInterval));
    const candidates = [];

    for (let i = 1; i < values.length - 1; i++) {
      const current = values[i];
      if (current < threshold || current < values[i - 1] || current <= values[i + 1]) continue;
      const localBase = (values[Math.max(0, i - 2)] + values[i - 1] + values[i + 1] + values[Math.min(values.length - 1, i + 2)]) / 4;
      const strength = current - localBase;
      if (strength < Math.max(4, (high - low) * 0.12)) continue;
      candidates.push({ index: i, strength });
    }

    const selected = [];
    for (const candidate of candidates) {
      const last = selected[selected.length - 1];
      if (!last || candidate.index - last.index >= minGap) {
        selected.push(candidate);
      } else if (candidate.strength > last.strength) {
        selected[selected.length - 1] = candidate;
      }
    }

    return selected.map(item => item.index / rate);
  }

  root.PegasBeatDetection = Object.freeze({ detect });
})(window);
