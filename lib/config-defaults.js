export const DEFAULT_CONFIG = {
  site: {
    badge: 'Sin subir nada · 100 % en tu navegador',
    heroTitle: 'Convierte tus archivos',
    heroHighlight: 'sin que salgan de tu equipo',
    heroText: 'Libros, imágenes, audio, vídeo y stickers. Elige una herramienta, suelta tus archivos y listo.',
    heroImage: '',
    footer: '© 2026 Conversorium · Gratis y privado · Tus archivos no salen de tu dispositivo',
    showPrivacy: true,
  },
  tools: {
    epub: { visible: true, title: 'EPUB ⇄ PDF', desc: 'Pasa tus libros electrónicos a PDF, o convierte un PDF en un EPUB con capítulos e índice.', image: '' },
    webp: { visible: true, title: 'WebP ⇄ Imagen', desc: 'Convierte WebP a PNG, JPG o vídeo, y tus imágenes a WebP más ligero.', image: '' },
    webm: { visible: true, title: 'Audio y vídeo', desc: 'Extrae MP3 o WAV, recórtalo con el editor, convierte a MP4 o crea vídeos a partir de audio.', image: '' },
    sticker: { visible: true, title: 'Stickers de WhatsApp', desc: 'Crea stickers de 512×512, quita el fondo con IA y descarga packs listos para importar.', image: '' },
  },
};

export function mergeConfig(saved) {
  const c = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  if (!saved || typeof saved !== 'object') return c;
  if (saved.site && typeof saved.site === 'object') {
    for (const k of Object.keys(c.site)) if (k in saved.site && typeof saved.site[k] === typeof c.site[k]) c.site[k] = saved.site[k];
  }
  if (saved.tools && typeof saved.tools === 'object') {
    for (const id of Object.keys(c.tools)) {
      const s = saved.tools[id]; if (!s || typeof s !== 'object') continue;
      for (const k of Object.keys(c.tools[id])) if (k in s && typeof s[k] === typeof c.tools[id][k]) c.tools[id][k] = s[k];
    }
  }
  return c;
}
