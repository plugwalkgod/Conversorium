import { NextResponse } from 'next/server';
import { passwordOk, makeToken, COOKIE } from '../../../../lib/auth';

export async function POST(req) {
  if (!process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Falta configurar ADMIN_PASSWORD en Vercel.' }, { status: 500 });
  let body = {};
  try { body = await req.json(); } catch (e) {}
  if (!passwordOk(body.password)) {
    await new Promise(r => setTimeout(r, 800));
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(), { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 0 });
  return res;
}
