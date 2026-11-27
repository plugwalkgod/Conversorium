'use client';
import ToolShell from '../../components/ToolShell';
import { ACCENTS } from '../../components/accents';

const MODES = [
  {
    key: 'epub2pdf', from: 'EPUB', to: 'PDF', title: 'EPUB a PDF',
    subtitle: 'Portada, capítulos, listas, citas e imágenes, listos para leer o imprimir.',
    drop: 'Suelta tus libros .epub', accept: '.epub', test: f => /\.epub$/i.test(f.name),
    defaults: { pageSize: 'a4', fontSize: 11 },
    fields: [
      { key: 'pageSize', label: 'Tamaño de página', type: 'select', options: [['a4', 'A4'], ['a5', 'A5 (compacto)'], ['carta', 'Carta']] },
      { key: 'fontSize', label: 'Tamaño de letra', type: 'select', num: true, options: [[10, 'Pequeña'], [11, 'Normal'], [12.5, 'Grande'], [14, 'Muy grande']] },
    ],
    run: async (file, o, p) => {
      const { convertEpubToPdf } = await import('../../lib/epub');
      const r = await convertEpubToPdf(file, o, p);
      return { blob: r.blob, name: (r.title || file.name.replace(/\.epub$/i, '')).replace(/[\\/:*?"<>|]+/g, '').trim() + '.pdf' };
    },
  },
  {
    key: 'pdf2epub', from: 'PDF', to: 'EPUB', title: 'PDF a EPUB',
    subtitle: 'Saca el texto del PDF y lo convierte en un libro electrónico con capítulos e índice.',
    drop: 'Suelta tus archivos .pdf', accept: '.pdf,application/pdf', test: f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf',
    defaults: {}, fields: [],
    note: 'Funciona con PDF de texto. Los PDF escaneados (fotos de páginas) no tienen texto que extraer.',
    run: async (file, o, p) => (await import('../../lib/pdf2epub')).convertPdfToEpub(file, o, p),
  },
];

export default function EpubTool() {
  return <ToolShell id="epub" accent={ACCENTS.epub} modes={MODES} />;
}
