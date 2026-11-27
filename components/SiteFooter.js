import { getConfig } from '../lib/config';

export default async function SiteFooter() {
  const cfg = await getConfig();
  return (
    <footer className="border-t border-white/5 py-8 text-center text-xs text-white/35">{cfg.site.footer}</footer>
  );
}
