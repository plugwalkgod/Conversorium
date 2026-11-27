import { NextResponse } from 'next/server';
import { isAdmin } from '../../../../lib/auth';
import { getConfig, saveConfig } from '../../../../lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  return NextResponse.json({ config: await getConfig(), storage: !!process.env.BLOB_READ_WRITE_TOKEN });
}

export async function PUT(req) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: 'Falta conectar el almacenamiento (Vercel Blob).' }, { status: 500 });
  try {
    const { config } = await req.json();
    return NextResponse.json({ config: await saveConfig(config) });
  } catch (e) {
    return NextResponse.json({ error: 'No se pudo guardar: ' + (e.message || e) }, { status: 500 });
  }
}
