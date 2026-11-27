import Link from 'next/link';
import { Logo } from './Icon';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0b0a12]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="font-display text-lg font-bold tracking-tight">Conversor<span className="bg-gradient-to-r from-[#8b7bff] to-[#ff6b9a] bg-clip-text text-transparent">ium</span></span>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-white/60">
          <Link href="/#herramientas" className="hidden rounded-lg px-3 py-1.5 transition hover:bg-white/5 hover:text-white sm:block">Herramientas</Link>
          <Link href="/admin" className="ml-1 flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 transition hover:border-white/25 hover:bg-white/5 hover:text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
