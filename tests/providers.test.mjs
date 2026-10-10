import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChatUrl, searchItems } from '../src/providers.mjs';
test('accepts an official conversation URL only for its provider',()=>{
  assert.equal(validateChatUrl('https://claude.ai/chat/123','claude'),'https://claude.ai/chat/123');
  assert.equal(validateChatUrl('https://chatgpt.com/c/123','chatgpt'),'https://chatgpt.com/c/123');
  assert.equal(validateChatUrl('https://claude.ai/chat/123','chatgpt'),null);
});
test('rejects lookalike domains, executable schemes, credentials and custom ports',()=>{
  for(const url of ['javascript:alert(1)','http://claude.ai/chat/123','https://claude.ai.evil.com','https://evil.com/?claude.ai','https://user:pass@claude.ai/chat/123','https://claude.ai:8443/chat/123','file:///C:/Windows']) assert.equal(validateChatUrl(url,'claude'),null);
});
test('search uses every query word and respects provider and item type',()=>{
  const items=[{title:'Robot Camera',provider:'claude',type:'chat',note:'Panoramic',pinned:false,updated:3},{title:'Robot firmware',provider:'codex',type:'project',note:'Camera driver',pinned:true,updated:1},{title:'Design sketches',provider:'chatgpt',type:'chat',note:'Robot',pinned:false,updated:4}];
  assert.deepEqual(searchItems(items,'robot camera').map(i=>i.title),['Robot firmware','Robot Camera']);
  assert.deepEqual(searchItems(items,'robot','claude','chat').map(i=>i.title),['Robot Camera']);
  assert.equal(searchItems(items,'nonexistent').length,0);
});
