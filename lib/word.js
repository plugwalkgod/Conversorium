// PDF ⇄ Word (DOCX) en el navegador.
import JSZip from 'jszip';
import { extractPdf } from './pdf2epub';

const xml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safe = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 100) || 'documento';

// ---------- PDF → Word ----------
function para(text, style) {
  const runs = '<w:r><w:t xml:space="preserve">' + xml(text) + '</w:t></w:r>';
  return '<w:p>' + (style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '') + runs + '</w:p>';
}
const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/><w:color w:val="1F2937"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
  '<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:jc w:val="left"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="374151"/></w:rPr></w:style>' +
  '</w:styles>';

export async function pdfToDocx(file, opts, onProgress) {
  const { title, author, perPage } = await extractPdf(file, (p, m) => onProgress(Math.round(p * 0.85), m));
  onProgress(88, 'Creando el documento de Word…');
  const body = [];
  perPage.forEach((blocks, i) => {
    if (i > 0 && opts.keepPages) body.push(PAGE_BREAK);
    for (const b of blocks) body.push(para(b.text, b.type === 'h1' ? 'Heading1' : b.type === 'h2' ? 'Heading2' : null));
  });
  const size = opts.pageSize === 'carta' ? '<w:pgSz w:w="12240" w:h="15840"/>' : '<w:pgSz w:w="11906" w:h="16838"/>';
  const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body.join('') +
    '<w:sectPr>' + size + '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>';

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('word/document.xml', doc);
  zip.file('word/styles.xml', STYLES);
  zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:title>' + xml(title) + '</dc:title>' + (author ? '<dc:creator>' + xml(author) + '</dc:creator>' : '') +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>');
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  onProgress(100, 'Listo');
  return { blob, name: safe(file.name.replace(/\.pdf$/i, '')) + '.docx' };
}

// ---------- Word → PDF ----------
let mammothPromise = null;
function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothPromise) {
    mammothPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
      s.onload = () => (window.mammoth ? res(window.mammoth) : rej(new Error('No se pudo cargar el lector de Word.')));
      s.onerror = () => rej(new Error('No se pudo cargar el lector de Word (revisa tu conexión).'));
      document.head.appendChild(s);
    });
    mammothPromise.catch(() => { mammothPromise = null; });
  }
  return mammothPromise;
}

export async function docxToPdf(file, opts, onProgress) {
  onProgress(4, 'Cargando lector de Word…');
  const mammoth = await loadMammoth();
  onProgress(12, 'Leyendo el documento…');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });

  // Montamos un EPUB en memoria con ese HTML y reutilizamos el maquetador de EPUB → PDF.
  const zip = new JSZip();
  let n = 0;
  const body = html.replace(/<img([^>]*?)src="data:image\/(png|jpe?g|gif|webp);base64,([^"]+)"/gi, (m, pre, ext, b64) => {
    const name = 'img/' + (++n) + '.' + (ext === 'jpeg' ? 'jpg' : ext.toLowerCase());
    zip.file('OEBPS/' + name, b64, { base64: true });
    return '<img' + pre + 'src="' + name + '"';
  }).replace(/<br>/g, '<br/>').replace(/<img([^>]*?)(?<!\/)>/g, '<img$1/>');
  const title = file.name.replace(/\.docx$/i, '');
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + xml(title) + '</dc:title></metadata>' +
    '<manifest><item id="d" href="doc.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="d"/></spine></package>');
  zip.file('OEBPS/doc.xhtml', '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>' + xml(title) + '</title></head><body>' + body + '</body></html>');
  const epub = new File([await zip.generateAsync({ type: 'blob' })], title + '.epub');

  const { convertEpubToPdf } = await import('./epub');
  const r = await convertEpubToPdf(epub, { ...opts, plain: true }, (p, m) => onProgress(20 + Math.round(p * 0.8), m === 'Convirtiendo capítulo 1 de 1…' ? 'Maquetando el PDF…' : m));
  return { blob: r.blob, name: safe(title) + '.pdf' };
}
