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
    epub: { visible: true, title: 'EPUB a PDF', desc: 'Convierte libros electrónicos a PDF con portada, capítulos e imágenes.', image: '' },
    webp: { visible: true, title: 'WebP a imagen o vídeo', desc: 'Pasa WebP a PNG o JPG, y los WebP animados a vídeo.', image: '' },
    webm: { visible: true, title: 'Audio y vídeo', desc: 'Extrae MP3 o WAV, recorta con el editor y convierte a MP4.', image: '' },
    sticker: { visible: true, title: 'Stickers de WhatsApp', desc: 'Crea stickers de 512×512 y packs listos para importar.', image: '' },
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
