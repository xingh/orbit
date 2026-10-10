import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Search, Plus, Folder, ArrowUpRight, Pin, Trash2, X, Settings as SettingsIcon, Download, Upload, Command, ChevronRight, MessageSquare, ShieldCheck, Minimize2, Grip, Terminal, ArrowLeft } from 'lucide-react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import Robot from './Robot';
import { providers, searchItems, validateChatUrl } from './providers.mjs';
import { loadData, saveData, openDestination, emptyData, sanitizeData, type Data } from './storage';
import type { Item } from './types';

const native = isTauri();
type View = 'new' | 'find' | 'projects' | 'settings';
const blank = { title: '', provider: 'claude', url: '', folder: '', note: '', projectId: '' };

export default function App() {
  const [data,setData]=useState<Data>(emptyData);
  const [ready,setReady]=useState(false);
  const [view,setView]=useState<View>('new');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [expanded,setExpanded]=useState(true);
  const [modal,setModal]=useState<'chat'|'project'|null>(null);
  const [draft,setDraft]=useState(blank);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [project,setProject]=useState<Item|null>(null);
  const [remove,setRemove]=useState<string|null>(null);
  const [loadingError,setLoadingError]=useState(false);
  const [busy,setBusy]=useState(false);
  const searchRef=useRef<HTMLInputElement>(null);
  const importRef=useRef<HTMLInputElement>(null);
  const persistQueue=useRef(Promise.resolve());
  const dataRef=useRef(data); dataRef.current=data;
  const available=providers.filter(p=>p.id!=='grok'||data.settings.grok);
  useEffect(()=>{
    if(!modal&&!remove)return;
    const previous=document.activeElement as HTMLElement|null;
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab')return;
      const dialog=document.querySelector<HTMLElement>('[role="dialog"]');
      const controls=dialog?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]');
      if(!controls?.length)return;
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',trap);
    return()=>{document.removeEventListener('keydown',trap);previous?.focus();};
  },[modal,remove]);
  useEffect(()=>{loadData().then(value=>{setData(value);setReady(true);}).catch(()=>{setLoadingError(true);setNotice('Could not read saved data. Reload to try again; saving is paused.');});},[]);
  useEffect(()=>{
    if(!ready) return;
    persistQueue.current=persistQueue.current.catch(()=>{}).then(()=>saveData(data)).catch(()=>setNotice('Your change could not be saved. Export a backup before closing.'));
  },[data,ready]);
  useEffect(()=>{
    if(!notice) return;
    const timer=setTimeout(()=>setNotice(''),6000); return()=>clearTimeout(timer);
  },[notice]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.ctrlKey&&e.key.toLowerCase()==='k'){e.preventDefault();setExpanded(true);setView('find');setTimeout(()=>searchRef.current?.focus(),30);}
      if(e.key==='Escape'){if(modal)setModal(null);else if(remove)setRemove(null);else if(project)setProject(null);else setExpanded(false);}
    }; window.addEventListener('keydown',key); return()=>window.removeEventListener('keydown',key);
  },[modal,remove,project]);
  useEffect(()=>{
    if(!native)return;
    void getCurrentWindow().setSize(new LogicalSize(510,expanded?820:290)).catch(()=>setNotice('Could not resize the companion.'));
  },[expanded]);
  useEffect(()=>{
    if(!native)return;
    const subscription=listen('open-launcher',()=>{setExpanded(true);setView('find');setTimeout(()=>searchRef.current?.focus(),60);});
    return()=>{void subscription.then(unlisten=>unlisten());};
  },[]);
  const updateItems=(fn:(items:Item[])=>Item[])=>setData(current=>({...current,items:fn(current.items)}));
  const navigate=(next:View)=>{setView(next);setExpanded(true);setProject(null);setQuery('');setFilter('all');};
  const tryOpen=async(url:string)=>{try{await openDestination(url);}catch{setNotice('Could not open the link. Check your default browser.');}};
  const openItem=async(item:Item)=>{
    if(item.type==='project'){setProject(item);return;}
    const url=validateChatUrl(item.url,item.provider);
    if(!url){setNotice('This link does not match its service.');return;}
    await tryOpen(url); updateItems(items=>items.map(i=>i.id===item.id?{...i,updated:Date.now()}:i));
  };
  const showAdd=(type:'chat'|'project')=>{setModal(type);setDraft({...blank,projectId:project?.id||'',provider:project?.provider||'claude'});setError('');};
  const submit=(event:FormEvent)=>{
    event.preventDefault(); if(!ready){setError('Wait for your saved data to load.');return;}
    const title=draft.title.trim(); if(!title){setError('Give this a name.');return;}
    const url=modal==='chat'?validateChatUrl(draft.url.trim(),draft.provider):'';
    if(modal==='chat'&&!url){setError('Use an HTTPS chat link from the selected service.');return;}
    const item:Item={...draft,title,url:url||'',folder:draft.folder.trim(),id:crypto.randomUUID(),type:modal!,pinned:false,updated:Date.now()};
    updateItems(items=>[item,...items]);setModal(null);setNotice(modal==='chat'?'Chat saved. You can find it here anytime.':'Project created. Add its related chats next.');
  };
  const chooseFolder=async()=>{try{const folder=await invoke<string|null>('pick_folder');if(folder)setDraft(d=>({...d,folder}));}catch{setError('Could not select a folder. You can enter its path manually.');}};
  const launchCode=async(provider:string,folder:string)=>{
    if(!native){setNotice('Local coding tools launch from the Windows app. Use the web option in this preview.');return;}
    setBusy(true);try{await invoke('launch_code',{provider,folder});setNotice('Coding terminal opened. Use subscription sign-in in the official tool.');}catch(e){setNotice(String(e));}finally{setBusy(false);}
  };
  const exportData=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(dataRef.current,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='orbit-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importData=async(file:File)=>{
    try{
      if(!ready)throw Error('Saved data has not loaded yet.');
      if(file.size>2_000_000)throw Error('Choose a backup smaller than 2 MB.');
      const raw=JSON.parse(await file.text());if(!Array.isArray(raw.items))throw Error('Choose an Orbit backup or chat-saver export.');
      const imported=sanitizeData(raw);if(raw.items.length&&imported.items.length===0)throw Error('No valid chat or project entries were found.');
      setData(current=>{
        const merged=[...current.items];
        for(const item of imported.items){if(!merged.some(existing=>existing.id===item.id||(item.type==='chat'&&existing.url===item.url)))merged.push(item);}
        return {...current,items:merged};
      });setNotice('Import complete. Existing entries were kept.');
    }catch(e){setNotice(e instanceof Error?e.message:'Could not import this file.');}
    if(importRef.current)importRef.current.value='';
  };
  const results:Item[]=searchItems(data.items,query,filter,view==='projects'?'project':'all');
  const linked=data.items.filter(i=>i.type==='chat'&&i.projectId===project?.id);
  const Row=({item}:{item:Item})=>{
    const provider=providers.find(p=>p.id===item.provider);
    return <div className="result-row"><button className="result-main" onClick={()=>void openItem(item)}><span className={`item-icon ${item.type}`} style={{color:provider?.color}}>{item.type==='project'?<Folder size={18}/>:<MessageSquare size={18}/>}</span><span><strong>{item.title}</strong><small>{provider?.name} <span>·</span> {item.type==='project'?'Project':'Saved chat'}{item.note&&` · ${item.note}`}</small></span><ChevronRight size={16}/></button><button className={`icon-button ${item.pinned?'pinned':''}`} aria-label={`${item.pinned?'Unpin':'Pin'} ${item.title}`} onClick={()=>updateItems(items=>items.map(i=>i.id===item.id?{...i,pinned:!i.pinned}:i))}><Pin size={14}/></button><button className="icon-button delete" aria-label={`Delete ${item.title}`} onClick={()=>setRemove(item.id)}><Trash2 size={14}/></button></div>;
  };
  return <div className={native?'app native':'app browser'}>
    {!native&&<><header className="page-header"><a className="brand" href="#"><span className="brand-symbol">◉</span> orbit<span className="version">EARLY BUILD 01</span></a><span className="header-caption">Your AI workspace, within reach.</span><button className="outline-button" onClick={()=>navigate('settings')}><SettingsIcon size={15}/> Preferences</button></header><aside className="intro"><div className="eyebrow"><span/> DESKTOP COMPANION</div><h1>A small robot. <br/>A doorway to <br/><em>all your work.</em></h1><p>Start a conversation, pick up a thread,<br/>or return to your next big idea.</p><div className="intro-rule"/><div className="principles"><span><ShieldCheck size={16}/> Your accounts. Your subscriptions.</span><span><Folder size={16}/> Chats and projects, together.</span><span><Command size={16}/> One shortcut away.</span></div><div className="preview-label"><span className="status-dot"/> Interactive browser preview <small>Desktop overlay requires the Windows build.</small></div></aside></>}
    <main className={`companion ${expanded?'expanded':'collapsed'}`}>
      <div className="robot-stage"><div className="robot-halo"/><button className="robot-button" aria-label={expanded?'Collapse companion':'Open companion'} onClick={()=>setExpanded(!expanded)}><Robot active={expanded}/></button><span className="robot-caption"><span/> ORBIT / 360</span>{native&&<button className="drag-handle icon-button" aria-label="Drag companion" onPointerDown={()=>void getCurrentWindow().startDragging()}><Grip size={18}/></button>}</div>
      <nav className="toolbar" aria-label="Companion actions"><button className={view==='new'&&expanded?'selected':''} onClick={()=>navigate('new')}><Plus size={18}/> New chat</button><button className={view==='find'&&expanded?'selected':''} onClick={()=>navigate('find')}><Search size={18}/> Find</button><button className={view==='projects'&&expanded?'selected':''} onClick={()=>navigate('projects')}><Folder size={18}/> Projects</button><button className="toolbar-settings" aria-label="Preferences" onClick={()=>navigate('settings')}><SettingsIcon size={16}/></button></nav>
      {expanded&&<section className="panel">
        <div className="panel-heading"><div><div className="eyebrow">{project?'PROJECT SPACE':view==='settings'?'MAKE IT YOURS':view==='new'?'PICK YOUR NEXT CONVERSATION':'PICK UP WHERE YOU LEFT OFF'}</div><h2>{project?project.title:view==='new'?'Where shall we begin?':view==='find'?'Find your work.':view==='projects'?'Your project spaces.':'Preferences.'}</h2></div><button className="icon-button" aria-label="Collapse panel" onClick={()=>setExpanded(false)}><Minimize2 size={17}/></button></div>
        {!ready&&<div className="inline-error">{loadingError?'Saved data could not be loaded. Reload before making changes.':'Loading your workspace…'}</div>}
        {project?<div className="project-detail"><button className="text-button" onClick={()=>setProject(null)}><ArrowLeft size={14}/> All projects</button><p>{project.note||'A home for related chats and coding work.'}</p>{project.folder&&<div className="folder-path"><Folder size={16}/><span>{project.folder}</span>{native&&<button className="icon-button" aria-label="Open project folder" onClick={()=>void invoke('open_folder',{folder:project.folder}).catch(()=>setNotice('Could not open this folder.'))}><ArrowUpRight size={15}/></button>}</div>}<div className="project-actions"><button className="primary-button" onClick={()=>showAdd('chat')} disabled={!ready}><Plus size={15}/> Add related chat</button>{['codex','claude-code'].includes(project.provider)&&<button className="outline-button" disabled={busy} onClick={()=>void launchCode(project.provider,project.folder)}><Terminal size={15}/> Open coding tool</button>}</div><div className="section-label">RELATED CHATS <span>{linked.length}</span></div><div className="results">{linked.map(item=><Row item={item} key={item.id}/>)}{!linked.length&&<div className="empty compact-empty">No chats linked yet. Add a chat to keep this project together.</div>}</div></div>
        :view==='new'?<><p className="panel-description">Choose a tool. Continue with your own signed-in account.</p><div className="provider-grid">{available.map(provider=><div className="provider-card" key={provider.id}><button className="provider-launch" onClick={()=>void tryOpen(provider.url)}><span className="provider-mark" style={{color:provider.color}}>{provider.mark}</span><span><strong>{provider.name}</strong><small>{provider.kind==='code'?'Coding workspace':'New conversation'}</small></span><ArrowUpRight size={16}/></button>{provider.kind==='code'&&<button className="local-launch" disabled={busy} onClick={()=>void launchCode(provider.id,'')}><Terminal size={12}/> {native?'Open local terminal':'Local tool · Windows app'}</button>}</div>)}</div><div className="save-callout"><span><MessageSquare size={19}/><span><strong>Already have a conversation?</strong><small>Save its link so you can find it again.</small></span></span><button className="icon-button" aria-label="Save a chat link" disabled={!ready} onClick={()=>showAdd('chat')}><Plus size={19}/></button></div><div className="account-note"><ShieldCheck size={14}/> No API keys. Provider usage limits still apply.</div></>
        :view==='settings'?<div className="preferences"><div className="setting"><span><strong>Show Grok</strong><small>Add Grok to the launcher.</small></span><button role="switch" aria-checked={data.settings.grok} aria-label="Show Grok" disabled={!ready} className={`toggle ${data.settings.grok?'on':''}`} onClick={()=>setData(d=>({...d,settings:{...d.settings,grok:!d.settings.grok}}))}><span/></button></div><div className="setting"><span><strong>Workspace backup</strong><small>Export your saved links and projects.</small></span><button className="icon-button" aria-label="Export backup" onClick={exportData}><Download size={18}/></button></div><div className="setting"><span><strong>Import saved work</strong><small>Merge a backup or chat-saver export.</small></span><button className="icon-button" disabled={!ready} aria-label="Import backup" onClick={()=>importRef.current?.click()}><Upload size={18}/></button></div><div className="settings-note"><ShieldCheck size={20}/><p>Orbit opens official apps and websites. Sign in there with your existing subscriptions. Your saved links stay on this device.</p></div><div className="shortcut-row"><span>{native?'Global shortcut':'Search shortcut in this window'}</span><kbd>{native?'Ctrl + Shift + Space':'Ctrl + K'}</kbd></div><p className="muted">{native?'Local tools must already be installed and signed in. Orbit removes API-key variables from terminals it launches.':'This preview saves to this browser. The Windows build uses a local SQLite database.'}</p></div>
        :<><div className="search-box"><Search size={18}/><input ref={searchRef} aria-label="Search saved chats and projects" placeholder={view==='projects'?'Search projects…':'Search saved chats and projects…'} value={query} onChange={e=>setQuery(e.target.value)}/>{query?<button className="icon-button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>:<kbd>Ctrl K</kbd>}</div><div className="filters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All tools</button>{available.map(p=><button key={p.id} className={filter===p.id?'active':''} onClick={()=>setFilter(p.id)}>{p.name}</button>)}</div><div className="section-label">{query?'RESULTS':view==='projects'?'PROJECTS':'SAVED WORK'} <span>{results.length}</span><button onClick={()=>showAdd(view==='projects'?'project':'chat')} disabled={!ready}><Plus size={13}/>{view==='projects'?'New project':'Save chat'}</button></div><div className="results">{results.map(item=><Row item={item} key={item.id}/>)}{!results.length&&<div className="empty"><span className="empty-icon">{view==='projects'?<Folder size={26}/>:<Search size={26}/>}</span><strong>{query||filter!=='all'?'Nothing matches yet.':view==='projects'?'Room for your next idea.':'Your work starts here.'}</strong><p>{query||filter!=='all'?'Try a different name or tool.':view==='projects'?'Create a project and bring its chats together.':'Save a conversation link to find it here later.'}</p>{!query&&filter==='all'&&<button className="outline-button" disabled={!ready} onClick={()=>showAdd(view==='projects'?'project':'chat')}><Plus size={15}/>{view==='projects'?'Create project':'Save your first chat'}</button>}</div>}</div><div className="account-note"><ShieldCheck size={14}/> Searches saved links. Older history stays in each service.</div></>}
        <footer className="panel-footer"><span><span className="status-dot"/> {native?'LOCAL WORKSPACE':'BROWSER PREVIEW'}</span><span>{data.items.length} saved <span className="footer-divider">/</span> <button onClick={()=>navigate('settings')}>Settings</button></span></footer>
      </section>}
      {notice&&<div className="toast" role="status">{notice}<button className="icon-button" aria-label="Dismiss message" onClick={()=>setNotice('')}><X size={14}/></button></div>}
    </main>
    {!native&&<footer className="page-footer"><span>Built to stay out of your way.</span><span>LOCAL FIRST <span>·</span> SUBSCRIPTION FRIENDLY</span></footer>}
    <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];if(file)void importData(file);}}/>
    {modal&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{modal==='chat'?'Save a conversation':'Create a project'}</h2><button className="icon-button" aria-label="Close dialog" onClick={()=>setModal(null)}><X size={19}/></button></div><form onSubmit={submit}><label>Name<input autoFocus required maxLength={120} value={draft.title} placeholder={modal==='chat'?'e.g. Robot camera design':'e.g. Mini bot firmware'} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>{modal==='project'?'Preferred tool':'Service'}<select value={draft.provider} onChange={e=>setDraft({...draft,provider:e.target.value})}>{available.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{modal==='chat'?<><label>Conversation link<input required type="url" value={draft.url} placeholder="https://…" onChange={e=>setDraft({...draft,url:e.target.value})}/></label><label>Project<select value={draft.projectId} onChange={e=>setDraft({...draft,projectId:e.target.value})}><option value="">No project</option>{data.items.filter(i=>i.type==='project').map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label></>:<label>Local folder <span className="muted">(optional)</span><div className="folder-input"><input value={draft.folder} placeholder="C:\Projects\my-robot" onChange={e=>setDraft({...draft,folder:e.target.value})}/>{native&&<button type="button" className="icon-button" aria-label="Choose folder" onClick={()=>void chooseFolder()}><Folder size={18}/></button>}</div></label>}<label>Note <span className="muted">(optional)</span><input maxLength={240} value={draft.note} placeholder="A little context for later" onChange={e=>setDraft({...draft,note:e.target.value})}/></label>{error&&<p className="inline-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="outline-button" onClick={()=>setModal(null)}>Cancel</button><button className="primary-button" type="submit">{modal==='chat'?'Save chat':'Create project'}<ChevronRight size={15}/></button></div></form></section></div>}
    {remove&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Remove saved entry?</h2><p>This removes “{data.items.find(i=>i.id===remove)?.title}” from Orbit. Your original conversation and files remain in their service.</p><div className="form-actions"><button autoFocus className="outline-button" onClick={()=>setRemove(null)}>Keep it</button><button className="primary-button danger" onClick={()=>{updateItems(items=>items.filter(i=>i.id!==remove).map(i=>i.projectId===remove?{...i,projectId:''}:i));setRemove(null);}}>Remove entry</button></div></section></div>}
  </div>;
}

