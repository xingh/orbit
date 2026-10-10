const title=document.querySelector('#title');
const message=document.querySelector('#message');
const save=document.querySelector('#save');
let current=null;
try {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const url=new URL(tab.url);
  const provider=url.hostname==='claude.ai'?(url.pathname.startsWith('/code')?'claude-code':'claude'):url.hostname==='chatgpt.com'?(url.pathname.startsWith('/codex')?'codex':'chatgpt'):url.hostname==='grok.com'?'grok':null;
  if(url.protocol!=='https:'||url.username||url.password||url.port||!provider)throw Error('Open a conversation on Claude, ChatGPT, Codex, or Grok first.');
  current={url:url.href,provider};title.value=tab.title||'Saved conversation';
  document.querySelector('#service').textContent=`${url.hostname} · Only the title and link are saved.`;
} catch(e) {save.disabled=true;message.textContent=e.message||'This page cannot be saved.';}
save.addEventListener('click',async()=>{
  if(!current||!title.value.trim())return;
  try {
    const {items=[]}=await chrome.storage.local.get('items');
    const item={id:crypto.randomUUID(),type:'chat',title:title.value.trim(),...current,note:'',folder:'',pinned:false,updated:Date.now()};
    const existing=items.findIndex(entry=>entry.url===current.url);
    if(existing>=0)items[existing]={...items[existing],title:item.title,updated:item.updated};else items.push(item);
    await chrome.storage.local.set({items});message.textContent='Saved locally. Export and import into Orbit when ready.';
  }catch{message.textContent='Could not save this chat. Please try again.';}
});
document.querySelector('#export').addEventListener('click',async()=>{
  try {
    const {items=[]}=await chrome.storage.local.get('items');
    const url=URL.createObjectURL(new Blob([JSON.stringify({items},null,2)],{type:'application/json'}));
    await chrome.downloads.download({url,filename:'orbit-saved-chats.json',saveAs:true});
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch{message.textContent='Could not export. Please try again.';}
});
