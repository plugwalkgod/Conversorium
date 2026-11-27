'use client';
import ToolShell from '../../components/ToolShell';
import { ACCENTS } from '../../components/accents';

const MODES = [
  {
    key: 'sticker', from: 'Imagen', to: 'Sticker', title: 'Stickers de WhatsApp',
    subtitle: 'Convierte tus imágenes en stickers de 512×512 px y menos de 100 KB, con o sin fondo.',
    drop: 'Suelta tus imágenes', accept: '.webp,.jpg,.jpeg,.png,image/*', test: f => /^image\//.test(f.type) || /\.(webp|jpe?g|png)$/i.test(f.name), thumb: true,
    defaults: { removeBg: false, fit: 'contain', shape: 'none', outline: false, packName: 'Mi pack', author: '' },
    fields: [
      { key: 'fit', label: 'Ajuste', type: 'select', options: [['contain', 'Entera'], ['cover', 'Rellenar']] },
      { key: 'shape', label: 'Forma', type: 'select', options: [['none', 'Original'], ['round', 'Redondeada'], ['circle', 'Círculo']] },
      { key: 'packName', label: 'Nombre del pack', type: 'text', ph: 'Mi pack' },
      { key: 'author', label: 'Autor', type: 'text', ph: 'Tu nombre' },
      { key: 'removeBg', label: 'Quitar el fondo', type: 'check', hint: 'Con IA, en tu navegador. La primera vez descarga ~45 MB.' },
      { key: 'outline', label: 'Contorno blanco', type: 'check' },
    ],
    run: async (file, o, p) => (await import('../../lib/engine')).stickerFrom(file, o, p),
  },
];

async function pack(results, o) {
  const e = await import('../../lib/engine');
  e.downloadBlob(await e.makeStickerPack(results, o.packName, o.author), (e.safeName(o.packName) || 'pack-stickers') + '.zip');
}

export default function StickerTool() {
  return <ToolShell id="sticker" accent={ACCENTS.sticker} modes={MODES} packAction={pack} />;
}
