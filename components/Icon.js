import { ICONS, LOGO } from './brand';

export function ToolIcon({ id, className = 'h-12 w-12' }) {
  return <span className={'inline-block shrink-0 drop-shadow-[0_8px_16px_rgba(0,0,0,.35)] ' + className} dangerouslySetInnerHTML={{ __html: ICONS[id] }} />;
}

export function Logo({ className = 'h-9 w-9' }) {
  return <span className={'inline-block shrink-0 ' + className} dangerouslySetInnerHTML={{ __html: LOGO }} />;
}
