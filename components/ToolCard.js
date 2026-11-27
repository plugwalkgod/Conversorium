'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ToolIcon } from './Icon';
import { SwapArrows } from './ToolShell';

export default function ToolCard({ t, i }) {
  const [rev, setRev] = useState(0);
  const flipped = rev % 2 === 1;
  const href = t.modes ? t.href + '?modo=' + t.modes[flipped ? 1 : 0] : t.href;
  const swap = e => { e.preventDefault(); e.stopPropagation(); setRev(r => r + 1); };
  const [a, b] = t.pair ? (flipped ? [t.pair[1], t.pair[0]] : t.pair) : [];
  return (
    <Link href={href} style={{ animationDelay: 0.3 + i * 0.07 + 's' }}
      className="animate-rise group relative flex flex-col items-center rounded-3xl border border-white/10 bg-white/[.03] p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.06]">
      <div className={'pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r opacity-0 transition group-hover:opacity-100 ' + t.color} />
      {t.image
        ? <img src={t.image} alt="" className="h-16 w-16 rounded-2xl object-cover shadow-xl transition duration-300 group-hover:-rotate-3 group-hover:scale-110" />
        : <ToolIcon id={t.id} className="h-16 w-16 transition duration-300 group-hover:-rotate-3 group-hover:scale-110" />}
      {t.pair ? (
        <h2 className="font-display mt-5 flex items-center justify-center gap-2 text-lg font-bold">
          <span key={'a' + rev} className="animate-rise">{a}</span>
          <button type="button" onClick={swap} title="Cambiar el sentido"
            className={'grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-black shadow-md transition hover:scale-110 active:scale-95 ' + t.color}>
            <SwapArrows spin={rev} className="h-4 w-4" />
          </button>
          <span key={'b' + rev} className="animate-rise">{b}</span>
        </h2>
      ) : (
        <h2 className="font-display mt-5 text-lg font-bold">{t.title}</h2>
      )}
      <p className="mt-2 text-sm leading-relaxed text-white/55">{t.pair ? (flipped ? t.descRev || t.desc : t.desc) : t.desc}</p>
      <span className="mt-5 text-sm font-semibold text-white/80 transition group-hover:text-white">Abrir →</span>
    </Link>
  );
}
