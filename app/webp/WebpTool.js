'use client';
import ToolShell from '../../components/ToolShell';
import { ACCENTS } from '../../components/accents';

const MODES = [
  {
    key: 'fromwebp', from: 'WebP', to: 'PNG, JPG', title: 'WebP a imagen o vídeo',
    subtitle: 'Pasa tus WebP a PNG o JPG, y los WebP animados a vídeo.',
    drop: 'Suelta tus archivos .webp', accept: '.webp,image/webp', test: f => /\.webp$/i.test(f.name) || f.type === 'image/webp', thumb: true,
    defaults: { target: 'png', loops: 1 },
    fields: [
      { key: 'target', label: 'Convertir a', type: 'select', options: [['png', 'PNG (imagen)'], ['jpg', 'JPG (imagen)'], ['video', 'Vídeo (WebP animado)']] },
      { key: 'loops', label: 'Repeticiones', type: 'select', num: true, when: o => o.target === 'video', options: [[1, '1 vez'], [2, '2 veces'], [3, '3 veces'], [5, '5 veces']] },
    ],
    run: async (file, o, p) => (await import('../../lib/engine')).convertWebp(file, o, p),
  },
  {
    key: 'towebp', from: 'PNG, JPG', to: 'WebP', title: 'Imagen a WebP',
    subtitle: 'Convierte PNG, JPG y otras imágenes a WebP, más ligero y con la misma calidad.',
    drop: 'Suelta tus imágenes', accept: 'image/png,image/jpeg,image/gif,image/bmp,image/avif,.png,.jpg,.jpeg,.gif,.bmp,.avif',
    test: f => /^image\//.test(f.type) && !/webp/.test(f.type), thumb: true,
    defaults: { quality: 85 },
    fields: [{ key: 'quality', label: 'Calidad', type: 'select', num: true, options: [[95, 'Máxima (95 %)'], [85, 'Alta (85 %)'], [75, 'Media (75 %)'], [60, 'Ligera (60 %)']] }],
    run: async (file, o, p) => (await import('../../lib/engine')).imageToWebp(file, o, p),
  },
];

export default function WebpTool() {
  return <ToolShell id="webp" accent={ACCENTS.webp} modes={MODES} />;
}
