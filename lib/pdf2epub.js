// PDF → EPUB en el navegador: extrae el texto con pdf.js y monta un EPUB 3 con JSZip.
import JSZip from 'jszip';

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';
let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import(/* webpackIgnore: true */ PDFJS + 'pdf.min.mjs');
      // El worker vive en otro dominio: lo envolvemos en un blob para poder crearlo.
      const src = URL.createObjectURL(new Blob(["import '" + PDFJS + "pdf.worker.min.mjs';"], { type: 'text/javascript' }));
      lib.GlobalWorkerOptions.workerPort = new Worker(src, { type: 'module' });
      return lib;
    })();
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

const xml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Agrupa los fragmentos de texto de una página en párrafos y títulos.
function pageToBlocks(items, bodySize) {
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (!('str' in it)) continue;
    const y = it.transform[5], x = it.transform[4], size = Math.abs(it.transform[3]) || it.height || 10;
    if (cur && Math.abs(cur.y - y) < size * 0.5) {
      const gap = x - cur.endX;
      cur.text += (gap > size * 0.15 && !cur.text.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str;
      cur.endX = x + (it.width || 0);
      cur.size = Math.max(cur.size, size);
    } else {
      if (cur) lines.push(cur);
      cur = { y, text: it.str, endX: x + (it.width || 0), size };
    }
    if (it.hasEOL && cur) { lines.push(cur); cur = null; }
  }
  if (cur) lines.push(cur);

  const blocks = [];
  let para = null, prevY = null;
  for (const ln of lines) {
    const t = ln.text.replace(/\s+/g, ' ').trim();
    if (!t) { para = null; prevY = null; continue; }
    if (/^\d{1,4}$/.test(t)) continue; // números de página sueltos
    const isHeading = ln.size > bodySize * 1.25 && t.length < 120;
    const bigGap = prevY != null && Math.abs(prevY - ln.y) > ln.size * 1.8;
    if (isHeading) {
      blocks.push({ type: ln.size > bodySize * 1.6 ? 'h1' : 'h2', text: t });
      para = null;
    } else if (!para || bigGap) {
      para = { type: 'p', text: t };
      blocks.push(para);
    } else {
      para.text = para.text.endsWith('-') ? para.text.slice(0, -1) + t : para.text + ' ' + t;
    }
    prevY = ln.y;
  }
  return blocks;
}

// Lee el PDF y devuelve título, autor y los bloques de texto de cada página.
export async function extractPdf(file, onProgress) {
  onProgress(3, 'Cargando lector de PDF…');
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let title = file.name.replace(/\.pdf$/i, '');
  let author = '';
  try {
    const meta = await doc.getMetadata();
    if (meta.info && meta.info.Title && meta.info.Title.trim()) title = meta.info.Title.trim();
    if (meta.info && meta.info.Author) author = meta.info.Author.trim();
  } catch (e) {}

  // Primera pasada: tamaño de letra más habitual (cuerpo del texto).
  const pages = [];
  const sizes = {};
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items);
    for (const it of tc.items) if (it.str && it.str.trim()) { const s = Math.round(Math.abs(it.transform[3])); sizes[s] = (sizes[s] || 0) + it.str.length; }
    onProgress(5 + Math.round(i / doc.numPages * 60), 'Leyendo página ' + i + ' de ' + doc.numPages + '…');
  }
  const bodySize = +Object.entries(sizes).sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
  const perPage = pages.map(items => pageToBlocks(items, bodySize));
  if (!perPage.flat().some(b => b.text.length > 3)) throw new Error('Este PDF no tiene texto seleccionable (parece escaneado), así que no se puede convertir.');
  return { title, author, perPage };
}

export async function convertPdfToEpub(file, opts, onProgress) {
  const { title, author, perPage } = await extractPdf(file, onProgress);
  const all = perPage.flat();

  // Capítulos: se corta en cada título grande, o cada ~25 párrafos si no hay títulos.
  const chapters = [];
  let ch = null;
  for (const b of all) {
    if (b.type === 'h1' || !ch || (!all.some(x => x.type === 'h1') && ch.blocks.length >= 25)) {
      ch = { title: b.type === 'h1' ? b.text : 'Parte ' + (chapters.length + 1), blocks: [] };
      chapters.push(ch);
      if (b.type === 'h1') continue;
    }
    ch.blocks.push(b);
  }

  onProgress(75, 'Creando el EPUB…');
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/style.css', 'body{font-family:serif;line-height:1.5;margin:5%}h1{font-size:1.6em;margin:1.2em 0 .6em}h2{font-size:1.25em;margin:1em 0 .5em}p{text-indent:1.2em;margin:0 0 .4em;text-align:justify}');
  const id = 'urn:uuid:' + (crypto.randomUUID ? crypto.randomUUID() : Date.now());
  const manifest = [], spine = [], nav = [];
  chapters.forEach((c, i) => {
    const name = 'cap' + (i + 1) + '.xhtml';
    const body = c.blocks.map(b => '<' + b.type + '>' + xml(b.text) + '</' + b.type + '>').join('\n');
    zip.file('OEBPS/' + name, '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="es"><head><meta charset="utf-8"/><title>' + xml(c.title) + '</title><link rel="stylesheet" href="style.css"/></head><body><h1>' + xml(c.title) + '</h1>\n' + body + '</body></html>');
    manifest.push('<item id="c' + (i + 1) + '" href="' + name + '" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="c' + (i + 1) + '"/>');
    nav.push('<li><a href="' + name + '">' + xml(c.title) + '</a></li>');
  });
  zip.file('OEBPS/nav.xhtml', '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es"><head><meta charset="utf-8"/><title>Índice</title></head><body><nav epub:type="toc"><h1>Índice</h1><ol>' + nav.join('') + '</ol></nav></body></html>');
  zip.file('OEBPS/content.opf', '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="es"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">' + id + '</dc:identifier><dc:title>' + xml(title) + '</dc:title>' + (author ? '<dc:creator>' + xml(author) + '</dc:creator>' : '') + '<dc:language>es</dc:language><meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>' + manifest.join('') + '</manifest><spine>' + spine.join('') + '</spine></package>');
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' }, m => onProgress(80 + Math.round(m.percent * 0.19), 'Comprimiendo…'));
  onProgress(100, 'Listo');
  return { blob, name: title.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 100) + '.epub' };
}
