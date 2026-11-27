import crypto from 'crypto';
import { cookies } from 'next/headers';

export const COOKIE = 'cv_admin';

function sign(value) {
  return crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || '').update(value).digest('hex');
}

export function passwordOk(pw) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function makeToken() {
  const exp = String(Date.now() + 1000 * 60 * 60 * 24 * 7);
  return exp + '.' + sign(exp);
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value || '';
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
