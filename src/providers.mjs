export const providers = [
  { id: 'claude', name: 'Claude', mark: 'C', color: '#dfaa88', url: 'https://claude.ai/new', kind: 'web' },
  { id: 'chatgpt', name: 'ChatGPT', mark: 'G', color: '#8fceb7', url: 'https://chatgpt.com/', kind: 'web' },
  { id: 'codex', name: 'Codex', mark: '>', color: '#a7bded', url: 'https://chatgpt.com/codex', kind: 'code' },
  { id: 'claude-code', name: 'Claude Code', mark: '/>', color: '#e2b791', url: 'https://claude.ai/code', kind: 'code' },
  { id: 'grok', name: 'Grok', mark: 'X', color: '#ccd4dc', url: 'https://grok.com/', kind: 'web' }
];
export function validateChatUrl(value, provider) {
  try {
    const url = new URL(value);
    const hosts = { claude: ['claude.ai'], chatgpt: ['chatgpt.com'], codex: ['chatgpt.com'], 'claude-code': ['claude.ai'], grok: ['grok.com'] };
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts[provider]?.includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
export function searchItems(items, query, provider = 'all', type = 'all') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => (provider === 'all' || item.provider === provider) && (type === 'all' || item.type === type) && words.every(word => `${item.title} ${item.note || ''} ${item.provider} ${item.folder || ''}`.toLowerCase().includes(word)))
    .sort((a,b) => (b.pinned - a.pinned) || b.updated - a.updated);
}
