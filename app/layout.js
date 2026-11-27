import { Inter, Space_Grotesk } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-grotesk', weight: ['500', '700'] });

export const metadata = {
  title: { default: 'Conversorium · Conversor de archivos', template: '%s · Conversorium' },
  description: 'Convierte EPUB a PDF, WebP, audio, vídeo y stickers de WhatsApp gratis y sin subir tus archivos.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={inter.variable + ' ' + grotesk.variable}>
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
