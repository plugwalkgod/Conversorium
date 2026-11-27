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
          <Link href="/#herramientas" className="rounded-lg px-3 py-1.5 transition hover:bg-white/5 hover:text-white">Herramientas</Link>
          <Link href="/#privacidad" className="hidden rounded-lg px-3 py-1.5 transition hover:bg-white/5 hover:text-white sm:block">Privacidad</Link>
        </nav>
      </div>
    </header>
  );
}
