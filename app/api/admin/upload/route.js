import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { isAdmin } from '../../../../lib/auth';

const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/gif': 'gif' };

export async function POST(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: 'Falta conectar el almacenamiento (Vercel Blob).' }, { status: 500 });
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No llegó ninguna imagen.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Formato no admitido. Usa PNG, JPG, WebP, SVG o GIF.' }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'La imagen pesa más de 4 MB.' }, { status: 400 });
  const blob = await put('conversorium/img/imagen.' + ext, file, { access: 'public', addRandomSuffix: true, contentType: file.type });
  return NextResponse.json({ url: blob.url });
}
