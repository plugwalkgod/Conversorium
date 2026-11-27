import Link from 'next/link';
import { ToolIcon } from '../components/Icon';
import { TOOLS } from '../components/tools';
import { getConfig } from '../lib/config';

export const dynamic = 'force-dynamic';

const FEATURES = [
  { t: 'Privado de verdad', d: 'Todo ocurre en tu navegador. Tus archivos nunca se suben a un servidor.' },
  { t: 'Gratis y sin registro', d: 'Sin cuentas, sin marcas de agua y sin límites artificiales.' },
  { t: 'Rápido', d: 'Convierte varios archivos a la vez y descárgalos en un clic.' },
];

export default async function Home() {
  const cfg = await getConfig();
  const site = cfg.site;
  const tools = TOOLS.filter(t => cfg.tools[t.id].visible).map(t => ({ ...t, ...cfg.tools[t.id] }));
  return (
    <main className="relative overflow-hidden">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[520px]" />

      <section className="relative mx-auto max-w-4xl px-5 pb-12 pt-20 text-center sm:pt-28">
        <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {site.badge}
        </span>
        <h1 className="animate-rise font-display mt-6 text-4xl font-bold leading-[1.05] tracking-tight [animation-delay:.08s] sm:text-6xl">
          {site.heroTitle}<br />
          <span className="bg-gradient-to-r from-[#8b7bff] via-[#c77dff] to-[#ff6b9a] bg-clip-text text-transparent">{site.heroHighlight}</span>
        </h1>
        <p className="animate-rise mx-auto mt-5 max-w-xl text-base text-white/60 [animation-delay:.16s] sm:text-lg">
          {site.heroText}
        </p>
        <div className="animate-rise mt-8 flex justify-center gap-3 [animation-delay:.24s]">
          <a href="#herramientas" className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90">Empezar</a>
          <a href="#privacidad" className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/5">Cómo funciona</a>
        </div>
        {site.heroImage && <img src={site.heroImage} alt="" className="animate-rise mx-auto mt-12 max-h-80 rounded-3xl border border-white/10 object-cover shadow-2xl [animation-delay:.3s]" />}
      </section>

      <section id="herramientas" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 pb-20">
        <div className={'grid gap-4 sm:grid-cols-2 ' + (tools.length >= 4 ? 'lg:grid-cols-4' : tools.length === 3 ? 'lg:grid-cols-3' : '')}>
          {tools.map((t, i) => (
            <Link key={t.id} href={t.href} style={{ animationDelay: 0.3 + i * 0.07 + 's' }}
              className="animate-rise group relative flex flex-col items-center rounded-3xl border border-white/10 bg-white/[.03] p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.06]">
              <div className={'pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r opacity-0 transition group-hover:opacity-100 ' + t.color} />
              {t.image
                ? <img src={t.image} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-xl transition duration-300 group-hover:-rotate-3 group-hover:scale-110" />
                : <ToolIcon id={t.id} className="h-16 w-16 transition duration-300 group-hover:-rotate-3 group-hover:scale-110" />}
              {t.pair && (
                <span className="cv-swap mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] font-semibold text-white/75">
                  <span className="l inline-block w-14 text-center">{t.pair[0]}</span>
                  <svg viewBox="0 0 24 24" className="a h-4 w-4 text-white/60" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9" /><path d="M5 2.5v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9" /><path d="M19 21.5v-4h-4" /></svg>
                  <span className="r inline-block w-14 text-center">{t.pair[1]}</span>
                </span>
              )}
              <h2 className={'font-display text-lg font-bold ' + (t.pair ? 'mt-3' : 'mt-5')}>{t.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{t.desc}</p>
              <span className="mt-5 text-sm font-semibold text-white/80 transition group-hover:text-white">Abrir →</span>
            </Link>
          ))}
        </div>
      </section>

      {site.showPrivacy && <section id="privacidad" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 pb-24">
        <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/[.02] p-6 sm:grid-cols-3 sm:p-8">
          {FEATURES.map(f => (
            <div key={f.t}>
              <h3 className="font-display font-bold">{f.t}</h3>
              <p className="mt-1.5 text-sm text-white/55">{f.d}</p>
            </div>
          ))}
        </div>
      </section>}
    </main>
  );
}
