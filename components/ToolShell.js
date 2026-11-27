'use client';
import { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { ToolIcon } from './Icon';

const fmt = b => (b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
let uid = 0;

export function SwapArrows({ spin, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={'transition-transform duration-500 ease-[cubic-bezier(.5,1.6,.4,1)] ' + className} style={{ transform: 'rotate(' + spin * 180 + 'deg)' }}
      fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.3-4.9" /><path d="M5 2.5v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9" /><path d="M19 21.5v-4h-4" />
    </svg>
  );
}

function Select({ value, onChange, options, accent }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className={'w-full appearance-none rounded-xl border border-white/10 bg-black/40 py-2 pl-3 pr-9 text-sm text-white outline-none transition focus:ring-2 ' + accent.ring}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" fill="currentColor" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

function Fields({ fields, opts, setOpt, accent }) {
  const visible = fields.filter(f => !f.when || f.when(opts));
  const boxes = visible.filter(f => f.type !== 'check');
  const checks = visible.filter(f => f.type === 'check');
  return (
    <div className="space-y-4">
      {boxes.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boxes.map(f => (
            <label key={f.key} className="block min-w-0">
              <span className={'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider ' + accent.text}>{f.label}</span>
              {f.type === 'select' && <Select value={String(opts[f.key])} accent={accent} options={f.options.map(([v, l]) => [String(v), l])} onChange={v => setOpt(f.key, f.num ? +v : v)} />}
              {f.type === 'text' && <input value={opts[f.key]} placeholder={f.ph || ''} onChange={e => setOpt(f.key, e.target.value)} className={'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:ring-2 ' + accent.ring} />}
              {f.type === 'file' && (
                <span className="flex items-center gap-2">
                  <span className="relative flex-1 cursor-pointer truncate rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/70 hover:border-white/25">
                    {opts[f.key] ? opts[f.key].name : (f.ph || 'Elegir…')}
                    <input type="file" accept={f.accept} className="absolute inset-0 cursor-pointer opacity-0" onChange={e => { setOpt(f.key, e.target.files[0] || null); e.target.value = ''; }} />
                  </span>
                  {opts[f.key] && <button type="button" onClick={() => setOpt(f.key, null)} className="rounded-lg px-2 py-1 text-xs text-white/50 hover:text-white">Quitar</button>}
                </span>
              )}
              {f.hint && <span className="mt-1 block text-xs text-white/40">{f.hint}</span>}
            </label>
          ))}
        </div>
      )}
      {checks.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          {checks.map(f => (
            <button key={f.key} type="button" onClick={() => setOpt(f.key, !opts[f.key])} className="flex items-center gap-2.5 text-left text-sm text-white/80">
              <span className={'relative h-5 w-9 shrink-0 rounded-full transition ' + (opts[f.key] ? 'bg-gradient-to-r ' + accent.grad : 'bg-white/15')}>
                <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ' + (opts[f.key] ? 'left-[18px]' : 'left-0.5')} />
              </span>
              <span>{f.label}{f.hint && <span className="block text-xs text-white/40">{f.hint}</span>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ToolShell({ id, accent, modes, packAction }) {
  const [mi, setMi] = useState(0);
  const [spin, setSpin] = useState(0);
  const [fade, setFade] = useState(false);
  const mode = modes[mi];
  const [optsBy, setOptsBy] = useState(() => modes.map(m => ({ ...m.defaults })));
  const opts = optsBy[mi];
  const setOpt = (k, v) => setOptsBy(all => all.map((o, i) => (i === mi ? { ...o, [k]: v } : o)));
  const queues = useRef(modes.map(() => []));
  const [, bump] = useReducer(x => x + 1, 0);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const items = queues.current[mi];

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('modo');
    const k = modes.findIndex(x => x.key === m);
    if (k > 0) { setMi(k); setSpin(k); }
  }, [modes]);

  function swap() {
    if (busy || modes.length < 2) return;
    setSpin(s => s + 1); setFade(true);
    setTimeout(() => {
      setMi(i => {
        const n = (i + 1) % modes.length;
        const u = new URL(window.location.href); u.searchParams.set('modo', modes[n].key); window.history.replaceState(null, '', u);
        return n;
      });
      setFade(false);
    }, 180);
  }
  function add(files) {
    const all = Array.from(files || []);
    const ok = all.filter(f => mode.test(f));
    if (ok.length < all.length && typeof window !== 'undefined') import('../lib/engine').then(e => e.toast('Algunos archivos no son del tipo correcto y se han ignorado.'));
    ok.forEach(file => {
      const it = { id: ++uid, file, status: 'pending', progress: 0, msg: '' };
      if (mode.thumb && /^image\//.test(file.type)) it.thumb = URL.createObjectURL(file);
      it.onApply = bump;
      items.push(it);
    });
    bump();
  }
  async function runAll() {
    setBusy(true);
    const o = { ...opts };
    const pend = items.filter(i => i.status === 'pending');
    const set = (it, p) => { Object.assign(it, p); bump(); };
    if (mode.batch && mode.useBatch && mode.useBatch(o) && pend.length > 1) {
      const lead = pend[0];
      pend.forEach(i => set(i, { status: 'working', msg: 'Esperando…', progress: 0 }));
      try {
        const r = await mode.batch(pend, o, (p, msg) => set(lead, { progress: p, msg }));
        pend.forEach((i, k) => set(i, k ? { status: 'done', merged: true } : { status: 'done', result: r }));
      } catch (e) {
        pend.forEach(i => set(i, { status: 'error', msg: (e && e.message) || 'Error' }));
      }
    } else {
      for (const it of pend) {
        set(it, { status: 'working', progress: 0, msg: 'Preparando…' });
        try {
          const r = await mode.run(it.file, o, (p, msg) => set(it, { progress: p, msg }), it);
          set(it, { status: 'done', result: r });
        } catch (e) {
          console.error(e);
          set(it, { status: 'error', msg: (e && e.message) || 'Error al convertir' });
        }
      }
    }
    setBusy(false);
  }
  const results = items.filter(i => i.status === 'done' && i.result).map(i => i.result);
  async function dl(r) { (await import('../lib/engine')).downloadBlob(r.blob, r.name); }
  async function zipAll() { const e = await import('../lib/engine'); e.downloadBlob(await e.zipResults(results), 'conversiones.zip'); }
  function clear() {
    queues.current[mi] = items.filter(i => { const keep = i.status === 'pending' || i.status === 'working'; if (!keep && i.thumb) URL.revokeObjectURL(i.thumb); return keep; });
    bump();
  }
  function remove(it) { queues.current[mi] = items.filter(i => i !== it); if (it.thumb) URL.revokeObjectURL(it.thumb); bump(); }

  return (
    <main className="relative mx-auto max-w-3xl px-5 pb-20 pt-10">
      <div className={'pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b opacity-25 blur-3xl ' + accent.grad} />
      <Link href="/" className="text-sm text-white/50 transition hover:text-white">← Todas las herramientas</Link>

      <div className="mt-6 flex items-center gap-4">
        <ToolIcon id={id} className="h-14 w-14" />
        <div className="min-w-0">
          {modes.length > 1 ? (
            <h1 className="font-display flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
              <span className={'transition-all duration-200 ' + (fade ? 'translate-y-1 opacity-0' : 'opacity-100')}>{mode.from}</span>
              <button type="button" onClick={swap} disabled={busy} title="Cambiar el sentido de la conversión"
                className={'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-black shadow-lg transition hover:scale-110 active:scale-95 disabled:opacity-50 ' + accent.grad}>
                <SwapArrows spin={spin} className="h-[18px] w-[18px]" />
              </button>
              <span className={'transition-all duration-200 ' + (fade ? 'translate-y-1 opacity-0' : 'opacity-100')}>{mode.to}</span>
            </h1>
          ) : (
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{mode.title}</h1>
          )}
          <p className={'mt-1 text-sm text-white/55 transition-opacity duration-200 ' + (fade ? 'opacity-0' : 'opacity-100')}>{mode.subtitle}</p>
        </div>
      </div>

      <div className={'mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-5 transition-opacity duration-200 sm:p-6 ' + (fade ? 'opacity-40' : 'opacity-100')}>
        {mode.fields.length > 0 && <Fields fields={mode.fields} opts={opts} setOpt={setOpt} accent={accent} />}

        <div role="button" tabIndex={0}
          onClick={() => input.current && input.current.click()}
          onKeyDown={e => { if (e.key === 'Enter' && input.current) input.current.click(); }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          className={'flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-9 text-center transition ' + (mode.fields.length ? 'mt-5 ' : '') +
            (drag ? 'scale-[1.01] bg-white/[.07] ' + accent.border : 'border-white/15 hover:bg-white/[.04] ' + accent.hoverBorder)}>
          <ToolIcon id={id} className="h-12 w-12" />
          <p className="mt-3 font-semibold">{mode.drop}</p>
          <p className="mt-1 text-xs text-white/45">o haz clic para elegirlos · puedes seleccionar varios</p>
          <input ref={input} type="file" accept={mode.accept} multiple hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
        </div>

        {items.length > 0 && (
          <ul className="mt-5 space-y-2.5">
            {items.map(it => (
              <li key={it.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-3.5">
                <div className="flex items-center gap-3">
                  {it.thumb
                    ? <img src={it.status === 'done' && it.result && /^image\//.test(it.result.blob.type) ? (it.resUrl ||= URL.createObjectURL(it.result.blob)) : it.thumb} alt="" className="h-11 w-11 shrink-0 rounded-xl object-contain [background:repeating-conic-gradient(#ffffff14_0_25%,transparent_0_50%)_0_0/12px_12px]" />
                    : <ToolIcon id={id} className="h-10 w-10" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{it.file.name}</div>
                    <div className="text-xs text-white/45">{fmt(it.file.size)}{it.cuts && it.cuts.length ? ' · ' + it.cuts.length + ' corte(s)' : ''}</div>
                  </div>
                  <span className={'max-w-[45%] truncate text-right text-xs ' + ({ pending: 'text-white/45', working: accent.text, done: 'text-emerald-300', error: 'text-rose-300' })[it.status]}>
                    {({ pending: 'En cola', working: it.msg || 'Procesando…', done: 'Listo', error: 'Error' })[it.status]}
                  </span>
                  {it.status !== 'working' && <button type="button" onClick={() => remove(it)} className="rounded-lg px-1.5 text-white/35 hover:text-white" title="Quitar">✕</button>}
                </div>
                {it.status === 'pending' && mode.itemExtra && mode.itemExtra(it, opts)}
                {it.status === 'working' && (
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={'h-full rounded-full bg-gradient-to-r transition-all ' + accent.grad} style={{ width: it.progress + '%' }} />
                  </div>
                )}
                {it.status === 'error' && <p className="mt-2 text-xs text-rose-300">{it.msg}</p>}
                {it.status === 'done' && it.merged && <p className="mt-2 text-xs text-white/50">Incluido en el archivo unido (descárgalo desde el primero).</p>}
                {it.status === 'done' && it.result && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => dl(it.result)} className={'rounded-xl bg-gradient-to-r px-3.5 py-1.5 text-sm font-semibold text-black ' + accent.grad}>
                      Descargar {it.result.name.split('.').pop().toUpperCase()} · {fmt(it.result.blob.size)}
                    </button>
                    {it.result.warn && <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-xs text-amber-200">supera 100 KB: WhatsApp podría rechazarlo</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {results.length > 1 && <button type="button" onClick={zipAll} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5">Descargar todo (.zip)</button>}
          {packAction && results.length > 0 && <button type="button" onClick={() => packAction(results, opts)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5">Descargar pack de WhatsApp</button>}
          {items.some(i => i.status === 'done' || i.status === 'error') && <button type="button" onClick={clear} className="rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/5">Limpiar</button>}
          <button type="button" disabled={!items.some(i => i.status === 'pending') || busy} onClick={runAll}
            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition enabled:hover:bg-white/90 disabled:opacity-40">
            {busy ? 'Convirtiendo…' : 'Convertir todo'}
          </button>
        </div>
      </div>
      {mode.note && <p className="mt-4 text-center text-xs text-white/40">{mode.note}</p>}
    </main>
  );
}
