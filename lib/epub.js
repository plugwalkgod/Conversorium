import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

const PAGE_SIZES = { a4: 'a4', a5: 'a5', carta: 'letter' };
function resolvePath(baseDir, relPath){
  if (!relPath) return relPath;
  relPath = relPath.split('#')[0];
  if (/^https?:\/\//.test(relPath)) return relPath;
  if (relPath.startsWith('/')) relPath = relPath.slice(1);
  const baseParts = baseDir ? baseDir.split('/').filter(Boolean) : [];
  const relParts = relPath.split('/');
  const stack = [...baseParts];
  for (const part of relParts){
    if (part === '..') stack.pop();
    else if (part === '.' || part === '') continue;
    else stack.push(decodeURIComponent(part));
  }
  return stack.join('/');
}

function dirOf(path){
  return path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
}

function getDcText(doc, tag){
  let els = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', tag);
  if (!els.length) els = doc.getElementsByTagName('dc:' + tag);
  if (!els.length) els = doc.getElementsByTagName(tag);
  return els.length ? (els[0].textContent || '').trim() : '';
}

async function findOpfPath(zip){
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('No es un EPUB válido (falta META-INF/container.xml)');
  const text = await containerFile.async('string');
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const rootfile = doc.getElementsByTagName('rootfile')[0];
  if (!rootfile) throw new Error('No se encontró el archivo OPF dentro del EPUB');
  return rootfile.getAttribute('full-path');
}

async function parseEpub(zip){
  const opfPath = await findOpfPath(zip);
  const opfDir = dirOf(opfPath);
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('El archivo OPF referenciado no existe dentro del EPUB');
  const opfText = await opfFile.async('string');
  const opfDoc = new DOMParser().parseFromString(opfText, 'text/xml');

  const title = getDcText(opfDoc, 'title') || 'Sin título';
  const author = getDcText(opfDoc, 'creator') || '';

  const manifest = {};
  const items = opfDoc.getElementsByTagName('item');
  for (let i = 0; i < items.length; i++){
    const it = items[i];
    manifest[it.getAttribute('id')] = {
      href: it.getAttribute('href'),
      mediaType: it.getAttribute('media-type') || '',
      properties: it.getAttribute('properties') || ''
    };
  }

  const spineEls = opfDoc.getElementsByTagName('itemref');
  const chapterPaths = [];
  for (let i = 0; i < spineEls.length; i++){
    const idref = spineEls[i].getAttribute('idref');
    const item = manifest[idref];
    if (item && item.href) chapterPaths.push(resolvePath(opfDir, item.href));
  }
  if (!chapterPaths.length) throw new Error('El EPUB no tiene capítulos en su spine');

  let coverPath = null;
  const coverItem = Object.values(manifest).find(it => (it.properties||'').includes('cover-image'));
  if (coverItem) {
    coverPath = resolvePath(opfDir, coverItem.href);
  } else {
    const metas = opfDoc.getElementsByTagName('meta');
    for (let i = 0; i < metas.length; i++){
      if (metas[i].getAttribute('name') === 'cover'){
        const id = metas[i].getAttribute('content');
        if (manifest[id]) coverPath = resolvePath(opfDir, manifest[id].href);
      }
    }
  }

  return { title, author, chapterPaths, coverPath };
}

function extractBlocks(bodyEl){
  const blocks = [];
  const CONTAINER_TAGS = new Set(['div','section','article','span','body','figure','figcaption',
    'ul','ol','table','tbody','thead','tr','td','th','header','footer','main','em','strong','b','i','a','center','small','sub','sup']);
  function textOf(el){ return (el.textContent || '').replace(/\s+/g,' ').trim(); }
  function collectImages(el, out){
    const imgs = el.getElementsByTagName ? el.getElementsByTagName('img') : [];
    for (let i=0;i<imgs.length;i++){
      const src = imgs[i].getAttribute('src');
      if (src) out.push(src);
    }
  }
  function walk(node){
    const kids = node.childNodes;
    for (let i=0;i<kids.length;i++){
      const child = kids[i];
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'nav') continue;
      if (/^h[1-6]$/.test(tag)){
        const txt = textOf(child);
        if (txt) blocks.push({ type:'heading', level: parseInt(tag[1],10), text: txt });
        continue;
      }
      if (tag === 'p' || tag === 'blockquote'){
        const txt = textOf(child);
        if (txt) blocks.push({ type: tag === 'p' ? 'paragraph' : 'quote', text: txt });
        const imgSrcs = [];
        collectImages(child, imgSrcs);
        imgSrcs.forEach(src => blocks.push({ type:'image', src }));
        continue;
      }
      if (tag === 'li'){
        const txt = textOf(child);
        if (txt) blocks.push({ type:'listitem', text: txt });
        continue;
      }
      if (tag === 'img' || tag === 'image'){
        const src = child.getAttribute('src') ||
          (child.getAttributeNS && child.getAttributeNS('http://www.w3.org/1999/xlink','href')) ||
          child.getAttribute('xlink:href');
        if (src) blocks.push({ type:'image', src });
        continue;
      }
      if (tag === 'hr'){ blocks.push({ type:'hr' }); continue; }
      if (CONTAINER_TAGS.has(tag)){ walk(child); continue; }
      walk(child);
    }
  }
  walk(bodyEl);
  return blocks;
}

async function loadChapterBlocks(zip, fullPath){
  const file = zip.file(fullPath);
  if (!file) return [];
  const text = await file.async('string');
  let doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if (doc.getElementsByTagName('parsererror').length){
    doc = new DOMParser().parseFromString(text, 'text/html');
  }
  const body = doc.getElementsByTagName('body')[0] || doc.documentElement;
  return extractBlocks(body);
}

const IMG_MIME = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp' };

async function loadImageAsset(zip, fullPath){
  const ext = (fullPath.split('.').pop() || '').toLowerCase();
  const mime = IMG_MIME[ext];
  if (!mime) return null;
  const file = zip.file(fullPath);
  if (!file) return null;
  let base64;
  try { base64 = await file.async('base64'); } catch(e){ return null; }
  const dataUrl = 'data:' + mime + ';base64,' + base64;
  const dims = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
  if (!dims || !dims.w || !dims.h) return null;
  const format = mime === 'image/png' ? 'PNG' : (mime === 'image/webp' ? 'WEBP' : 'JPEG');
  return { dataUrl, format, w: dims.w, h: dims.h };
}

function mmFromPt(pt){ return pt * 0.352778; }

function makeLayoutState(doc, margin){
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  return { pageWidth: pw, pageHeight: ph, margin, contentWidth: pw - margin*2, y: margin };
}

function ensureSpace(doc, state, needed){
  if (state.y + needed > state.pageHeight - state.margin){
    doc.addPage();
    state.y = state.margin;
    return true;
  }
  return false;
}

function drawParagraphLike(doc, state, text, opts){
  const { fontSize, font='times', style='normal', indent=0, lineMult=1.32, before=0, after=2.6, align='left' } = opts;
  state.y += before;
  doc.setFont(font, style);
  doc.setFontSize(fontSize);
  const width = state.contentWidth - indent*2;
  const lines = doc.splitTextToSize(text, width);
  const lh = mmFromPt(fontSize) * lineMult;
  for (const line of lines){
    ensureSpace(doc, state, lh);
    doc.text(line, state.margin + indent, state.y + lh*0.78, { align });
    state.y += lh;
  }
  state.y += after;
}

function drawHeading(doc, state, text, level){
  const sizes = { 1:19, 2:16.5, 3:14.5, 4:12.5, 5:12, 6:11.5 };
  const fontSize = sizes[level] || 12;
  ensureSpace(doc, state, mmFromPt(fontSize)*1.4 + 8);
  drawParagraphLike(doc, state, text, { fontSize, font:'times', style:'bold', before: level<=2?9:6, after: 4, lineMult:1.25 });
}

async function drawImageBlock(doc, state, zip, chapterDir, src){
  const fullPath = resolvePath(chapterDir, src);
  const asset = await loadImageAsset(zip, fullPath);
  if (!asset) return;
  let dispW = state.contentWidth;
  let dispH = dispW * (asset.h / asset.w);
  const maxH = state.pageHeight - state.margin*2;
  if (dispH > maxH){
    dispH = maxH;
    dispW = dispH * (asset.w / asset.h);
  }
  ensureSpace(doc, state, dispH);
  const x = state.margin + (state.contentWidth - dispW) / 2;
  try { doc.addImage(asset.dataUrl, asset.format, x, state.y, dispW, dispH); } catch(e){ return; }
  state.y += dispH + 4;
}

async function renderBlocks(doc, state, zip, chapterDir, blocks, fontSize){
  for (const b of blocks){
    if (b.type === 'heading') drawHeading(doc, state, b.text, b.level);
    else if (b.type === 'paragraph') drawParagraphLike(doc, state, b.text, { fontSize, align:'left', after: fontSize*0.28 });
    else if (b.type === 'quote') drawParagraphLike(doc, state, b.text, { fontSize, style:'italic', indent: 7, after: fontSize*0.3 });
    else if (b.type === 'listitem') drawParagraphLike(doc, state, '•  ' + b.text, { fontSize, indent: 4, after: fontSize*0.2 });
    else if (b.type === 'image') await drawImageBlock(doc, state, zip, chapterDir, b.src);
    else if (b.type === 'hr'){ ensureSpace(doc, state, 6); state.y += 3;
      doc.setDrawColor(160); doc.line(state.margin + state.contentWidth*0.3, state.y, state.margin + state.contentWidth*0.7, state.y);
      state.y += 5;
    }
  }
}

async function convertEpubToPdf(file, opts, onProgress){

  const buf = await file.arrayBuffer();
  onProgress(4, 'Leyendo archivo…');
  const zip = await JSZip.loadAsync(buf);
  onProgress(10, 'Analizando estructura EPUB…');
  const meta = await parseEpub(zip);

  const doc = new jsPDF({ unit:'mm', format: PAGE_SIZES[opts.pageSize] || 'a4' });
  const margin = 20;
  let state = makeLayoutState(doc, margin);

  // Portada
  const plain = !!opts.plain; // documento normal: sin portada, sin títulos inventados
  let coverAsset = null;
  if (!plain && meta.coverPath){
    onProgress(14, 'Cargando portada…');
    coverAsset = await loadImageAsset(zip, meta.coverPath);
  }
  if (plain){
    // sin página de título
  } else if (coverAsset){
    let dispW = state.contentWidth * 0.72;
    let dispH = dispW * (coverAsset.h / coverAsset.w);
    const maxH = state.pageHeight - margin*2 - 40;
    if (dispH > maxH){ dispH = maxH; dispW = dispH * (coverAsset.w / coverAsset.h); }
    const x = margin + (state.contentWidth - dispW)/2;
    const y = margin + 10;
    try { doc.addImage(coverAsset.dataUrl, coverAsset.format, x, y, dispW, dispH); } catch(e){}
    state.y = y + dispH + 14;
  } else {
    state.y = state.pageHeight * 0.36;
  }
  if (!plain){
  doc.setFont('times','bold'); doc.setFontSize(24);
  const titleLines = doc.splitTextToSize(meta.title, state.contentWidth * 0.85);
  titleLines.forEach(line => { state.y += 10; doc.text(line, state.pageWidth/2, state.y, { align:'center' }); });
  if (meta.author){
    doc.setFont('times','italic'); doc.setFontSize(13);
    state.y += 12;
    doc.text(meta.author, state.pageWidth/2, state.y, { align:'center' });
  }
  }

  const total = meta.chapterPaths.length;
  for (let i = 0; i < total; i++){
    const pct = 16 + Math.round((i/total) * 76);
    onProgress(pct, 'Convirtiendo capítulo ' + (i+1) + ' de ' + total + '…');
    const chPath = meta.chapterPaths[i];
    const chapterDir = dirOf(chPath);
    let blocks = [];
    try { blocks = await loadChapterBlocks(zip, chPath); } catch(e){ blocks = []; }
    if (!plain && !blocks.some(b => b.type === 'heading')){
      blocks = [{ type:'heading', level:2, text:'Capítulo ' + (i+1) }, ...blocks];
    }
    if (!plain || i > 0) doc.addPage();
    state = makeLayoutState(doc, margin);
    await renderBlocks(doc, state, zip, chapterDir, blocks, opts.fontSize);
  }

  onProgress(95, 'Añadiendo numeración…');
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFont('helvetica','normal');
  for (let p = plain ? 1 : 2; p <= pageCount; p++){
    doc.setPage(p);
    doc.setFontSize(9);
    doc.setTextColor(130);
    doc.text(String(plain ? p : p-1), state.pageWidth/2, state.pageHeight - 10, { align:'center' });
    doc.setTextColor(0);
  }

  onProgress(100, 'Listo');
  return { blob: doc.output('blob'), title: meta.title };
}




export { convertEpubToPdf };
