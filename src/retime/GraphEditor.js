(() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = {
    linear: t => t,
    hold: () => 0,
    in: t => t * t,
    out: t => 1 - (1 - t) * (1 - t),
    inout: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  };
  const normalize = arr => {
    const sorted = (Array.isArray(arr) ? arr : []).map(p => ({
      t: clamp(Number(p.t) || 0, 0, 1),
      v: clamp(Number(p.v) || 0, 0, 1),
      e: ['linear', 'hold', 'in', 'out', 'inout', 'bezier'].includes(p.e) ? p.e : 'linear'
    })).sort((a, b) => a.t - b.t);
    const out = [];
    for (const p of sorted) {
      if (out.length && Math.abs(out[out.length - 1].t - p.t) < 1e-5) out[out.length - 1] = p;
      else out.push(p);
    }
    return out.length >= 2 ? out : [{ t: 0, v: 0, e: 'linear' }, { t: 1, v: 1, e: 'linear' }];
  };
  const sample = (arr, u) => {
    if (!arr || arr.length < 2) return clamp(u, 0, 1);
    if (u <= arr[0].t) return arr[0].v;
    if (u >= arr[arr.length - 1].t) return arr[arr.length - 1].v;
    let i = 0;
    while (i < arr.length - 2 && arr[i + 1].t < u) i++;
    const a = arr[i], b = arr[i + 1];
    const h = Math.max(1e-6, b.t - a.t);
    const q = clamp((u - a.t) / h, 0, 1);
    if (a.e !== 'bezier') {
      const fn = ease[a.e] || ease.linear;
      return clamp(a.v + (b.v - a.v) * fn(q), 0, 1);
    }
    const sec = j => {
      const x = arr[j], y = arr[j + 1];
      return (y.v - x.v) / Math.max(1e-6, y.t - x.t);
    };
    const tangent = j => {
      if (j <= 0) return sec(0);
      if (j >= arr.length - 1) return sec(arr.length - 2);
      const d0 = sec(j - 1), d1 = sec(j);
      if (d0 * d1 <= 0) return 0;
      const h0 = arr[j].t - arr[j - 1].t;
      const h1 = arr[j + 1].t - arr[j].t;
      const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
      return (w1 + w2) / (w1 / d0 + w2 / d1);
    };
    const m0 = tangent(i), m1 = tangent(i + 1);
    const q2 = q * q, q3 = q2 * q;
    const v = (2 * q3 - 3 * q2 + 1) * a.v +
      (q3 - 2 * q2 + q) * h * m0 +
      (-2 * q3 + 3 * q2) * b.v +
      (q3 - q2) * h * m1;
    return clamp(v, 0, 1);
  };

  function mount(host, options) {
    if (!host) return null;
    const cfg = options || {};
    let points = normalize(cfg.points);
    let selected = points.length > 2 ? 1 : 0;
    let dragIndex = -1;
    let pointerActive = false;
    let w = 360, h = 190, dpr = 1;
    let plot = { l: 34, r: 12, t: 12, b: 25, w: 314, h: 153 };
    let lastPlayhead = clamp(Number(cfg.playhead) || 0, 0, 1);
    let canvas, ctx, selectedInfo, addBtn, removeBtn, easeSelect, status;
    let onChange = typeof cfg.onChange === 'function' ? cfg.onChange : () => {};

    host.innerHTML = '';
    const root = document.createElement('section');
    root.className = 'retime-graph';
    const heading = document.createElement('div');
    heading.className = 'retime-graph-heading';
    heading.innerHTML = '<div><b>Graph Editor</b><small>Timeline → source time</small></div><span class="retime-graph-tag">FRAME MAP</span>';
    root.appendChild(heading);

    canvas = document.createElement('canvas');
    canvas.className = 'retime-graph-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interactive source-time curve. Drag points to retime the selected video.');
    root.appendChild(canvas);
    ctx = canvas.getContext('2d');

    const toolbar = document.createElement('div');
    toolbar.className = 'retime-graph-toolbar';
    addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Add point';
    removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove point';
    easeSelect = document.createElement('select');
    easeSelect.setAttribute('aria-label', 'Selected curve segment interpolation');
    [['linear', 'Linear'], ['in', 'Ease in'], ['out', 'Ease out'], ['inout', 'Ease in-out'], ['bezier', 'Smooth Bezier'], ['hold', 'Hold']].forEach(([v, label]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = label;
      easeSelect.appendChild(opt);
    });
    toolbar.append(addBtn, removeBtn, easeSelect);
    root.appendChild(toolbar);

    const footer = document.createElement('div');
    footer.className = 'retime-graph-footer';
    selectedInfo = document.createElement('span');
    selectedInfo.textContent = 'Select a point';
    status = document.createElement('span');
    status.textContent = 'Drag · double-click to remove';
    footer.append(selectedInfo, status);
    root.appendChild(footer);
    host.appendChild(root);

    function geometry() {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(220, rect.width || host.clientWidth || 360);
      h = 190;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      plot = { l: 34, r: 12, t: 12, b: 25, w: w - 46, h: h - 37 };
      draw();
    }
    const px = t => plot.l + t * plot.w;
    const py = v => plot.t + (1 - v) * plot.h;
    const fromPointer = e => {
      const rect = canvas.getBoundingClientRect();
      return {
        t: clamp((e.clientX - rect.left - plot.l) / plot.w, 0, 1),
        v: clamp(1 - (e.clientY - rect.top - plot.t) / plot.h, 0, 1)
      };
    };
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#11151b';
      ctx.fillRect(0, 0, w, h);

      ctx.font = '10px IBM Plex Sans, sans-serif';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const x = plot.l + plot.w * i / 4;
        const y = plot.t + plot.h * i / 4;
        ctx.strokeStyle = i === 0 || i === 4 ? '#48515e' : '#29313c';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, plot.t); ctx.lineTo(x, plot.t + plot.h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(plot.l, y); ctx.lineTo(plot.l + plot.w, y); ctx.stroke();
        ctx.fillStyle = '#8994a5';
        ctx.textAlign = 'right';
        ctx.fillText(String(100 - i * 25), plot.l - 7, y);
        ctx.textAlign = 'center';
        ctx.fillText(String(i * 25), x, h - 10);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(plot.l, plot.t, plot.w, plot.h);
      ctx.clip();

      const playX = px(lastPlayhead);
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(playX, plot.t); ctx.lineTo(playX, plot.t + plot.h); ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      for (let i = 0; i <= 220; i++) {
        const t = i / 220;
        const x = px(t), y = py(sample(points, t));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(px(1), py(0));
      ctx.lineTo(px(0), py(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,179,71,.09)';
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i <= 220; i++) {
        const t = i / 220;
        const x = px(t), y = py(sample(points, t));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      points.forEach((p, i) => {
        const x = px(p.t), y = py(p.v);
        ctx.beginPath();
        ctx.arc(x, y, i === selected ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = i === selected ? '#fff1cf' : '#ffb347';
        ctx.fill();
        ctx.lineWidth = i === selected ? 2 : 1;
        ctx.strokeStyle = '#171b21';
        ctx.stroke();
        if (i === selected) {
          ctx.beginPath();
          ctx.arc(x, y, 10, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,179,71,.65)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
      ctx.restore();

      const p = points[selected];
      selectedInfo.textContent = p
        ? 'Point ' + (selected + 1) + ' · ' + (p.t * 100).toFixed(1) + '% time / ' + (p.v * 100).toFixed(1) + '% source'
        : points.length + ' points';
      removeBtn.disabled = selected <= 0 || selected >= points.length - 1;
      easeSelect.disabled = selected >= points.length - 1;
      easeSelect.value = p?.e || 'linear';
    }
    function emit(final) {
      points = normalize(points);
      onChange(points.map(p => ({ t: p.t, v: p.v, e: p.e })), !!final);
      draw();
    }
    function addAt(t, v) {
      const near = points.findIndex(p => Math.abs(p.t - t) < .025);
      if (near >= 0) {
        selected = near;
        return;
      }
      points.push({ t: clamp(t, .015, .985), v: clamp(v, 0, 1), e: 'bezier' });
      points = normalize(points);
      selected = points.reduce((best, p, i) => Math.abs(p.t - t) < Math.abs(points[best].t - t) ? i : best, 0);
      emit(false);
    }
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const pos = fromPointer(e);
      let nearest = -1, distance = 18;
      points.forEach((p, i) => {
        const d = Math.hypot(px(p.t) - (pos.t * plot.w + plot.l), py(p.v) - (pos.v * plot.h + plot.t));
        if (d < distance) { nearest = i; distance = d; }
      });
      if (nearest < 0) {
        addAt(pos.t, sample(points, pos.t));
        nearest = selected;
      } else selected = nearest;
      dragIndex = nearest;
      pointerActive = true;
      canvas.setPointerCapture?.(e.pointerId);
      draw();
    });
    canvas.addEventListener('pointermove', e => {
      if (!pointerActive || dragIndex < 0) return;
      const pos = fromPointer(e);
      const prev = points[dragIndex - 1], next = points[dragIndex + 1];
      if (dragIndex > 0 && dragIndex < points.length - 1) {
        points[dragIndex].t = clamp(pos.t, prev.t + .015, next.t - .015);
      }
      points[dragIndex].v = pos.v;
      emit(false);
    });
    const finishDrag = () => {
      if (!pointerActive) return;
      pointerActive = false;
      dragIndex = -1;
      emit(true);
    };
    canvas.addEventListener('pointerup', finishDrag);
    canvas.addEventListener('pointercancel', finishDrag);
    canvas.addEventListener('dblclick', e => {
      const pos = fromPointer(e);
      let nearest = -1, distance = 16;
      points.forEach((p, i) => {
        const d = Math.hypot(px(p.t) - (pos.t * plot.w + plot.l), py(p.v) - (pos.v * plot.h + plot.t));
        if (d < distance) { nearest = i; distance = d; }
      });
      if (nearest > 0 && nearest < points.length - 1) {
        points.splice(nearest, 1);
        selected = Math.max(0, nearest - 1);
        emit(true);
      }
    });
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      const pos = fromPointer(e);
      let nearest = -1, distance = 18;
      points.forEach((p, i) => {
        const d = Math.hypot(px(p.t) - (pos.t * plot.w + plot.l), py(p.v) - (pos.v * plot.h + plot.t));
        if (d < distance) { nearest = i; distance = d; }
      });
      if (nearest > 0 && nearest < points.length - 1) {
        points.splice(nearest, 1);
        selected = Math.max(0, nearest - 1);
        emit(true);
      }
    });
    canvas.addEventListener('keydown', e => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected > 0 && selected < points.length - 1) {
        e.preventDefault();
        points.splice(selected, 1);
        selected = Math.max(0, selected - 1);
        emit(true);
      }
    });
    addBtn.addEventListener('click', () => {
      const t = lastPlayhead;
      addAt(t, sample(points, t));
      emit(true);
    });
    removeBtn.addEventListener('click', () => {
      if (selected <= 0 || selected >= points.length - 1) return;
      points.splice(selected, 1);
      selected = Math.max(0, selected - 1);
      emit(true);
    });
    easeSelect.addEventListener('change', () => {
      if (selected < 0 || selected >= points.length - 1) return;
      points[selected].e = easeSelect.value;
      emit(true);
    });

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(geometry);
      observer.observe(host);
    }
    geometry();
    return {
      updatePlayhead(t) { lastPlayhead = clamp(Number(t) || 0, 0, 1); draw(); },
      update(pointsNext) { points = normalize(pointsNext); selected = clamp(selected, 0, points.length - 1); draw(); }
    };
  }
  window.CutroomRetimeGraph = { mount };
})();