'use client';
import ToolShell from '../../components/ToolShell';
import { ACCENTS } from '../../components/accents';

const MODES = [
  {
    key: 'pdf2docx', from: 'PDF', to: 'Word', title: 'PDF a Word',
    subtitle: 'Saca el texto del PDF y lo convierte en un documento de Word editable, con títulos y párrafos.',
    drop: 'Suelta tus archivos .pdf', accept: '.pdf,application/pdf', test: f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf',
    defaults: { keepPages: true, pageSize: 'a4' },
    fields: [
      { key: 'pageSize', label: 'Tamaño de página', type: 'select', options: [['a4', 'A4'], ['carta', 'Carta']] },
      { key: 'keepPages', label: 'Respetar los saltos de página del PDF', type: 'check' },
    ],
    note: 'Se conserva el texto, los títulos y los párrafos. Las imágenes y tablas del PDF no se pasan, y los PDF escaneados no tienen texto que extraer.',
    run: async (file, o, p) => (await import('../../lib/word')).pdfToDocx(file, o, p),
  },
  {
    key: 'docx2pdf', from: 'Word', to: 'PDF', title: 'Word a PDF',
    subtitle: 'Convierte tus documentos .docx en PDF con títulos, listas, citas e imágenes.',
    drop: 'Suelta tus archivos .docx', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    test: f => /\.docx$/i.test(f.name),
    defaults: { pageSize: 'a4', fontSize: 11 },
    fields: [
      { key: 'pageSize', label: 'Tamaño de página', type: 'select', options: [['a4', 'A4'], ['a5', 'A5'], ['carta', 'Carta']] },
      { key: 'fontSize', label: 'Tamaño de letra', type: 'select', num: true, options: [[10, 'Pequeña'], [11, 'Normal'], [12.5, 'Grande']] },
    ],
    note: 'Solo .docx (Word 2007 o posterior). Se conservan el contenido y la estructura; el diseño exacto (columnas, márgenes, fuentes) puede variar.',
    run: async (file, o, p) => (await import('../../lib/word')).docxToPdf(file, o, p),
  },
];

export default function WordTool() {
  return <ToolShell id="word" accent={ACCENTS.word} modes={MODES} />;
}
