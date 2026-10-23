export type Item = { id: string; type: 'chat' | 'project'; title: string; provider: string; url: string; folder: string; note: string; pinned: boolean; updated: number; projectId?: string };
export type Settings = { grok: boolean; compact: boolean; robot: boolean };
