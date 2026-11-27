'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ToolIcon } from '../../components/Icon';
import { ACCENTS } from '../../components/accents';

const A = ACCENTS.bg;
const PREVIEW_MAX = 1200;
const DEFAULTS = { method: 'ai', threshold: 50, hardness: 60, shift: 0, feather: 1, bg: 'transparent', color: '#ffffff', key: '#000000', tol: 30, soft: 15 };
const METHODS = [['ai', 'IA'], ['color', 'Por color'], ['both', 'IA + color']];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BGS = [['transparent', 'Transparente'], ['white', 'Blanco'], ['black', 'Negro'], ['color', 'Color']];

function Slider({ label, value, min, max, step = 1, onChange, unit = '', hint }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className={'text-[11px] font-semibold uppercase tracking-wider ' + A.text}>{label}</span>
        <span className="font-mono text-xs text-white/60">{value > 0 && min < 0 ? '+' : ''}{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)}
        className="cv-range mt-2 w-full" style={{ '--p': pct + '%' }} />
      {hint && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
    </label>
  );
}

// Aplica los ajustes a la máscara y compone la imagen final en `out`.
// Máscara por color: transparente lo que se parece al color elegido (distancia en RGB).
function colorMask(src, w, h, o) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, [r0, g0, b0] = hex(o.key);
  const t = o.tol / 100 * 441, s = Math.max(1, o.soft / 100 * 441), m = new Uint8ClampedArray(w * h);
  for (let i = 0; i < m.length; i++) {
    const k = i * 4, dr = d[k] - r0, dg = d[k + 1] - g0, db = d[k + 2] - b0;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    m[i] = dist <= t ? 0 : dist >= t + s ? 255 : Math.round((dist - t) / s * 255);
  }
  return m;
}

function render(out, src, mask, mw, mh, o, scale) {
  const W = out.width, H = out.height;
  // 1) máscara base según el método, a tamaño de salida
  let base = mask, bw = mw, bh = mh;
  if (o.method !== 'ai') {
    const cm = colorMask(src, W, H, o);
    if (o.method === 'color') { base = cm; bw = W; bh = H; }
    else {
      const ai = document.createElement('canvas'); ai.width = mw; ai.height = mh;
      const aid = new ImageData(mw, mh);
      for (let i = 0; i < mask.length; i++) aid.data[i * 4 + 3] = mask[i];
      ai.getContext('2d').putImageData(aid, 0, 0);
      const rs = document.createElement('canvas'); rs.width = W; rs.height = H;
      const rx = rs.getContext('2d', { willReadFrequently: true }); rx.drawImage(ai, 0, 0, W, H);
      const ad = rx.getImageData(0, 0, W, H).data, comb = new Uint8ClampedArray(W * H);
      for (let i = 0; i < comb.length; i++) comb[i] = Math.min(ad[i * 4 + 3], cm[i]);
      base = comb; bw = W; bh = H;
    }
  }
  const mc = document.createElement('canvas'); mc.width = bw; mc.height = bh;
  const mid = new ImageData(bw, bh);
  for (let i = 0; i < base.length; i++) { const k = i * 4; mid.data[k] = mid.data[k + 1] = mid.data[k + 2] = 255; mid.data[k + 3] = base[i]; }
  mc.getContext('2d').putImageData(mid, 0, 0);
  const sc = document.createElement('canvas'); sc.width = W; sc.height = H;
  const sx = sc.getContext('2d', { willReadFrequently: true });
  const spread = Math.abs(o.shift) * scale;
  if (spread > 0) sx.filter = 'blur(' + spread + 'px)';
  sx.drawImage(mc, 0, 0, W, H);
  sx.filter = 'none';
  // 2) curva de umbral y dureza (con desplazamiento del borde)
  const t = Math.max(0, Math.min(100, o.threshold - o.shift * 4)) / 100;
  const w = Math.max(0.004, (100 - o.hardness) / 100 * 0.5);
  const lo = t - w, hi = t + w, lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) { const x = Math.max(0, Math.min(1, (v / 255 - lo) / (hi - lo))); lut[v] = Math.round(x * x * (3 - 2 * x) * 255); }
  const id = sx.getImageData(0, 0, W, H);
  for (let k = 3; k < id.data.length; k += 4) id.data[k] = lut[id.data[k]];
  sx.putImageData(id, 0, 0);
  // 3) suavizado del borde
  let alpha = sc;
  if (o.feather > 0) {
    const fc = document.createElement('canvas'); fc.width = W; fc.height = H;
    const fx = fc.getContext('2d'); fx.filter = 'blur(' + o.feather * scale + 'px)'; fx.drawImage(sc, 0, 0); alpha = fc;
  }
  // 4) composición
  const ctx = out.getContext('2d');
  ctx.save(); ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(src, 0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(alpha, 0, 0);
  if (o.bg !== 'transparent') {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = o.bg === 'white' ? '#fff' : o.bg === 'black' ? '#000' : o.color;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

export default function BgTool() {
  const [file, setFile] = useState(null);
  const [state, setState] = useState('idle');
  const [progress, setProgress] = useState({ p: 0, msg: '' });
  const [error, setError] = useState('');
  const [o, setO] = useState(DEFAULTS);
  const [pos, setPos] = useState(50);
  const [drag, setDrag] = useState(false);
  const [origUrl, setOrigUrl] = useState('');
  const [dims, setDims] = useState({ w: 4, h: 3 });
  const [picking, setPicking] = useState(false);
  const data = useRef(null);
  const canvas = useRef(null);
  const box = useRef(null);
  const input = useRef(null);
  const raf = useRef(0);
  const set = (k, v) => setO(x => ({ ...x, [k]: v }));

  async function load(f) {
    if (!f || !/^image\//.test(f.type)) { setError('Elige una imagen (PNG, JPG o WebP).'); return; }
    setError(''); setFile(f); setState('working'); setO(DEFAULTS); setPos(50);
    if (origUrl) URL.revokeObjectURL(origUrl);
    setOrigUrl(URL.createObjectURL(f));
    try {
      const e = await import('../../lib/engine');
      const bmp = await createImageBitmap(f);
      const m = await e.getMask(f, (p, msg) => setProgress({ p, msg }));
      const s = Math.min(1, PREVIEW_MAX / Math.max(bmp.width, bmp.height));
      data.current = { bmp, ...m, pw: Math.round(bmp.width * s), ph: Math.round(bmp.height * s), s };
      setDims({ w: bmp.width, h: bmp.height });
      setState('ready');
    } catch (err) {
      console.error(err);
      setError((err && err.message) || 'No se pudo procesar la imagen.');
      setState('idle');
    }
  }

  const draw = useCallback(() => {
    const d = data.current, c = canvas.current;
    if (!d || !c) return;
    c.width = d.pw; c.height = d.ph;
    render(c, d.bmp, d.mask, d.width, d.height, o, d.s);
  }, [o]);

  useEffect(() => {
    if (state !== 'ready') return;
    clearTimeout(raf.current);
    raf.current = setTimeout(draw, 16);
    return () => clearTimeout(raf.current);
  }, [state, draw]);

  function pick(e) {
    const d = data.current; if (!d || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const px = Math.floor((e.clientX - r.left) / r.width * d.bmp.width), py = Math.floor((e.clientY - r.top) / r.height * d.bmp.height);
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const x = c.getContext('2d'); x.drawImage(d.bmp, px, py, 1, 1, 0, 0, 1, 1);
    const [R, G, B] = x.getImageData(0, 0, 1, 1).data;
    set('key', '#' + [R, G, B].map(v => v.toString(16).padStart(2, '0')).join(''));
    setO(v => ({ ...v, method: v.method === 'ai' ? 'both' : v.method }));
    setPicking(false);
  }

  function onMove(e) {
    if (!box.current) return;
    const r = box.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  }

  async function download() {
    const d = data.current; if (!d) return;
    const c = document.createElement('canvas'); c.width = d.bmp.width; c.height = d.bmp.height;
    render(c, d.bmp, d.mask, d.width, d.height, o, 1);
    const jpg = o.bg !== 'transparent';
    const blob = await new Promise(r => c.toBlob(r, jpg ? 'image/jpeg' : 'image/png', 0.95));
    const e = await import('../../lib/engine');
    e.downloadBlob(blob, file.name.replace(/\.[^.]+$/, '') + '-sin-fondo.' + (jpg ? 'jpg' : 'png'));
  }

  function reset() { setFile(null); setState('idle'); data.current = null; }

  return (
    <main className="relative mx-auto max-w-5xl px-5 pb-20 pt-10">
      <div className={'pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b opacity-25 blur-3xl ' + A.grad} />
      <Link href="/" className="text-sm text-white/50 transition hover:text-white">← Todas las herramientas</Link>
      <div className="mt-6 flex items-center gap-4">
        <ToolIcon id="bg" className="h-14 w-14" />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Quitar fondo</h1>
          <p className="mt-1 text-sm text-white/55">Elimina el fondo con IA en tu navegador y ajusta el borde viendo el resultado al momento.</p>
        </div>
      </div>

      {state !== 'ready' ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-6">
          {state === 'working' ? (
            <div className="flex flex-col items-center px-4 py-14 text-center">
              {origUrl && <img src={origUrl} alt="" className="h-28 w-28 rounded-2xl object-cover opacity-70" />}
              <p className="mt-5 font-semibold">{progress.msg || 'Preparando…'}</p>
              <div className="mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
                <div className={'h-full rounded-full bg-gradient-to-r transition-all ' + A.grad} style={{ width: Math.max(4, progress.p) + '%' }} />
              </div>
              <p className="mt-3 text-xs text-white/40">La primera vez se descarga el modelo de IA (~45 MB). Después va mucho más rápido.</p>
            </div>
          ) : (
            <div role="button" tabIndex={0}
              onClick={() => input.current && input.current.click()}
              onKeyDown={e => { if (e.key === 'Enter' && input.current) input.current.click(); }}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]); }}
              className={'flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-14 text-center transition ' + (drag ? 'scale-[1.01] bg-white/[.07] ' + A.border : 'border-white/15 hover:bg-white/[.04] ' + A.hoverBorder)}>
              <ToolIcon id="bg" className="h-14 w-14" />
              <p className="mt-3 font-semibold">Suelta una foto</p>
              <p className="mt-1 text-xs text-white/45">o haz clic para elegirla · PNG, JPG o WebP · no se sube a ningún sitio</p>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { load(e.target.files[0]); e.target.value = ''; }} />
            </div>
          )}
          {error && <p className="mt-3 text-center text-sm text-rose-300">{error}</p>}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="rounded-3xl border border-white/10 bg-white/[.03] p-3 sm:p-4">
            <div ref={box}
              onPointerDown={e => { if (picking) { pick(e); return; } e.currentTarget.setPointerCapture(e.pointerId); onMove(e); }}
              onPointerMove={e => { if (e.buttons && !picking) onMove(e); }}
              className={'relative mx-auto w-full touch-none select-none overflow-hidden rounded-2xl ' + (picking ? 'cursor-crosshair ring-2 ring-sky-300' : 'cursor-ew-resize')}
              style={{ aspectRatio: dims.w + ' / ' + dims.h, maxHeight: '70vh', maxWidth: 'calc(70vh * ' + dims.w / dims.h + ')', background: 'repeating-conic-gradient(#ffffff1f 0 25%, #0000 0 50%) 0 0 / 20px 20px' }}>
              <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
              <img src={origUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ clipPath: 'inset(0 ' + (100 - pos) + '% 0 0)' }} />
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,.6)]" style={{ left: 'calc(' + pos + '% - 1px)' }}>
                <div className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-indigo-700 shadow-xl">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6-6 6 6 6" /><path d="m15 6 6 6-6 6" /></svg>
                </div>
              </div>
              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold">Original</span>
              <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold">Sin fondo</span>
            </div>
            <p className="mt-2 text-center text-xs text-white/40">{picking ? 'Haz clic en el color del fondo que quieres quitar' : 'Arrastra sobre la imagen para comparar'}</p>
          </div>

          <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[.03] p-5">
            <div>
              <span className={'text-[11px] font-semibold uppercase tracking-wider ' + A.text}>Método</span>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {METHODS.map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set('method', v)}
                    className={'truncate rounded-lg border px-1 py-1.5 text-xs transition ' + (o.method === v ? 'border-sky-300 bg-sky-300/15 text-white' : 'border-white/10 text-white/60 hover:border-white/25')}>{l}</button>
                ))}
              </div>
              <span className="mt-1.5 block text-xs text-white/40">{o.method === 'ai' ? 'La IA detecta el sujeto.' : o.method === 'color' ? 'Quita el color que elijas (ideal para fondos lisos).' : 'La IA detecta el sujeto y además quita el color elegido.'}</span>
            </div>
            {o.method !== 'ai' && (
              <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                <div className="flex items-center gap-2">
                  <input type="color" value={o.key} onChange={e => set('key', e.target.value)} className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent" title="Color a quitar" />
                  <button type="button" onClick={() => setPicking(p => !p)}
                    className={'flex-1 rounded-lg border px-2 py-2 text-xs font-semibold transition ' + (picking ? 'border-sky-300 bg-sky-300/20 text-white' : 'border-white/15 text-white/75 hover:bg-white/5')}>
                    {picking ? 'Haz clic en la imagen…' : 'Elegir color de la imagen'}
                  </button>
                </div>
                <Slider label="Tolerancia de color" value={o.tol} min={0} max={100} unit="%" onChange={v => set('tol', v)} hint="Cuánto se puede parecer un color al elegido para quitarlo." />
                <Slider label="Transición" value={o.soft} min={0} max={60} unit="%" onChange={v => set('soft', v)} hint="Paso gradual entre lo que se quita y lo que se queda." />
              </div>
            )}
            {o.method !== 'color' && <Slider label="Umbral de la IA" value={o.threshold} min={5} max={95} onChange={v => set('threshold', v)} hint="Más alto: recorta más, quita restos de fondo." />}
            <Slider label="Dureza del borde" value={o.hardness} min={0} max={100} unit="%" onChange={v => set('hardness', v)} hint="Más alto: borde más nítido. Más bajo: más natural." />
            <Slider label="Expandir / contraer" value={o.shift} min={-8} max={8} unit=" px" onChange={v => set('shift', v)} hint="Amplía o encoge el recorte alrededor del sujeto." />
            <Slider label="Suavizado" value={o.feather} min={0} max={10} step={0.5} unit=" px" onChange={v => set('feather', v)} hint="Difumina el borde para que no se vea recortado." />
            <div>
              <span className={'text-[11px] font-semibold uppercase tracking-wider ' + A.text}>Fondo</span>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {BGS.map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set('bg', v)}
                    className={'rounded-lg border px-1 py-1.5 text-xs transition ' + (o.bg === v ? 'border-sky-300 bg-sky-300/15 text-white' : 'border-white/10 text-white/60 hover:border-white/25')}>{l}</button>
                ))}
              </div>
              {o.bg === 'color' && <input type="color" value={o.color} onChange={e => set('color', e.target.value)} className="mt-2 h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent" />}
            </div>
            <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
              <button type="button" onClick={download} className={'rounded-xl bg-gradient-to-r py-2.5 text-sm font-semibold text-black ' + A.grad}>
                Descargar {o.bg === 'transparent' ? 'PNG' : 'JPG'} · {dims.w}×{dims.h}
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setO(DEFAULTS)} className="flex-1 rounded-xl border border-white/15 py-2 text-sm text-white/75 hover:bg-white/5">Restablecer</button>
                <button type="button" onClick={reset} className="flex-1 rounded-xl border border-white/15 py-2 text-sm text-white/75 hover:bg-white/5">Otra imagen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
