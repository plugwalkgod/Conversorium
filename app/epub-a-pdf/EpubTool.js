'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { ToolIcon } from '../../components/Icon';

const fmt = b => (b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
let uid = 0;

export default function EpubTool() {
  const [items, setItems] = useState([]);
  const [opts, setOpts] = useState({ pageSize: 'a4', fontSize: 11 });
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const patch = (id, p) => setItems(list => list.map(i => (i.id === id ? { ...i, ...p } : i)));
  const add = files => {
    const ok = Array.from(files).filter(f => /\.epub$/i.test(f.name));
    setItems(list => [...list, ...ok.map(file => ({ id: ++uid, file, status: 'pending', progress: 0, msg: '' }))]);
  };

  async function runAll() {
    setBusy(true);
    const { convertEpubToPdf } = await import('../../lib/epub');
    for (const it of items.filter(i => i.status === 'pending')) {
      patch(it.id, { status: 'working' });
      try {
        const r = await convertEpubToPdf(it.file, opts, (p, msg) => patch(it.id, { progress: p, msg }));
        const name = (r.title || it.file.name.replace(/\.epub$/i, '')).replace(/[\\/:*?"<>|]+/g, '').trim() + '.pdf';
        patch(it.id, { status: 'done', blob: r.blob, name });
      } catch (e) {
        patch(it.id, { status: 'error', msg: (e && e.message) || 'Error al convertir' });
      }
    }
    setBusy(false);
  }

  const download = it => {
    const url = URL.createObjectURL(it.blob);
    const a = document.createElement('a'); a.href = url; a.download = it.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const pending = items.some(i => i.status === 'pending');

  return (
    <main className="relative mx-auto max-w-3xl px-5 py-12">
      <div className="glow pointer-events-none absolute inset-0 -z-10" />
      <Link href="/" className="text-sm text-white/50 transition hover:text-white">← Todas las herramientas</Link>

      <div className="mt-6 flex items-center gap-4">
        <ToolIcon id="epub" className="h-14 w-14" />
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">EPUB a PDF</h1>
          <p className="mt-1 text-sm text-white/55">Portada, título, capítulos, listas, citas e imágenes. Sin subir nada.</p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-7">
        <div className="flex flex-wrap gap-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">Tamaño de página
            <select value={opts.pageSize} onChange={e => setOpts({ ...opts, pageSize: e.target.value })}
              className="mt-1.5 block w-40 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white">
              <option value="a4">A4</option><option value="a5">A5 (compacto)</option><option value="carta">Carta</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-300">Tamaño de letra
            <select value={opts.fontSize} onChange={e => setOpts({ ...opts, fontSize: +e.target.value })}
              className="mt-1.5 block w-40 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white">
              <option value={10}>Pequeña</option><option value={11}>Normal</option><option value={12.5}>Grande</option><option value={14}>Muy grande</option>
            </select>
          </label>
        </div>

        <div role="button" tabIndex={0}
          onClick={() => input.current && input.current.click()}
          onKeyDown={e => { if (e.key === 'Enter' && input.current) input.current.click(); }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          className={'mt-6 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ' +
            (drag ? 'scale-[1.01] border-amber-300 bg-amber-300/10' : 'border-white/15 hover:border-amber-300/60 hover:bg-white/[.04]')}>
          <ToolIcon id="epub" className="h-14 w-14" />
          <p className="mt-3 font-semibold">Suelta tus libros .epub</p>
          <p className="mt-1 text-xs text-white/45">o haz clic para elegirlos · puedes seleccionar varios</p>
          <input ref={input} type="file" accept=".epub" multiple hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
        </div>

        {items.length > 0 && (
          <ul className="mt-6 space-y-3">
            {items.map(it => (
              <li key={it.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <div className="flex items-center gap-3">
                  <ToolIcon id="epub" className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{it.file.name}</div>
                    <div className="text-xs text-white/45">{fmt(it.file.size)}</div>
                  </div>
                  <span className={'text-xs ' + ({ pending: 'text-white/45', working: 'text-amber-300', done: 'text-emerald-300', error: 'text-rose-300' })[it.status]}>
                    {({ pending: 'En cola', working: it.msg || 'Procesando…', done: 'Listo', error: 'Error' })[it.status]}
                  </span>
                </div>
                {it.status === 'working' && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 transition-all" style={{ width: it.progress + '%' }} />
                  </div>
                )}
                {it.status === 'error' && <p className="mt-2 text-xs text-rose-300">{it.msg}</p>}
                {it.status === 'done' && (
                  <button onClick={() => download(it)} className="mt-3 rounded-xl bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-2 text-sm font-semibold text-black">
                    Descargar PDF · {fmt(it.blob.size)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {items.length > 0 && <button onClick={() => setItems(l => l.filter(i => i.status === 'pending' || i.status === 'working'))} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/75 hover:bg-white/5">Limpiar</button>}
          <button disabled={!pending || busy} onClick={runAll}
            className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition enabled:hover:bg-white/90 disabled:opacity-40">
            {busy ? 'Convirtiendo…' : 'Convertir todo'}
          </button>
        </div>
      </div>
    </main>
  );
}
