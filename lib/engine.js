// Motor de conversiones de Conversorium (se ejecuta solo en el navegador).
import JSZip from 'jszip';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeName = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 100);

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'cv-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}
let lamePromise = null;
async function ensureLame() {
  if (window.lamejs) return;
  if (!lamePromise) lamePromise = loadScript('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js');
  await lamePromise;
  if (!window.lamejs) throw new Error('No se pudo cargar el codificador MP3.');
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function pickVideoMime(){
  const c = ['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
  return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || null;
}

async function decodeWebpFrames(file){
  const frames = [];
  if ('ImageDecoder' in window){
    const dec = new ImageDecoder({ data: await file.arrayBuffer(), type: 'image/webp' });
    await dec.tracks.ready;
    const n = dec.tracks.selectedTrack.frameCount;
    for (let i = 0; i < n; i++){
      const { image } = await dec.decode({ frameIndex: i });
      const bmp = await createImageBitmap(image);
      const dur = Math.max(20, (image.duration || 100000) / 1000);
      image.close();
      frames.push({ bmp, dur });
    }
    if (n === 1) frames[0].dur = 3000;
  } else {
    frames.push({ bmp: await createImageBitmap(file), dur: 3000 });
  }
  return frames;
}

async function convertWebp(file, o, onProgress){
  const base = file.name.replace(/\.webp$/i, '') || 'imagen';
  if (o.target === 'png' || o.target === 'jpg'){
    onProgress(30, 'Decodificando…');
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    if (o.target === 'jpg'){ ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(bmp, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, o.target === 'png' ? 'image/png' : 'image/jpeg', 0.92));
    if (!blob) throw new Error('No se pudo generar la imagen.');
    return { blob, name: base + '.' + o.target };
  }
  const mime = pickVideoMime();
  if (!mime) throw new Error('Tu navegador no puede grabar vídeo (MediaRecorder). Prueba con Chrome, Edge o Firefox.');
  onProgress(5, 'Leyendo fotogramas…');
  const frames = await decodeWebpFrames(file);
  const w = frames[0].bmp.width & ~1, hgt = frames[0].bmp.height & ~1;
  const c = document.createElement('canvas'); c.width = w || 2; c.height = hgt || 2;
  const ctx = c.getContext('2d');
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5000000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => rec.onstop = r);
  rec.start();
  const totalSteps = frames.length * o.loops; let step = 0;
  for (let l = 0; l < o.loops; l++){
    for (const f of frames){
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(f.bmp, 0, 0, c.width, c.height);
      step++;
      onProgress(10 + Math.round(step / totalSteps * 85), 'Grabando vídeo…');
      await sleep(f.dur);
    }
  }
  await sleep(120);
  rec.stop(); await stopped;
  const type = mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
  return { blob: new Blob(chunks, { type }), name: base + (type === 'video/mp4' ? '.mp4' : '.webm') };
}



// ---------- WebM / vídeo → audio o vídeo ----------
function floatTo16(f){
  const o = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++){ const s = Math.max(-1, Math.min(1, f[i])); o[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
  return o;
}

async function decodeAudio(file){
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  try { return await ctx.decodeAudioData(await file.arrayBuffer()); }
  catch (e){ throw new Error('No se pudo extraer el audio: el archivo no tiene pista de audio o tu navegador no la soporta.'); }
  finally { if (ctx.close) ctx.close(); }
}

function encodeWav(buf){
  const ch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate, n = buf.length, bytes = n * ch * 2;
  const ab = new ArrayBuffer(44 + bytes), dv = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0,'RIFF'); dv.setUint32(4, 36 + bytes, true); ws(8,'WAVE'); ws(12,'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  ws(36,'data'); dv.setUint32(40, bytes, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let off = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++){
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
  }
  return new Blob([ab], { type:'audio/wav' });
}

async function encodeMp3(buf, kbps, onFrac){
  await ensureLame();
  const ch = Math.min(2, buf.numberOfChannels);
  const enc = new window.lamejs.Mp3Encoder(ch, buf.sampleRate, kbps);
  const L = floatTo16(buf.getChannelData(0));
  const R = ch > 1 ? floatTo16(buf.getChannelData(1)) : null;
  const out = []; const block = 1152 * 16; let k = 0;
  for (let i = 0; i < L.length; i += block){
    const d = ch > 1 ? enc.encodeBuffer(L.subarray(i, i + block), R.subarray(i, i + block)) : enc.encodeBuffer(L.subarray(i, i + block));
    if (d.length) out.push(new Uint8Array(d));
    if (++k % 25 === 0){ onFrac(i / L.length); await sleep(0); }
  }
  const end = enc.flush(); if (end.length) out.push(new Uint8Array(end));
  return new Blob(out, { type:'audio/mpeg' });
}

async function mediaToVideo(file, base, p){
  const mime = pickVideoMime();
  if (!mime) throw new Error('Tu navegador no puede grabar vídeo. Usa Chrome o Edge.');
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url; v.playsInline = true; v.preload = 'auto';
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  try {
    p(5, 'Cargando vídeo…');
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('No se pudo leer este archivo como vídeo.')); });
    const cap = v.captureStream || v.mozCaptureStream;
    if (!cap) throw new Error('Tu navegador no permite capturar vídeo. Usa Chrome, Edge o Firefox.');
    actx = new AC();
    const srcN = actx.createMediaElementSource(v);
    const dest = actx.createMediaStreamDestination();
    srcN.connect(dest);
    await actx.resume();
    const ended = new Promise(r => { v.onended = r; });
    await v.play();
    const vs = cap.call(v);
    let tries = 0; while (!vs.getVideoTracks().length && tries++ < 20) await sleep(50);
    if (!vs.getVideoTracks().length) throw new Error('El archivo no tiene pista de vídeo.');
    const stream = new MediaStream([...vs.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.start(250);
    const timer = setInterval(() => {
      const d = v.duration;
      p(isFinite(d) && d > 0 ? 10 + Math.round(v.currentTime / d * 85) : 50, 'Grabando…');
    }, 300);
    await ended;
    clearInterval(timer);
    await sleep(150);
    rec.stop(); await stopped;
    const type = mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
    return { blob: new Blob(chunks, { type }), name: base + (type === 'video/mp4' ? '.mp4' : '.webm') };
  } finally {
    URL.revokeObjectURL(url);
    if (actx && actx.close) actx.close();
  }
}

// ---------- Edición de audio (cortar / recortar / unir) ----------
const fmtT = t => { t = Math.max(0, t); const m = Math.floor(t / 60); const s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };

function mergeCuts(c){
  c = c.map(r => [r[0], r[1]]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const r of c){
    if (out.length && r[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], r[1]);
    else out.push(r);
  }
  return out;
}
function keptRanges(dur, cuts){
  const out = []; let t = 0;
  for (const [s, e] of mergeCuts(cuts)){ if (s > t) out.push([t, Math.min(s, dur)]); t = Math.max(t, e); }
  if (t < dur) out.push([t, dur]);
  return out.filter(([a, b]) => b - a > 0.005);
}
function makeBuf(ch, len, sr){
  try { return new AudioBuffer({ numberOfChannels: ch, length: len, sampleRate: sr }); }
  catch (e){ const AC = window.AudioContext || window.webkitAudioContext; const c = new AC(); const b = c.createBuffer(ch, len, sr); if (c.close) c.close(); return b; }
}
function pieceFromCuts(buf, cuts){
  const ranges = keptRanges(buf.duration, cuts);
  if (!ranges.length) throw new Error('No queda audio: has cortado todo.');
  const sr = buf.sampleRate, ch = Math.min(2, buf.numberOfChannels);
  const segs = ranges.map(([a, b]) => [Math.max(0, Math.round(a * sr)), Math.min(buf.length, Math.round(b * sr))]).filter(([a, b]) => b > a);
  const total = segs.reduce((x, [a, b]) => x + (b - a), 0);
  const out = makeBuf(ch, total, sr);
  let off = 0;
  segs.forEach(([a, b], k) => {
    const len = b - a, J = Math.min(Math.round(sr * 0.008), Math.floor(len / 2));
    for (let c = 0; c < ch; c++){
      const d = out.getChannelData(c);
      d.set(buf.getChannelData(c).subarray(a, b), off);
      if (k > 0) for (let j = 0; j < J; j++) d[off + j] *= j / J;
      if (k < segs.length - 1) for (let j = 0; j < J; j++) d[off + len - 1 - j] *= j / J;
    }
    off += len;
  });
  return out;
}
function concatBuffers(bufs){
  const sr = bufs[0].sampleRate;
  const ch = Math.min(2, Math.max(...bufs.map(b => b.numberOfChannels)));
  const total = bufs.reduce((a, b) => a + b.length, 0);
  const out = makeBuf(ch, total, sr);
  let off = 0;
  for (const b of bufs){
    for (let c = 0; c < ch; c++) out.getChannelData(c).set(b.getChannelData(Math.min(c, b.numberOfChannels - 1)), off);
    off += b.length;
  }
  return out;
}
function applyFades(buf, o){
  if (!o.fadeIn && !o.fadeOut) return buf;
  const ch = Math.min(2, buf.numberOfChannels);
  const out = makeBuf(ch, buf.length, buf.sampleRate);
  const F = Math.min(Math.round(buf.sampleRate), Math.floor(buf.length / 2));
  for (let c = 0; c < ch; c++){
    const d = out.getChannelData(c);
    d.set(buf.getChannelData(c));
    if (o.fadeIn) for (let j = 0; j < F; j++) d[j] *= j / F;
    if (o.fadeOut) for (let j = 0; j < F; j++) d[buf.length - 1 - j] *= j / F;
  }
  return out;
}
async function encodeAudio(buf, o, p){
  if (o.target === 'wav'){ p(70, 'Codificando WAV…'); await sleep(20); return encodeWav(buf); }
  return encodeMp3(buf, o.kbps, f => p(15 + Math.round(f * 80), 'Codificando MP3…'));
}

async function openEditor(it){
  toast('Cargando audio…');
  try { if (!it.audioBuf) it.audioBuf = await decodeAudio(it.file); }
  catch (e){ toast(e.message); return; }
  const buf = it.audioBuf, dur = buf.duration;
  let cuts = (it.cuts || []).map(c => c.slice());
  const hist = []; let sel = null, drag = null, pb = null;

  const NP = Math.max(50, Math.min(1200, buf.length)), peaks = [];
  const chd = []; for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chd.push(buf.getChannelData(c));
  const step = Math.max(1, Math.floor(buf.length / NP));
  for (let i = 0; i < NP; i++){
    let mn = 0, mx = 0; const a = i * step, b = Math.min(buf.length, a + step), st = Math.max(1, Math.floor((b - a) / 64));
    for (const d of chd) for (let k = a; k < b; k += st){ const v = d[k]; if (v < mn) mn = v; if (v > mx) mx = v; }
    peaks.push([mn, mx]);
  }

  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm';
  wrap.innerHTML =
    '<div class="pop max-h-[95vh] w-full max-w-3xl overflow-auto rounded-3xl border border-white/10 bg-[#0d0d12]/95 p-5 shadow-2xl sm:p-6">' +
      '<div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="font-display text-xl font-bold">✂ Editar audio</h3>' +
      '<p class="truncate text-xs text-white/50">' + esc(it.file.name) + '</p></div></div>' +
      '<p class="mt-3 text-sm text-white/65">Arrastra sobre la onda para seleccionar. Mueve los <b class="t-a">tiradores</b> de los bordes para ajustar, o arrastra la selección para desplazarla. Haz clic en una zona eliminada (en rojo) para recuperarla. Lo que quites desaparece y <b class="t-a">el resto se une solo</b>.</p>' +
      '<canvas id="edcv" class="mt-3 h-44 w-full cursor-crosshair rounded-xl border border-white/10 bg-black/40" style="touch-action:none"></canvas>' +
      '<div class="font-mono2 mt-2 flex flex-wrap justify-between gap-2 text-xs text-white/55"><span id="edinfo"></span><span id="edsel"></span></div>' +
      '<div class="mt-3 flex flex-wrap items-end gap-3">' +
        '<div><div class="lbl">Inicio (s)</div><input id="eds" type="number" min="0" step="0.1" class="sel w-28"></div>' +
        '<div><div class="lbl">Fin (s)</div><input id="ede" type="number" min="0" step="0.1" class="sel w-28"></div>' +
        '<button class="btn-ghost" data-ed="plsel">▶ Selección</button>' +
        '<button class="btn-ghost" data-ed="plall">▶ Resultado</button>' +
        '<button class="btn-ghost" data-ed="stop">■ Parar</button>' +
      '</div>' +
      '<div class="mt-4 flex flex-wrap gap-2">' +
        '<button class="btn" data-ed="cut">✂ Quitar selección</button>' +
        '<button class="btn-ghost" data-ed="keep">Conservar solo selección</button>' +
        '<button class="btn-ghost" data-ed="undo">↶ Deshacer</button>' +
        '<button class="btn-ghost" data-ed="reset">Restablecer</button>' +
      '</div>' +
      '<div class="mt-5 flex justify-end gap-2 border-t border-white/10 pt-4">' +
        '<button class="btn-ghost" data-ed="cancel">Cancelar</button><button class="btn" data-ed="apply">Aplicar cambios</button></div>' +
    '</div>';
  document.body.appendChild(wrap);
  const cv = wrap.querySelector('#edcv'), inS = wrap.querySelector('#eds'), inE = wrap.querySelector('#ede');

  const keptDur = () => keptRanges(dur, cuts).reduce((a, [s, e]) => a + (e - s), 0);

  let hover = null;
  function draw(){
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const acc = getComputedStyle(document.body).getPropertyValue('--a').trim() || '#fff';
    const RH = 18, WH = H - RH, mid = WH / 2;
    const n = Math.max(40, Math.floor(W / 4)), bw = W / n;
    const inCut = t => cuts.some(([s, e]) => t >= s && t < e);
    for (let i = 0; i < n; i++){
      const a0 = Math.floor(i / n * peaks.length), a1 = Math.max(a0 + 1, Math.floor((i + 1) / n * peaks.length));
      let m = 0; for (let k = a0; k < a1 && k < peaks.length; k++) m = Math.max(m, -peaks[k][0], peaks[k][1]);
      const h = Math.max(2, Math.min(1, m) * (WH - 10)), t = (i + .5) / n * dur;
      const inSel = sel && t >= sel[0] && t <= sel[1];
      g.fillStyle = inCut(t) ? 'rgba(244,63,94,.35)' : inSel ? acc : 'rgba(255,255,255,.72)';
      const x = i * bw + bw * .18, w = Math.max(1, bw * .64), y = mid - h / 2;
      if (g.roundRect){ g.beginPath(); g.roundRect(x, y, w, h, Math.min(w / 2, 2)); g.fill(); } else g.fillRect(x, y, w, h);
    }
    cuts.forEach(([s, e]) => {
      const x0 = s / dur * W, x1 = e / dur * W;
      g.fillStyle = 'rgba(244,63,94,.14)'; g.fillRect(x0, 0, x1 - x0, WH);
      g.strokeStyle = 'rgba(244,63,94,.7)'; g.setLineDash([4, 4]); g.strokeRect(x0 + .5, .5, x1 - x0 - 1, WH - 1); g.setLineDash([]);
      if (x1 - x0 > 46){ g.fillStyle = 'rgba(255,170,185,.9)'; g.font = '11px Inter,sans-serif'; g.textAlign = 'center'; g.fillText('eliminado', (x0 + x1) / 2, 13); }
    });
    if (sel){
      const x0 = sel[0] / dur * W, x1 = sel[1] / dur * W;
      g.globalAlpha = .16; g.fillStyle = acc; g.fillRect(x0, 0, x1 - x0, WH); g.globalAlpha = 1;
      for (const [x, k] of [[x0, 0], [x1, 1]]){
        g.fillStyle = acc; g.fillRect(x - 1.5, 0, 3, WH);
        const hw = hover === k ? 12 : 10, hh = hover === k ? 30 : 26;
        if (g.roundRect){ g.beginPath(); g.roundRect(x - hw / 2, mid - hh / 2, hw, hh, 4); g.fill(); } else g.fillRect(x - hw / 2, mid - hh / 2, hw, hh);
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - 2, mid - 6, 1.2, 12); g.fillRect(x + .8, mid - 6, 1.2, 12);
      }
    }
    // regla de tiempo
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, WH, W, 1);
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
    const st = steps.find(v => v / dur * W >= 70) || 3600;
    g.font = '10px "IBM Plex Mono",monospace'; g.fillStyle = 'rgba(255,255,255,.45)'; g.textAlign = 'left';
    for (let t = 0; t <= dur; t += st){ const x = t / dur * W; g.fillRect(x, WH, 1, 4); if (x < W - 30) g.fillText(fmtT(t), x + 3, H - 4); }
    if (pb && pb.pos != null){ g.fillStyle = '#fff'; g.fillRect(pb.pos / dur * W - 1, 0, 2, WH); }
  }
  function refresh(){
    wrap.querySelector('#edinfo').textContent = 'Original ' + fmtT(dur) + ' · Resultado ' + fmtT(keptDur()) + ' · ' + cuts.length + ' corte(s)';
    wrap.querySelector('#edsel').textContent = sel ? 'Selección ' + fmtT(sel[0]) + ' → ' + fmtT(sel[1]) + ' (' + (sel[1] - sel[0]).toFixed(1) + ' s)' : 'Sin selección';
    inS.value = sel ? sel[0].toFixed(1) : ''; inE.value = sel ? sel[1].toFixed(1) : '';
    wrap.querySelector('[data-ed=cut]').disabled = !sel;
    wrap.querySelector('[data-ed=keep]').disabled = !sel;
    wrap.querySelector('[data-ed=plsel]').disabled = !sel;
    wrap.querySelector('[data-ed=undo]').disabled = !hist.length;
    wrap.querySelector('[data-ed=reset]').disabled = !cuts.length;
    draw();
  }
  const tAt = e => { const r = cv.getBoundingClientRect(); return Math.max(0, Math.min(dur, (e.clientX - r.left) / r.width * dur)); };
  const pxT = px => px / cv.clientWidth * dur;
  const edgeAt = e => {
    if (!sel) return null;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, x0 = sel[0] / dur * r.width, x1 = sel[1] / dur * r.width;
    if (Math.abs(x - x0) <= 10) return 0; if (Math.abs(x - x1) <= 10) return 1;
    return null;
  };
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const t = tAt(e), edge = edgeAt(e);
    if (edge != null) drag = { kind:'edge', edge };
    else if (sel && t > sel[0] && t < sel[1]) drag = { kind:'move', off: t - sel[0], len: sel[1] - sel[0], x: e.clientX, moved:false };
    else {
      const ci = cuts.findIndex(([s, e2]) => t >= s && t < e2);
      drag = { kind:'new', t0: t, x: e.clientX, cut: ci, moved:false };
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!drag){
      const ed = edgeAt(e), t = tAt(e);
      hover = ed;
      cv.style.cursor = ed != null ? 'ew-resize' : (sel && t > sel[0] && t < sel[1]) ? 'grab' : cuts.some(([s, e2]) => t >= s && t < e2) ? 'pointer' : 'crosshair';
      draw(); return;
    }
    const t = tAt(e);
    if (drag.kind === 'edge'){
      const min = pxT(6);
      if (drag.edge === 0) sel[0] = Math.max(0, Math.min(t, sel[1] - min)); else sel[1] = Math.min(dur, Math.max(t, sel[0] + min));
    } else if (drag.kind === 'move'){
      if (Math.abs(e.clientX - drag.x) > 3) drag.moved = true;
      cv.style.cursor = 'grabbing';
      const s0 = Math.max(0, Math.min(dur - drag.len, t - drag.off)); sel = [s0, s0 + drag.len];
    } else {
      if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true;
      if (!drag.moved) return;
      sel = [Math.min(drag.t0, t), Math.max(drag.t0, t)];
      if (sel[1] - sel[0] < 0.02) sel = null;
    }
    refresh();
  });
  cv.addEventListener('pointerup', () => {
    if (drag && drag.kind === 'new' && !drag.moved){
      if (drag.cut > -1){ push(); sel = cuts[drag.cut].slice(); cuts.splice(drag.cut, 1); toast('Zona recuperada: ajústala y vuelve a quitarla, o déjala así.'); }
      else sel = null;
    }
    drag = null; refresh();
  });
  cv.addEventListener('pointerleave', () => { if (!drag && hover != null){ hover = null; draw(); } });
  const fromInputs = () => {
    let a = parseFloat(inS.value), b = parseFloat(inE.value);
    if (isNaN(a) || isNaN(b)) return;
    a = Math.max(0, Math.min(dur, a)); b = Math.max(0, Math.min(dur, b));
    sel = b - a > 0.04 ? [Math.min(a, b), Math.max(a, b)] : null;
    const ae = document.activeElement; refresh(); if (ae === inS) inS.focus(); if (ae === inE) inE.focus();
  };
  inS.addEventListener('change', fromInputs); inE.addEventListener('change', fromInputs);

  function stopPb(){ if (pb){ cancelAnimationFrame(pb.raf); try { pb.ctx.close(); } catch (e){} pb = null; draw(); } }
  function play(ranges){
    stopPb(); if (!ranges.length) return;
    const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
    let when = ctx.currentTime + 0.06; const segs = [];
    for (const [a, b] of ranges){
      const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start(when, a, b - a);
      segs.push({ a, b, t0: when }); when += b - a;
    }
    pb = { ctx, segs, end: when, raf: 0, pos: null };
    const tick = () => {
      if (!pb) return;
      const now = pb.ctx.currentTime;
      if (now >= pb.end){ stopPb(); return; }
      const sg = pb.segs.find(s => now >= s.t0 && now < s.t0 + (s.b - s.a));
      if (sg) pb.pos = sg.a + (now - sg.t0);
      draw(); pb.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  const push = () => hist.push(cuts.map(c => c.slice()));
  const close = () => { stopPb(); window.removeEventListener('resize', draw); document.removeEventListener('keydown', onKey); wrap.remove(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', draw);

  wrap.addEventListener('click', e => {
    const b = e.target.closest('[data-ed]');
    if (!b){ if (e.target === wrap) close(); return; }
    const a = b.dataset.ed;
    if (a === 'cut' && sel){ push(); cuts = mergeCuts(cuts.concat([sel])); sel = null; }
    else if (a === 'keep' && sel){ push(); cuts = mergeCuts(cuts.concat([[0, sel[0]], [sel[1], dur]].filter(r => r[1] - r[0] > 0.001))); sel = null; }
    else if (a === 'undo' && hist.length){ cuts = hist.pop(); }
    else if (a === 'reset' && cuts.length){ push(); cuts = []; }
    else if (a === 'plsel' && sel){ play([sel]); }
    else if (a === 'plall'){ play(keptRanges(dur, cuts)); }
    else if (a === 'stop'){ stopPb(); }
    else if (a === 'cancel'){ close(); return; }
    else if (a === 'apply'){
      if (!keptRanges(dur, cuts).length){ toast('No queda audio: has cortado todo.'); return; }
      it.cuts = cuts; it.keptDur = keptDur(); close(); if (it.onApply) it.onApply(); return;
    }
    refresh();
  });
  refresh();
}

// ---------- Stickers de WhatsApp ----------
async function runSticker(file, o, p){
  const base = file.name.replace(/\.[^.]+$/, '') || 'sticker';
  p(10, 'Cargando imagen…');
  const bmp = await createImageBitmap(file);
  const S = 512, m = o.outline ? 14 : 0;
  const sc = o.fit === 'cover' ? Math.max(S / bmp.width, S / bmp.height) : Math.min((S - 2*m) / bmp.width, (S - 2*m) / bmp.height);
  const dw = bmp.width * sc, dh = bmp.height * sc, dx = (S - dw) / 2, dy = (S - dh) / 2;

  p(30, 'Componiendo sticker…');
  const baseC = document.createElement('canvas'); baseC.width = baseC.height = S;
  const bctx = baseC.getContext('2d');
  const rx = Math.max(dx, 0), ry = Math.max(dy, 0), rw = Math.min(dw, S), rh = Math.min(dh, S);
  if (o.shape === 'circle'){
    bctx.beginPath(); bctx.arc(S/2, S/2, Math.min(rw, rh)/2, 0, Math.PI*2); bctx.clip();
  } else if (o.shape === 'round' && bctx.roundRect){
    bctx.beginPath(); bctx.roundRect(rx, ry, rw, rh, Math.min(rw, rh) * 0.18); bctx.clip();
  }
  bctx.drawImage(bmp, dx, dy, dw, dh);

  const out = document.createElement('canvas'); out.width = out.height = S;
  const ctx = out.getContext('2d');
  if (o.outline){
    const sil = document.createElement('canvas'); sil.width = sil.height = S;
    const sctx = sil.getContext('2d');
    sctx.drawImage(baseC, 0, 0);
    sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = '#fff'; sctx.fillRect(0, 0, S, S);
    for (const r of [4, 8, 11]) for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) ctx.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.drawImage(baseC, 0, 0);

  p(55, 'Ajustando peso (máx. 100 KB)…');
  let blob = null;
  for (const q of [0.92, 0.82, 0.72, 0.62, 0.52, 0.42, 0.32, 0.22, 0.12]){
    blob = await new Promise(r => out.toBlob(r, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp') throw new Error('Tu navegador no puede crear imágenes WebP. Usa Chrome o Edge.');
    if (blob.size <= 100 * 1024) break;
    await sleep(0);
  }
  return { blob, name: 'sticker-' + base + '.webp', warn: blob.size > 100 * 1024 };
}


const FF_CDN = 'https://cdn.jsdelivr.net/npm/';
let ffPromise = null, ffProg = null;
async function cdnBlobURL(path, type, p, from, to){
  const r = await fetch(FF_CDN + path);
  if (!r.ok) throw new Error('No se pudo descargar ' + path);
  const total = +r.headers.get('content-length') || 0;
  if (!p || !total || !r.body) return URL.createObjectURL(new Blob([await r.arrayBuffer()], { type }));
  const rd = r.body.getReader(), parts = []; let got = 0;
  for (;;){
    const { done, value } = await rd.read(); if (done) break;
    parts.push(value); got += value.length;
    p(from + Math.round((to - from) * got / total), 'Descargando ffmpeg (solo la primera vez)… ' + Math.round(got / 1048576) + ' / ' + Math.round(total / 1048576) + ' MB');
  }
  return URL.createObjectURL(new Blob(parts, { type }));
}
function loadFFmpeg(p){
  if (!ffPromise){
    ffPromise = (async () => {
      p(2, 'Cargando ffmpeg…');
      const { FFmpeg } = await import(/* webpackIgnore: true */ FF_CDN + '@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');
      const ff = new FFmpeg();
      ff.on('progress', e => { if (ffProg) ffProg(e.progress); });
      const worker = URL.createObjectURL(new Blob(["import '" + FF_CDN + "@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js';"], { type:'text/javascript' }));
      const core = await cdnBlobURL('@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js', 'text/javascript');
      const wasm = await cdnBlobURL('@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm', 'application/wasm', p, 3, 30);
      p(31, 'Iniciando ffmpeg…');
      await ff.load({ classWorkerURL: worker, coreURL: core, wasmURL: wasm });
      return ff;
    })();
    ffPromise.catch(() => { ffPromise = null; });
  }
  return ffPromise;
}
async function wasmToMp4(file, base, p){
  const ff = await loadFFmpeg(p);
  const ext = (file.name.match(/\.[^.]+$/) || ['.webm'])[0].toLowerCase();
  const inp = 'in' + ext, out = 'out.mp4';
  p(33, 'Preparando archivo…');
  await ff.writeFile(inp, new Uint8Array(await file.arrayBuffer()));
  ffProg = f => p(35 + Math.max(0, Math.min(63, Math.round(f * 63))), 'Convirtiendo con ffmpeg… ' + Math.max(0, Math.min(100, Math.round(f * 100))) + '%');
  try {
    const code = await ff.exec(['-i', inp, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
    if (code !== 0) throw new Error('ffmpeg terminó con código ' + code);
    const data = await ff.readFile(out);
    return { blob: new Blob([data], { type:'video/mp4' }), name: base + '.mp4' };
  } finally {
    ffProg = null;
    try { await ff.deleteFile(inp); } catch (e){}
    try { await ff.deleteFile(out); } catch (e){}
  }
}


// ---------- Nuevas conversiones ----------
export async function imageToWebp(file, o, p) {
  const base = file.name.replace(/\.[^.]+$/, '') || 'imagen';
  p(30, 'Decodificando…');
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  p(60, 'Codificando WebP…');
  const blob = await new Promise(r => c.toBlob(r, 'image/webp', (o.quality || 85) / 100));
  if (!blob || blob.type !== 'image/webp') throw new Error('Tu navegador no puede crear WebP. Usa Chrome, Edge o Firefox reciente.');
  return { blob, name: base + '.webp' };
}

function coverCanvas(title, accent1, accent2) {
  const W = 1280, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, accent1); gr.addColorStop(1, accent2);
  g.fillStyle = '#0b0a12'; g.fillRect(0, 0, W, H);
  g.globalAlpha = .55; g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 64; i++) { const h = 40 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * .45)) * 220; g.fillRect(160 + i * 15, H / 2 + 40 - h / 2, 8, h); }
  g.font = 'bold 54px Inter, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff';
  g.fillText(title.length > 40 ? title.slice(0, 39) + '…' : title, W / 2, 150);
  return c;
}

export async function audioToVideo(file, o, p) {
  const base = file.name.replace(/\.[^.]+$/, '') || 'audio';
  let imgBlob;
  if (o.cover) {
    const bmp = await createImageBitmap(o.cover);
    const c = document.createElement('canvas'); c.width = bmp.width & ~1 || 2; c.height = bmp.height & ~1 || 2;
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    imgBlob = await new Promise(r => c.toBlob(r, 'image/png'));
  } else imgBlob = await new Promise(r => coverCanvas(base, '#22d3ee', '#2563eb').toBlob(r, 'image/png'));
  const ff = await loadFFmpeg(p);
  const ext = (file.name.match(/\.[^.]+$/) || ['.mp3'])[0].toLowerCase();
  await ff.writeFile('cover.png', new Uint8Array(await imgBlob.arrayBuffer()));
  await ff.writeFile('in' + ext, new Uint8Array(await file.arrayBuffer()));
  ffProg = f => p(35 + Math.max(0, Math.min(63, Math.round(f * 63))), 'Creando vídeo… ' + Math.max(0, Math.min(100, Math.round(f * 100))) + '%');
  try {
    const code = await ff.exec(['-loop', '1', '-framerate', '2', '-i', 'cover.png', '-i', 'in' + ext, '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'out.mp4']);
    if (code !== 0) throw new Error('ffmpeg no pudo crear el vídeo.');
    const data = await ff.readFile('out.mp4');
    return { blob: new Blob([data], { type: 'video/mp4' }), name: base + '.mp4' };
  } finally {
    ffProg = null;
    for (const f of ['cover.png', 'in' + ext, 'out.mp4']) { try { await ff.deleteFile(f); } catch (e) {} }
  }
}

let bgPromise = null;
export function loadBgRemover(p) {
  if (!bgPromise) {
    bgPromise = (async () => {
      p && p(5, 'Cargando el quitafondos (solo la primera vez, ~45 MB)…');
      const T = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5');
      return T.pipeline('background-removal', 'briaai/RMBG-1.4', {
        dtype: 'q8',
        progress_callback: e => { if (p && e.status === 'progress' && e.total > 5e6) p(5 + Math.round(e.progress * .35), 'Descargando modelo… ' + Math.round(e.loaded / 1048576) + ' / ' + Math.round(e.total / 1048576) + ' MB'); },
      });
    })();
    bgPromise.catch(() => { bgPromise = null; });
  }
  return bgPromise;
}

export async function removeBackground(file, p) {
  const seg = await loadBgRemover(p);
  p && p(45, 'Quitando el fondo…');
  const url = URL.createObjectURL(file);
  try {
    const out = await seg(url);
    const im = Array.isArray(out) ? out[0] : out;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const id = new ImageData(new Uint8ClampedArray(im.channels === 4 ? im.data : im.rgba().data), im.width, im.height);
    c.getContext('2d').putImageData(id, 0, 0);
    return await new Promise(r => c.toBlob(r, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export async function stickerFrom(file, o, p) {
  let src = file;
  if (o.removeBg) {
    const png = await removeBackground(file, (v, m) => p(Math.round(v * .5), m));
    src = new File([png], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
  }
  return runSticker(src, o, (v, m) => p(o.removeBg ? 50 + Math.round(v * .5) : v, m));
}

export async function makeStickerPack(results, packName, author) {
  const zip = new JSZip();
  results.slice(0, 30).forEach((r, i) => zip.file((i + 1) + '.webp', r.blob));
  const bmp = await createImageBitmap(results[0].blob);
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const sc = Math.min(96 / bmp.width, 96 / bmp.height);
  c.getContext('2d').drawImage(bmp, (96 - bmp.width * sc) / 2, (96 - bmp.height * sc) / 2, bmp.width * sc, bmp.height * sc);
  zip.file('tray.png', await new Promise(r => c.toBlob(r, 'image/png')));
  zip.file('title.txt', packName || 'Mi pack');
  zip.file('author.txt', author || '');
  if (results.length > 30) toast('Un pack admite máximo 30 stickers: he incluido los 30 primeros.');
  return zip.generateAsync({ type: 'blob' });
}

export async function zipResults(results) {
  const zip = new JSZip(), used = {};
  results.forEach(r => {
    let n = r.name;
    if (used[n]) { const dot = n.lastIndexOf('.'); n = n.slice(0, dot) + '-' + used[n] + n.slice(dot); }
    used[r.name] = (used[r.name] || 0) + 1;
    zip.file(n, r.blob);
  });
  return zip.generateAsync({ type: 'blob' });
}

export async function convertMedia(file, o, p, it) {
  const base = file.name.replace(/\.[^.]+$/, '') || 'archivo';
  if (o.target === 'video') {
    if (o.engine === 'wasm' && file.size <= 1.5e9) {
      try { return await wasmToMp4(file, base, p); }
      catch (e) { console.error(e); toast('ffmpeg no pudo con este archivo: se grabará en tiempo real.'); }
    }
    return mediaToVideo(file, base, p);
  }
  p(8, 'Extrayendo audio…');
  let buf = (it && it.audioBuf) || await decodeAudio(file);
  const edited = !!(it && it.cuts && it.cuts.length);
  if (edited) buf = pieceFromCuts(buf, it.cuts);
  buf = applyFades(buf, o);
  const blob = await encodeAudio(buf, o, p);
  if (it) it.audioBuf = null;
  return { blob, name: base + (edited ? '-editado' : '') + '.' + o.target };
}

export async function mergeMedia(items, o, p) {
  const bufs = [];
  for (let k = 0; k < items.length; k++) {
    p(Math.round(k / items.length * 40), 'Decodificando ' + (k + 1) + '/' + items.length + '…');
    let b = items[k].audioBuf || await decodeAudio(items[k].file);
    if (items[k].cuts && items[k].cuts.length) b = pieceFromCuts(b, items[k].cuts);
    bufs.push(b);
  }
  const merged = applyFades(concatBuffers(bufs), o);
  const blob = await encodeAudio(merged, o, (v, m) => p(40 + Math.round(v * .6), m));
  return { blob, name: 'unido-' + items[0].file.name.replace(/\.[^.]+$/, '') + '.' + o.target };
}

export { convertWebp, openEditor, fmtT, sleep };
