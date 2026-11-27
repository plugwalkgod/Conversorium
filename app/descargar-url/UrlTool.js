'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ToolIcon } from '../../components/Icon';
import { ACCENTS } from '../../components/accents';

const A = ACCENTS.url;
const API = 'http://localhost:8765';
const QUALITIES = [['best', 'Mejor disponible'], ['2160', '2160p (4K)'], ['1440', '1440p'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p']];
const fmtDur = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

function Sel({ label, value, onChange, options }) {
  return (
    <label className="block min-w-0">
      <span className={'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider ' + A.text}>{label}</span>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} className={'w-full appearance-none rounded-xl border border-white/10 bg-black/40 py-2 pl-3 pr-9 text-sm text-white outline-none focus:ring-2 ' + A.ring}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </label>
  );
}

export default function UrlTool() {
  const [srv, setSrv] = useState(null);
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [mode, setMode] = useState('video');
  const [quality, setQuality] = useState('best');
  const [vfmt, setVfmt] = useState('mp4');
  const [afmt, setAfmt] = useState('mp3');
  const [job, setJob] = useState(null);

  async function check() {
    try { const r = await fetch(API + '/api/status', { cache: 'no-store' }); setSrv(r.ok ? await r.json() : false); }
    catch (e) { setSrv(false); }
  }
  useEffect(() => { check(); }, []);

  const valid = /^https?:\/\//i.test(url.trim());

  async function analyze() {
    if (!valid) return setErr('Pega un enlace que empiece por http o https.');
    setErr(''); setInfo(null); setBusy('info');
    try {
      const r = await fetch(API + '/api/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'No se pudo analizar el enlace');
      setInfo(j);
    } catch (e) { setErr(e.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor local.' : e.message); }
    setBusy('');
  }

  async function download() {
    if (!valid) return setErr('Pega un enlace que empiece por http o https.');
    setErr(''); setBusy('dl'); setJob({ percent: 0, message: 'Enviando…' });
    try {
      const r = await fetch(API + '/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), mode, quality, format: mode === 'video' ? vfmt : afmt }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Error del servidor');
      for (;;) {
        await new Promise(res => setTimeout(res, 800));
        const s = await (await fetch(API + '/api/job/' + j.id, { cache: 'no-store' })).json();
        if (s.status === 'error') throw new Error(s.error || 'Error en el servidor');
        setJob({ percent: s.percent || 0, message: s.message || '' });
        if (s.status === 'done') {
          const a = document.createElement('a'); a.href = API + '/api/file/' + j.id; a.download = s.name || 'descarga';
          document.body.appendChild(a); a.click(); a.remove();
          setJob({ done: true, name: s.name });
          break;
        }
      }
    } catch (e) { setJob(null); setErr(e.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor local.' : e.message); }
    setBusy('');
  }

  return (
    <main className="relative mx-auto max-w-3xl px-5 pb-20 pt-10">
      <div className={'pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b opacity-25 blur-3xl ' + A.grad} />
      <Link href="/" className="text-sm text-white/50 transition hover:text-white">← Todas las herramientas</Link>
      <div className="mt-6 flex items-center gap-4">
        <ToolIcon id="url" className="h-14 w-14" />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Descargar desde URL</h1>
          <p className="mt-1 text-sm text-white/55">Vídeo o audio de YouTube y otras webs, con yt-dlp en tu propio ordenador.</p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-6">
        {srv === false && (
          <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="font-semibold">No encuentro el servidor en tu ordenador</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-100/80">
              <li>Instala Python 3, ffmpeg y yt-dlp (<code>pip install -U yt-dlp</code>).</li>
              <li>Ejecuta <code>python servidor.py</code> (está en el repositorio de GitHub).</li>
              <li>Si el navegador pregunta si permites acceder a la red local, acepta.</li>
            </ol>
            <button type="button" onClick={check} className="mt-3 rounded-lg border border-amber-200/30 px-3 py-1.5 text-xs font-semibold hover:bg-amber-200/10">Reintentar</button>
          </div>
        )}
        {srv && <p className="mb-4 text-xs text-emerald-300">● Servidor conectado · yt-dlp {srv.ytdlp || '?'}{srv.ffmpeg ? ' · ffmpeg' : ' · sin ffmpeg'}</p>}

        <div className="flex gap-2">
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') analyze(); }} placeholder="https://…"
            className={'min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 ' + A.ring} />
          <button type="button" onClick={analyze} disabled={!!busy} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/5 disabled:opacity-40">
            {busy === 'info' ? 'Analizando…' : 'Analizar'}
          </button>
        </div>

        {info && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            {info.thumbnail && <img src={info.thumbnail} referrerPolicy="no-referrer" alt="" className="h-20 w-36 shrink-0 rounded-xl object-cover" />}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold">{info.title}</p>
              <p className="mt-1 text-xs text-white/50">{[info.uploader, info.duration ? fmtDur(info.duration) : '', info.heights && info.heights.length ? 'hasta ' + info.heights[0] + 'p' : ''].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Sel label="Tipo" value={mode} onChange={setMode} options={[['video', 'Vídeo'], ['audio', 'Solo audio']]} />
          {mode === 'video'
            ? <Sel label="Calidad" value={quality} onChange={setQuality} options={QUALITIES} />
            : <Sel label="Formato" value={afmt} onChange={setAfmt} options={[['mp3', 'MP3'], ['m4a', 'M4A'], ['wav', 'WAV'], ['opus', 'Opus']]} />}
          {mode === 'video' && <Sel label="Formato" value={vfmt} onChange={setVfmt} options={[['mp4', 'MP4'], ['webm', 'WebM']]} />}
        </div>

        {err && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{err}</p>}
        {job && !job.done && (
          <div className="mt-4">
            <div className="flex justify-between text-xs"><span className={A.text}>{job.message}</span><span className="text-white/50">{job.percent}%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={'h-full rounded-full bg-gradient-to-r transition-all ' + A.grad} style={{ width: job.percent + '%' }} /></div>
          </div>
        )}
        {job && job.done && <p className="mt-4 text-sm text-emerald-300">✓ Descargado: {job.name}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-xs text-white/40">Descarga solo contenido tuyo, libre o con permiso. Respeta las condiciones de cada sitio.</p>
          <button type="button" onClick={download} disabled={!!busy || !srv} className={'rounded-xl bg-gradient-to-r px-5 py-2 text-sm font-semibold text-black disabled:opacity-40 ' + A.grad}>
            {busy === 'dl' ? 'Descargando…' : 'Descargar'}
          </button>
        </div>
      </div>
    </main>
  );
}
