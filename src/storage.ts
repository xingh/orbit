import type { Item, Settings } from './types';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { validateChatUrl } from './providers.mjs';
export type Data = { items: Item[]; settings: Settings };
export const emptyData: Data = { items: [], settings: { grok: false, compact: false } };
export function sanitizeData(raw: unknown): Data {
  if (!raw || typeof raw !== 'object') return emptyData;
  const data = raw as Partial<Data>;
  const items = (Array.isArray(data.items) ? data.items : []).filter((item): item is Item => !!item && typeof item.id === 'string' && typeof item.title === 'string' && ['chat','project'].includes(item.type) && typeof item.provider === 'string' && typeof item.url === 'string' && (item.type === 'project' || !!validateChatUrl(item.url,item.provider)))
    .map(item => ({...item, folder: typeof item.folder === 'string' ? item.folder : '', note: typeof item.note === 'string' ? item.note : '', pinned: !!item.pinned, updated: Number.isFinite(item.updated) ? item.updated : 0}));
  return { items, settings: { grok: data.settings?.grok === true, compact: data.settings?.compact === true } };
}
export async function loadData(): Promise<Data> {
  const raw = isTauri() ? await invoke<string>('load_data') : localStorage.getItem('orbit-v1');
  return raw ? sanitizeData(JSON.parse(raw)) : emptyData;
}
export async function saveData(data: Data) {
  const json=JSON.stringify(data);
  if(isTauri()) await invoke('save_data', { json });
  else localStorage.setItem('orbit-v1',json);
}
export async function openDestination(url: string) {
  if(isTauri()) await invoke('open_url',{url});
  else { const link=document.createElement('a'); link.href=url; link.target='_blank'; link.rel='noopener noreferrer'; link.click(); }
}
