import Link from 'next/link';
import UrlTool from './UrlTool';
import { getConfig } from '../../lib/config';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Descargar desde URL', robots: { index: false } };

export default async function Page() {
  const cfg = await getConfig();
  if (!cfg.tools.url.visible) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-5 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Herramienta desactivada</h1>
          <p className="mt-2 text-sm text-white/55">Esta herramienta no está disponible ahora mismo.</p>
          <Link href="/" className="mt-6 inline-block rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black">Volver al inicio</Link>
        </div>
      </main>
    );
  }
  return <UrlTool />;
}
