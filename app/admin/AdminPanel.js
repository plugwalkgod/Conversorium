'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ToolIcon } from '../../components/Icon';

const TOOL_IDS = ['epub', 'webp', 'webm', 'bg', 'sticker', 'url'];
const input = 'mt-1.5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-400';
const label = 'block text-xs font-semibold uppercase tracking-wider text-violet-300';

function Field({ name, value, onChange, area }) {
  return (
    <label className={label}>{name}
      {area
        ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} className={input + ' normal-case tracking-normal'} />
        : <input value={value} onChange={e => onChange(e.target.value)} className={input + ' normal-case tracking-normal'} />}
    </label>
  );
}

function Toggle({ on, onChange, text }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2.5 text-sm text-white/80">
      <span className={'relative h-6 w-11 rounded-full transition ' + (on ? 'bg-emerald-500' : 'bg-white/15')}>
        <span className={'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ' + (on ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {text}
    </button>
  );
}

function ImagePicker({ url, onChange, fallback }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function upload(file) {
    if (!file) return;
    setBusy(true); setErr('');
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setErr(j.error || 'Error al subir'); else onChange(j.url);
  }
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : fallback}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5">
          {busy ? 'Subiendo…' : 'Cambiar imagen'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden onChange={e => { upload(e.target.files[0]); e.target.value = ''; }} />
        </label>
        {url && <button type="button" onClick={() => onChange('')} className="rounded-lg px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">Quitar</button>}
      </div>
      {err && <p className="text-xs text-rose-300">{err}</p>}
    </div>
  );
}

export default function AdminPanel() {
  const [state, setState] = useState('loading');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [cfg, setCfg] = useState(null);
  const [storage, setStorage] = useState(true);
  const [saved, setSaved] = useState('');
  const [dirty, setDirty] = useState(false);

  async function load() {
    const r = await fetch('/api/admin/config', { cache: 'no-store' });
    if (r.status === 401) return setState('login');
    const j = await r.json();
    setCfg(j.config); setStorage(j.storage); setState('ready'); setDirty(false);
  }
  useEffect(() => { load(); }, []);

  async function login(e) {
    e.preventDefault(); setErr('');
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || 'No se pudo entrar');
    setPw(''); load();
  }
  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' });
    setCfg(null); setState('login');
  }
  async function save() {
    setSaved('Guardando…');
    const r = await fetch('/api/admin/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setSaved(j.error || 'Error al guardar');
    setCfg(j.config); setDirty(false); setSaved('Guardado. Los cambios ya se ven en la web.');
    setTimeout(() => setSaved(''), 4000);
  }
  const setSite = (k, v) => { setCfg(c => ({ ...c, site: { ...c.site, [k]: v } })); setDirty(true); };
  const setTool = (id, k, v) => { setCfg(c => ({ ...c, tools: { ...c.tools, [id]: { ...c.tools[id], [k]: v } } })); setDirty(true); };

  if (state === 'loading') return <main className="grid min-h-[70vh] place-items-center text-white/50">Cargando…</main>;

  if (state === 'login') return (
    <main className="grid min-h-[75vh] place-items-center px-5">
      <form onSubmit={login} className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[.03] p-7">
        <h1 className="font-display text-2xl font-bold">Administración</h1>
        <p className="mt-1 text-sm text-white/55">Introduce la contraseña para editar la web.</p>
        <input type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="Contraseña" className={input + ' mt-5'} />
        {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
        <button className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black hover:bg-white/90">Entrar</button>
      </form>
    </main>
  );

  return (
    <main className="mx-auto max-w-4xl px-5 pb-32 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Administración</h1>
          <p className="mt-1 text-sm text-white/55">Cambia lo que se ve en la web. Pulsa Guardar para publicarlo.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" target="_blank" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/5">Ver la web ↗</Link>
          <button onClick={logout} className="rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/5">Salir</button>
        </div>
      </div>

      {!storage && <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">El almacenamiento (Vercel Blob) no está conectado: puedes ver el panel, pero no guardar cambios.</p>}

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[.03] p-6">
        <h2 className="font-display text-lg font-bold">Portada</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field name="Etiqueta superior" value={cfg.site.badge} onChange={v => setSite('badge', v)} />
          <Field name="Título" value={cfg.site.heroTitle} onChange={v => setSite('heroTitle', v)} />
          <Field name="Título destacado (en color)" value={cfg.site.heroHighlight} onChange={v => setSite('heroHighlight', v)} />
          <Field name="Pie de página" value={cfg.site.footer} onChange={v => setSite('footer', v)} />
          <div className="sm:col-span-2"><Field area name="Texto bajo el título" value={cfg.site.heroText} onChange={v => setSite('heroText', v)} /></div>
          <div className="sm:col-span-2">
            <div className={label}>Imagen de portada (opcional)</div>
            <div className="mt-2"><ImagePicker url={cfg.site.heroImage} onChange={v => setSite('heroImage', v)} fallback={<span className="text-xs text-white/30">—</span>} /></div>
          </div>
          <Toggle on={cfg.site.showPrivacy} onChange={v => setSite('showPrivacy', v)} text="Mostrar la sección de privacidad" />
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-6">
        <h2 className="font-display text-lg font-bold">Herramientas</h2>
        <div className="mt-5 space-y-4">
          {TOOL_IDS.map(id => {
            const t = cfg.tools[id];
            return (
              <div key={id} className={'rounded-2xl border border-white/10 p-5 transition ' + (t.visible ? 'bg-black/20' : 'bg-black/40 opacity-60')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ImagePicker url={t.image} onChange={v => setTool(id, 'image', v)} fallback={<ToolIcon id={id} className="h-10 w-10" />} />
                  <Toggle on={t.visible} onChange={v => setTool(id, 'visible', v)} text={t.visible ? 'Visible' : 'Oculta'} />
                </div>
                {id === 'url' && <p className="mt-3 text-xs text-white/45">Necesita que <code>servidor.py</code> esté encendido en el ordenador de quien la use (yt-dlp y ffmpeg). Desactivada por defecto.</p>}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field name="Nombre" value={t.title} onChange={v => setTool(id, 'title', v)} />
                  <Field name="Descripción" value={t.desc} onChange={v => setTool(id, 'desc', v)} />
                  {'descRev' in t && <div className="sm:col-span-2"><Field name="Descripción al girar la rueda" value={t.descRev} onChange={v => setTool(id, 'descRev', v)} /></div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0a12]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
          <span className="text-sm text-white/60">{saved || (dirty ? 'Tienes cambios sin guardar' : 'Todo guardado')}</span>
          <div className="flex gap-2">
            <button disabled={!dirty} onClick={load} className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-40">Descartar</button>
            <button disabled={!dirty || !storage} onClick={save} className="rounded-xl bg-gradient-to-r from-[#8b7bff] to-[#ff6b9a] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">Guardar</button>
          </div>
        </div>
      </div>
    </main>
  );
}
