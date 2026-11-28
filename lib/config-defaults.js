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
    epub: { visible: true, title: 'EPUB ⇄ PDF', desc: 'Convierte tus libros electrónicos en PDF con portada, capítulos e imágenes.', descRev: 'Convierte un PDF en un libro electrónico EPUB con capítulos e índice.', image: '' },
    word: { visible: true, title: 'PDF ⇄ Word', desc: 'Convierte tus PDF en documentos de Word editables, con títulos y párrafos.', descRev: 'Pasa tus documentos de Word (.docx) a PDF, con títulos, listas e imágenes.', image: '' },
    webp: { visible: true, title: 'WebP ⇄ PNG, JPG', desc: 'Pasa tus WebP a PNG o JPG, y los WebP animados a vídeo.', descRev: 'Convierte tus PNG y JPG en WebP, más ligero y con la misma calidad.', image: '' },
    webm: { visible: true, title: 'Audio y vídeo', desc: 'Extrae el audio en MP3 o WAV, recórtalo con el editor o convierte el vídeo a MP4.', image: '' },
    bg: { visible: true, title: 'Quitar fondo', desc: 'Elimina el fondo de tus fotos con IA y ajusta el resultado viéndolo al momento.', image: '' },
    url: { visible: false, title: 'Descargar desde URL', desc: 'Descarga vídeo o audio de YouTube y otras webs usando el servidor de tu ordenador.', image: '' },
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
