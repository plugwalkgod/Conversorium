import { list, put } from '@vercel/blob';
import { mergeConfig } from './config-defaults';

const PATH = 'conversorium/config.json';

export async function getConfig() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return mergeConfig(null);
  try {
    const { blobs } = await list({ prefix: PATH, limit: 1 });
    if (!blobs.length) return mergeConfig(null);
    const r = await fetch(blobs[0].url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return mergeConfig(null);
    return mergeConfig(await r.json());
  } catch (e) {
    console.error('No se pudo leer la configuración', e);
    return mergeConfig(null);
  }
}

export async function saveConfig(cfg) {
  const clean = mergeConfig(cfg);
  await put(PATH, JSON.stringify(clean, null, 2), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60,
  });
  return clean;
}
