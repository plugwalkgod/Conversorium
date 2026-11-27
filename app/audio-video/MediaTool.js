'use client';
import { useEffect } from 'react';
import ToolShell from '../../components/ToolShell';
import { ACCENTS } from '../../components/accents';

const MEDIA = '.webm,.mp4,.mov,.mkv,.ogv,.ogg,.m4a,.mp3,.wav,.flac,.aac,video/*,audio/*';
const isMedia = f => /^(video|audio)\//.test(f.type) || /\.(webm|mp4|mov|mkv|ogv|ogg|m4a|mp3|wav|flac|aac)$/i.test(f.name);
const isAudio = f => /^audio\//.test(f.type) || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(f.name);

const MODES = [
  {
    key: 'extract', from: 'Vídeo · Audio', to: 'MP3 · WAV · MP4', title: 'Audio y vídeo',
    subtitle: 'Saca el audio en MP3 o WAV, recórtalo con el editor o convierte el vídeo a MP4.',
    drop: 'Suelta tus vídeos o audios', accept: MEDIA, test: isMedia,
    defaults: { target: 'mp3', kbps: 192, engine: 'wasm', fadeIn: false, fadeOut: false, merge: false },
    fields: [
      { key: 'target', label: 'Convertir a', type: 'select', options: [['mp3', 'Audio MP3'], ['wav', 'Audio WAV'], ['video', 'Vídeo MP4']] },
      { key: 'kbps', label: 'Calidad MP3', type: 'select', num: true, when: o => o.target === 'mp3', options: [[128, '128 kbps'], [192, '192 kbps'], [320, '320 kbps']] },
      { key: 'engine', label: 'Método', type: 'select', when: o => o.target === 'video', options: [['wasm', 'Rápido con ffmpeg'], ['record', 'Grabar en tiempo real']] },
      { key: 'fadeIn', label: 'Fundido de entrada', type: 'check', when: o => o.target !== 'video' },
      { key: 'fadeOut', label: 'Fundido de salida', type: 'check', when: o => o.target !== 'video' },
      { key: 'merge', label: 'Unir todo en un solo audio', type: 'check', when: o => o.target !== 'video' },
    ],
    run: async (file, o, p, it) => (await import('../../lib/engine')).convertMedia(file, o, p, it),
    useBatch: o => o.merge && o.target !== 'video',
    batch: async (items, o, p) => (await import('../../lib/engine')).mergeMedia(items, o, p),
    itemExtra: (it, o) => o.target === 'video' ? null : (
      <button type="button" onClick={async () => (await import('../../lib/engine')).openEditor(it)}
        className="mt-2.5 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/20">
        ✂ Editar y recortar
      </button>
    ),
  },
];

export default function MediaTool() {
  useEffect(() => {
    document.body.style.setProperty('--a', ACCENTS.webm.css);
    return () => document.body.style.removeProperty('--a');
  }, []);
  return <ToolShell id="webm" accent={ACCENTS.webm} modes={MODES} />;
}
