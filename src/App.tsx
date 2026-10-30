import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Search, Plus, Folder, ArrowUpRight, Pin, Trash2, X, Settings as SettingsIcon, Download, Upload, Command, ChevronRight, MessageSquare, ShieldCheck, Minimize2, Terminal, ArrowLeft } from 'lucide-react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { providers, searchItems, validateChatUrl } from './providers.mjs';
import { anchorOf, place } from './placement.mjs';
import { loadData, saveData, openDestination, emptyData, sanitizeData, type Data } from './storage';
import type { Item } from './types';

// Loaded only when the robot is on, so Three.js is never fetched or parsed when it is off.
const Robot = lazy(() => import('./Robot'));
const native = isTauri();
const mac = /Mac/i.test(navigator.platform || navigator.userAgent);
type View = 'new' | 'find' | 'projects' | 'settings';
const blank = { title: '', provider: 'claude', url: '', folder: '', note: '', projectId: '' };
/** The size the panel was designed at; it scales down from here, never up. */
const DESIGN = { width: 510, height: 820, collapsed: 270 };
/** Share of the monitor's work area the open companion may occupy. */
const FOOTPRINT = 0.2;
// Half the pill with its labels showing: it follows the robot sideways only as far as it still fits.
const PILL_HALF = { normal: 165, tight: 150 };
// Long enough to tell a double-click from a click; only a collapsed robot waits this long.
const DOUBLE_CLICK_MS = 220;
// The drawn robot is about this fraction of its stage's width, so this much of the stage may pass the window's edge.
const ROBOT_REACH = 0.3;
// The native window's vertical padding (.native in styles.css), between its edge and the robot's stage.
const WINDOW_PAD = 8;
const MIN = { width: 330, height: 430 };
/** Below this width the panel switches to its tighter layout. */
const COMPACT_WIDTH = 430;
/** Robot stage heights, paired with .robot-stage in styles.css. `flat` is the mark on its own. */
const STAGE = { normal: 185, tight: 126, flat: 84 };
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));
/** Two entries are the same when they share an id, or the same link as the same kind of entry. */
const same = (a: Item, b: Item) => a.id === b.id || (!!b.url && a.type === b.type && a.url === b.url);
/** "3 chats and 2 projects", for a notice that may carry either. */
const describeItems = (items: Item[]) => {
  const chats = items.filter(item => item.type === 'chat').length;
  const parts = [
    chats && `${chats} chat${chats === 1 ? '' : 's'}`,
    items.length - chats && `${items.length - chats} project${items.length - chats === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.join(' and ') || 'nothing';
};
type ServiceInfo = { port: number; pairing_seconds: number; paired: { origin: string; label: string; paired_at: number }[] };

export default function App() {
  const [data,setData]=useState<Data>(emptyData);
  const [ready,setReady]=useState(false);
  const [view,setView]=useState<View>('new');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [expanded,setExpanded]=useState(false);
  const [settle,setSettle]=useState(0);
  const expandedRef=useRef(expanded);expandedRef.current=expanded;
  const [placement,setPlacement]=useState({above:false,shift:0,pill:0});
  const placed=useRef({above:false,shift:0}),clickTimer=useRef<number|undefined>(undefined),home=useRef<{x:number;y:number;shift:number;above:boolean;opened:{x:number;y:number}}|null>(null),lastSet=useRef<{x:number;y:number}|null>(null);
  const [modal,setModal]=useState<'chat'|'project'|null>(null);
  const [draft,setDraft]=useState(blank);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [project,setProject]=useState<Item|null>(null);
  const [remove,setRemove]=useState<string|null>(null);
  const [loadingError,setLoadingError]=useState(false);
  const [busy,setBusy]=useState(false);
  const [fallback,setFallback]=useState('');
  const drag=useRef<{x:number;y:number;moved:boolean}|null>(null);
  const [caps,setCaps]=useState<{os:string;shortcut_label:string;tray:boolean;shortcut:boolean}|null>(null);
  const [service,setService]=useState<ServiceInfo|null>(null);
  const [pairing,setPairing]=useState(0);
  const [compact,setCompact]=useState(false);
  const searchRef=useRef<HTMLInputElement>(null);
  const importRef=useRef<HTMLInputElement>(null);
  const persistQueue=useRef(Promise.resolve());
  /** Entries deleted here since the last successful save; everything else in storage is kept. */
  const removedIds=useRef<string[]>([]);
  const dataRef=useRef(data); dataRef.current=data;
  // Web chat only for now. The Claude Code and Codex launcher stays in the native code and in
  // saved projects; showing it again is tracked in issue #5.
  const available=providers.filter(p=>p.kind==='web'&&(p.id!=='grok'||data.settings.grok));
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
    // The freshest state is saved, not the one captured when this effect was queued, so a save
    // that lands after the service wrote still carries everything this window knows about.
    persistQueue.current=persistQueue.current.catch(()=>{}).then(async()=>{
      const removed=removedIds.current;
      removedIds.current=[];
      try{await saveData(dataRef.current,removed);}
      catch(failure){removedIds.current=[...removed,...removedIds.current];throw failure;}
    }).catch(()=>setNotice('Your change could not be saved. Export a backup before closing.'));
  },[data,ready]);
  useEffect(()=>{
    if(!notice) return;
    const timer=setTimeout(()=>{setNotice('');setFallback('');},fallback?12000:6000); return()=>clearTimeout(timer);
  },[notice,fallback]);
  useEffect(()=>{if(native)void invoke<typeof caps>('capabilities').then(setCaps).catch(()=>{});},[]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setExpanded(true);setView('find');setTimeout(()=>searchRef.current?.focus({preventScroll:true}),30);}
      if(e.key==='Escape'){if(modal)setModal(null);else if(remove)setRemove(null);else if(project)setProject(null);else setExpanded(false);}
    }; window.addEventListener('keydown',key); return()=>window.removeEventListener('keydown',key);
  },[modal,remove,project]);
  useEffect(()=>{
    if(!native)return;
    void (async()=>{
      const w=getCurrentWindow();
      try{
        // A window opened taller than the screen is maximised by KWin and others, and a maximised
        // window ignores every setSize after it. Start collapsed (tauri.conf.json), and undo it anyway.
        if(await w.isMaximized())await w.unmaximize();
        const m=await currentMonitor();
        const s=m?.scaleFactor??1;
        const area=m?{width:m.workArea.size.width/s,height:m.workArea.size.height/s}:null;
        // A companion should not take over a small screen. Keep the open widget inside a fifth of
        // the work area, holding the design's proportions until it no longer fits.
        const ratio=area?Math.min(1,Math.sqrt(area.width*area.height*FOOTPRINT/(DESIGN.width*DESIGN.height))):1;
        const width=Math.round(clamp(DESIGN.width*ratio,MIN.width,area?Math.min(DESIGN.width,area.width-24):DESIGN.width));
        const open=Math.round(clamp(DESIGN.height*ratio,MIN.height,area?Math.min(DESIGN.height,area.height-24):DESIGN.height));
        const tight=width<COMPACT_WIDTH;
        // Collapsed, only the robot and pill show, so the window shrinks to their height. With the
        // robot off the stage is a flat mark, and the window gives that height back.
        const stage=tight?STAGE.tight:STAGE.normal;
        const relief=data.settings.robot?0:stage-STAGE.flat;
        const height=(expanded?open:(tight?205:DESIGN.collapsed))-relief;
        const before=(await w.outerSize()).toLogical(s),p=(await w.outerPosition()).toLogical(s);
        if(!m||!area){await w.setSize(new LogicalSize(width,height));return;}
        const a=m.workArea,left=a.position.x/s,top=a.position.y/s;
        const stageHeight=stage-relief;
        const reach=(document.querySelector<HTMLElement>('.robot-button')?.offsetWidth??width)*ROBOT_REACH;
        // Anchored on the robot rather than the window, so opening and closing never moves it: the
        // panel opens below or above, and the robot slides sideways instead of off a screen edge.
        const anchor=anchorOf({x:p.x,y:p.y,width:before.width,height:before.height,stage:stageHeight,pad:WINDOW_PAD,...placed.current});
        // Closing returns to exactly where the robot was put, unless the window was dragged while open.
        const back=!expanded&&home.current&&Math.abs(p.x-home.current.opened.x)<2&&Math.abs(p.y-home.current.opened.y)<2?home.current:null;
        const next=back?{x:back.x,y:back.y,above:back.above,shift:back.shift,height}:place({anchor,pad:WINDOW_PAD,width,height,minHeight:Math.min(height,MIN.height-relief),stage:stageHeight,expanded,area:{left,top,right:left+area.width,bottom:top+area.height},reach});
        if(!expanded)home.current=null;
        else if(home.current)home.current.opened={x:next.x,y:next.y};
        else home.current={x:p.x,y:p.y,shift:placed.current.shift,above:placed.current.above,opened:{x:next.x,y:next.y}};
        const limit=Math.max(0,width/2-(tight?PILL_HALF.tight:PILL_HALF.normal));
        placed.current={above:next.above,shift:next.shift};
        setPlacement({...placed.current,pill:Math.max(-limit,Math.min(next.shift,limit))});
        // The window manager keeps a window inside the screen by the size it last saw, so a window that
        // is still tall when moved low gets pushed back up: shrink, wait for the size to land, then move.
        lastSet.current={x:next.x,y:next.y};
        if(next.height<before.height){
          await w.setSize(new LogicalSize(width,next.height));
          for(let i=0;i<15&&Math.abs((await w.outerSize()).toLogical(s).height-next.height)>1;i++)await new Promise(r=>setTimeout(r,16));
          await w.setPosition(new LogicalPosition(next.x,next.y));
        }
        else{await w.setPosition(new LogicalPosition(next.x,next.y));await w.setSize(new LogicalSize(width,next.height));}
      }catch{setNotice('Could not resize the companion.');}
    })();
  },[expanded,data.settings.robot,settle]);
  useEffect(()=>{
    if(!native)return;
    // After the user drags a closed robot, re-check whether its pill still fits below it. Moves this
    // component made itself are ignored, so placing the window never feeds back into another pass.
    let timer:number|undefined;
    const moved=getCurrentWindow().onMoved(({payload})=>{window.clearTimeout(timer);timer=window.setTimeout(async()=>{
      if(expandedRef.current)return;
      const q=payload.toLogical(await getCurrentWindow().scaleFactor()),l=lastSet.current;
      if(!l||Math.abs(q.x-l.x)>=2||Math.abs(q.y-l.y)>=2)setSettle(n=>n+1);
    },250);});
    return()=>{window.clearTimeout(timer);void moved.then(stop=>stop());};
  },[]);
  useEffect(()=>{
    if(!native)return;
    const subscription=listen('open-launcher',()=>{setExpanded(true);setView('find');setTimeout(()=>searchRef.current?.focus({preventScroll:true}),60);});
    return()=>{void subscription.then(unlisten=>unlisten());};
  },[]);
  useEffect(()=>{
    const measure=()=>setCompact(window.innerWidth<COMPACT_WIDTH);
    measure();
    window.addEventListener('resize',measure);
    return()=>window.removeEventListener('resize',measure);
  },[]);
  useEffect(()=>{
    if(!native)return;
    // The tray menu opens the companion straight onto a panel.
    const subscription=listen<View>('open-view',event=>{
      if(!['new','find','projects','settings'].includes(event.payload))return;
      setExpanded(true);setView(event.payload);setProject(null);setQuery('');setFilter('all');
      if(event.payload==='find')setTimeout(()=>searchRef.current?.focus({preventScroll:true}),60);
      if(event.payload==='settings')refreshService();
    });
    return()=>{void subscription.then(unlisten=>unlisten());};
  },[]);
  useEffect(()=>{
    if(!native)return;
    // The browser extension posts to the companion service, which saves to SQLite and then sends
    // the items here. Merging the payload rather than re-reading keeps a concurrent window save
    // from dropping them.
    const subscription=listen<Item[]>('chats-added',event=>{
      const arriving=sanitizeData({items:event.payload}).items;
      if(!arriving.length)return;
      // An arriving entry is either new, or one already saved that the service has just filed under
      // a project — matching by id replaces that one in place, keeping whatever was edited here.
      const fresh=arriving.filter(item=>!dataRef.current.items.some(existing=>same(existing,item)));
      const refiled=arriving.length-fresh.length;
      setData(current=>({...current,items:[...current.items.map(existing=>arriving.find(item=>item.id===existing.id)??existing),...fresh]}));
      const said=[];
      if(fresh.length)said.push(fresh.length===1?`Saved from your browser: ${fresh[0].title}`:`Saved ${describeItems(fresh)} from your browser.`);
      if(refiled)said.push(`Filed ${refiled} ${refiled===1?'chat':'chats'} under ${refiled===1?'its project':'their projects'}.`);
      setNotice(said.join(' '));
    });
    return()=>{void subscription.then(unlisten=>unlisten());};
  },[]);
  const refreshService=()=>{void invoke<ServiceInfo|null>('service_info').then(info=>{setService(info);setPairing(info?.pairing_seconds??0);}).catch(()=>setService(null));};
  useEffect(()=>{if(native)refreshService();},[]);
  useEffect(()=>{
    if(pairing<=0)return;
    // Counts the pairing window down so the panel never claims to be open longer than it is.
    const timer=setInterval(()=>setPairing(left=>{
      if(left<=1){refreshService();return 0;}
      return left-1;
    }),1000);
    return()=>clearInterval(timer);
  },[pairing>0]);
  const updateItems=(fn:(items:Item[])=>Item[])=>setData(current=>({...current,items:fn(current.items)}));
  const navigate=(next:View)=>{setView(next);setExpanded(true);setProject(null);setQuery('');setFilter('all');};
  const tryOpen=async(url:string)=>{try{await openDestination(url);}catch{setNotice('Could not open the link. Check your default browser.');}};
  const openLink=async(raw:string,provider:string)=>{
    const url=validateChatUrl(raw,provider);
    if(!url){setNotice('This link does not match its service.');return false;}
    await tryOpen(url); return true;
  };
  const openItem=async(item:Item)=>{
    if(item.type==='project'){setProject(item);return;}
    if(await openLink(item.url,item.provider)) updateItems(items=>items.map(i=>i.id===item.id?{...i,updated:Date.now()}:i));
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
    const web=providers.find(p=>p.id===provider)?.url||'';
    if(!native){setNotice('Local coding tools launch from the desktop app. Use the web option in this preview.');return;}
    setBusy(true);setFallback('');
    try{const result=await invoke<{status:string;message:string}>('launch_code',{provider,folder});setNotice(result.message);if(result.status!=='launched')setFallback(web);}
    catch(e){setNotice(String(e));setFallback(web);}finally{setBusy(false);}
  };
  const exportData=async()=>{
    const json=JSON.stringify(dataRef.current,null,2);
    if(native){
      try{const path=await invoke<string|null>('export_backup',{json});if(path)setNotice(`Backup saved to ${path}`);}
      catch(e){setNotice(`Could not save the backup: ${e}`);}
      return;
    }
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='orbit-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importData=async(file:File)=>{
    try{
      if(!ready)throw Error('Saved data has not loaded yet.');
      if(file.size>2_000_000)throw Error('Choose a backup smaller than 2 MB.');
      const raw=JSON.parse(await file.text());if(!Array.isArray(raw.items))throw Error('Choose an Orbit backup or chat-saver export.');
      const imported=sanitizeData(raw);if(raw.items.length&&imported.items.length===0)throw Error('No valid chat or project entries were found.');
      setData(current=>{
        const merged=[...current.items];
        for(const item of imported.items){if(!merged.some(existing=>same(existing,item)))merged.push(item);}
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
  return <div className={`${native?`app native${compact?' compact':''}`:'app browser'}${data.settings.robot?'':' flat'}`}>
    {!native&&<><header className="page-header"><a className="brand" href="#"><span className="brand-symbol">◉</span> orbit<span className="version">EARLY BUILD 01</span></a><span className="header-caption">Your AI workspace, within reach.</span><button className="outline-button" onClick={()=>navigate('settings')}><SettingsIcon size={15}/> Preferences</button></header><aside className="intro"><div className="eyebrow"><span/> DESKTOP COMPANION</div><h1>A small robot. <br/>A doorway to <br/><em>all your work.</em></h1><p>Start a conversation, pick up a thread,<br/>or return to your next big idea.</p><div className="intro-rule"/><div className="principles"><span><ShieldCheck size={16}/> Your accounts. Your subscriptions.</span><span><Folder size={16}/> Chats and projects, together.</span><span><Command size={16}/> One shortcut away.</span></div><div className="preview-label"><span className="status-dot"/> Interactive browser preview <small>The floating companion runs in the desktop app.</small></div></aside></>}
    <main className={`companion ${expanded?'expanded':'collapsed'}${placement.above?' above':''}`} style={{'--shift':`${placement.shift}px`,'--pill-shift':`${placement.pill}px`} as CSSProperties}>
      <div className="robot-stage" data-tauri-drag-region><div className="robot-halo"/><button className="robot-button" aria-label={expanded?'Collapse companion':'Open companion'} title={native?`Click to open or close.${caps?.tray?' Double-click to hide in the tray.':''} Drag to move.`:undefined} onMouseDown={e=>{if(native&&e.button===0)drag.current={x:e.screenX,y:e.screenY,moved:false};}} onMouseMove={e=>{const d=drag.current;if(!d||d.moved||Math.abs(e.screenX-d.x)+Math.abs(e.screenY-d.y)<5)return;d.moved=true;void getCurrentWindow().startDragging();}} onClick={e=>{const d=drag.current;drag.current=null;if(d?.moved)return;const tray=native&&!!caps?.tray;window.clearTimeout(clickTimer.current);if(tray&&e.detail>1){void getCurrentWindow().hide();return;}if(expanded){setExpanded(false);return;}clickTimer.current=window.setTimeout(()=>setExpanded(true),tray?DOUBLE_CLICK_MS:0);}}>{data.settings.robot?<Suspense fallback={<span className="robot-glyph" aria-hidden="true">◉</span>}><Robot active={expanded}/></Suspense>:<span className="robot-glyph" aria-hidden="true">◉</span>}</button><span className="robot-caption"><span/> ORBIT / 360</span></div>
      <nav className={`pill ${expanded?'open':''}`} aria-label="Companion actions">{([['new','New chat',Plus],['find','Find',Search],['projects','Projects',Folder]] as const).map(([id,label,Icon])=><button key={id} aria-label={label} className={view===id&&expanded?'selected':''} onClick={()=>view===id&&expanded&&!project?setExpanded(false):navigate(id)}><Icon size={17}/><span>{label}</span></button>)}</nav>
      {expanded&&<section className="panel" onMouseDown={e=>{if(native&&e.button===0&&!(e.target as Element).closest('button,a,input,select,textarea,label,.result-row'))void getCurrentWindow().startDragging();}}>
        <div className="panel-heading"><div><div className="eyebrow">{project?'PROJECT SPACE':view==='settings'?'MAKE IT YOURS':view==='new'?'PICK YOUR NEXT CONVERSATION':'PICK UP WHERE YOU LEFT OFF'}</div><h2>{project?project.title:view==='new'?'Where shall we begin?':view==='find'?'Find your work.':view==='projects'?'Your project spaces.':'Preferences.'}</h2></div><button className="icon-button" aria-label="Collapse panel" onClick={()=>setExpanded(false)}><Minimize2 size={17}/></button></div>
        <div className="panel-body">
        {!ready&&<div className="inline-error">{loadingError?'Saved data could not be loaded. Reload before making changes.':'Loading your workspace…'}</div>}
        {project?<div className="project-detail"><button className="text-button" onClick={()=>setProject(null)}><ArrowLeft size={14}/> All projects</button><p>{project.note||'A home for related chats and coding work.'}</p>{project.folder&&<div className="folder-path"><Folder size={16}/><span>{project.folder}</span>{native&&<button className="icon-button" aria-label="Open project folder" onClick={()=>void invoke('open_folder',{folder:project.folder}).catch(()=>setNotice('Could not open this folder.'))}><ArrowUpRight size={15}/></button>}</div>}<div className="project-actions"><button className="primary-button" onClick={()=>showAdd('chat')} disabled={!ready}><Plus size={15}/> Add related chat</button>{project.url&&<button className="outline-button" onClick={()=>void openLink(project.url,project.provider)}><ArrowUpRight size={15}/> Open project</button>}{['codex','claude-code'].includes(project.provider)&&<button className="outline-button" disabled={busy} onClick={()=>void launchCode(project.provider,project.folder)}><Terminal size={15}/> Open coding tool</button>}</div><div className="section-label">RELATED CHATS <span>{linked.length}</span></div><div className="results">{linked.map(item=><Row item={item} key={item.id}/>)}{!linked.length&&<div className="empty compact-empty">No chats linked yet. Add a chat to keep this project together.</div>}</div></div>
        :view==='new'?<><p className="panel-description">Choose a tool. Continue with your own signed-in account.</p><div className="provider-grid">{available.map(provider=><div className="provider-card" key={provider.id}><button className="provider-launch" onClick={()=>void tryOpen(provider.url)}><span className="provider-mark" style={{color:provider.color}}>{provider.mark}</span><span><strong>{provider.name}</strong><small>{provider.kind==='code'?'Coding workspace':'New conversation'}</small></span><ArrowUpRight size={16}/></button>{provider.kind==='code'&&<button className="local-launch" disabled={busy} onClick={()=>void launchCode(provider.id,'')}><Terminal size={12}/> {native?'Open local terminal':'Local tool · desktop app'}</button>}</div>)}</div><div className="save-callout"><span><MessageSquare size={19}/><span><strong>Already have a conversation?</strong><small>Save its link so you can find it again.</small></span></span><button className="icon-button" aria-label="Save a chat link" disabled={!ready} onClick={()=>showAdd('chat')}><Plus size={19}/></button></div><div className="account-note"><ShieldCheck size={14}/> No API keys. Provider usage limits still apply.</div></>
        :view==='settings'?<div className="preferences"><div className="setting"><span><strong>Show Grok</strong><small>Add Grok to the launcher.</small></span><button role="switch" aria-checked={data.settings.grok} aria-label="Show Grok" disabled={!ready} className={`toggle ${data.settings.grok?'on':''}`} onClick={()=>setData(d=>({...d,settings:{...d.settings,grok:!d.settings.grok}}))}><span/></button></div><div className="setting"><span><strong>3D robot</strong><small>The animated robot. Off leaves a flat mark and never loads the 3D renderer.</small></span><button role="switch" aria-checked={data.settings.robot} aria-label="3D robot" disabled={!ready} className={`toggle ${data.settings.robot?'on':''}`} onClick={()=>setData(d=>({...d,settings:{...d.settings,robot:!d.settings.robot}}))}><span/></button></div><div className="setting"><span><strong>Workspace backup</strong><small>Export your saved links and projects.</small></span><button className="icon-button" aria-label="Export backup" onClick={exportData}><Download size={18}/></button></div><div className="setting"><span><strong>Import saved work</strong><small>Merge a backup or chat-saver export.</small></span><button className="icon-button" disabled={!ready} aria-label="Import backup" onClick={()=>importRef.current?.click()}><Upload size={18}/></button></div>{native&&<div className="setting"><span><strong>Browser extension</strong><small>{!service?'The companion service is not running, so saving from a browser is unavailable.':pairing>0?`Pairing is open for ${pairing}s. Open the Orbit extension and choose Pair with Orbit.`:service.paired.length?`Paired: ${service.paired.map(client=>client.label).join(', ')}. Chats you save in a browser appear here.`:'Pair a browser once, then chats you save there appear here.'}</small></span>{service&&(pairing>0?<button className="outline-button" onClick={()=>{void invoke('stop_pairing').then(()=>{setPairing(0);refreshService();}).catch(()=>setNotice('Could not close pairing.'));}}>Stop</button>:<button className="outline-button" onClick={()=>{void invoke<number>('start_pairing').then(seconds=>{setPairing(seconds);refreshService();setNotice('Pairing is open for 60 seconds. Open the Orbit extension and choose Pair with Orbit.');}).catch(()=>setNotice('Pairing could not be opened.'));}}>Pair a browser</button>)}</div>}{native&&!!service?.paired.length&&<div className="setting"><span><strong>Forget paired browsers</strong><small>Orbit takes a new token, so every browser has to pair again.</small></span><button className="icon-button" aria-label="Forget paired browsers" onClick={()=>{void invoke('unpair_browsers').then(()=>{setPairing(0);refreshService();setNotice('Paired browsers were forgotten.');}).catch(()=>setNotice('Could not forget the paired browsers.'));}}><Trash2 size={18}/></button></div>}<div className="settings-note"><ShieldCheck size={20}/><p>Orbit opens official apps and websites. Sign in there with your existing subscriptions. Your saved links stay on this device.</p></div><div className="shortcut-row"><span>{native?'Global shortcut':'Search shortcut in this window'}</span><kbd>{native?(caps?.shortcut===false?'Unavailable here':caps?.shortcut_label||'Ctrl + Shift + Space'):mac?'⌘ K':'Ctrl + K'}</kbd></div><p className="muted">{native?'Local tools must already be installed and signed in. Orbit removes API-key variables from terminals it launches.':'This preview saves to this browser. The desktop app uses a local SQLite database.'}</p></div>
        :<><div className="search-box"><Search size={18}/><input ref={searchRef} aria-label="Search saved chats and projects" placeholder={view==='projects'?'Search projects…':'Search saved chats and projects…'} value={query} onChange={e=>setQuery(e.target.value)}/>{query?<button className="icon-button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>:<kbd>{mac?'⌘K':'Ctrl K'}</kbd>}</div><div className="filters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All tools</button>{available.map(p=><button key={p.id} className={filter===p.id?'active':''} onClick={()=>setFilter(p.id)}>{p.name}</button>)}</div><div className="section-label">{query?'RESULTS':view==='projects'?'PROJECTS':'SAVED WORK'} <span>{results.length}</span><button onClick={()=>showAdd(view==='projects'?'project':'chat')} disabled={!ready}><Plus size={13}/>{view==='projects'?'New project':'Save chat'}</button></div><div className="results">{results.map(item=><Row item={item} key={item.id}/>)}{!results.length&&<div className="empty"><span className="empty-icon">{view==='projects'?<Folder size={26}/>:<Search size={26}/>}</span><strong>{query||filter!=='all'?'Nothing matches yet.':view==='projects'?'Room for your next idea.':'Your work starts here.'}</strong><p>{query||filter!=='all'?'Try a different name or tool.':view==='projects'?'Create a project and bring its chats together.':'Save a conversation link to find it here later.'}</p>{!query&&filter==='all'&&<button className="outline-button" disabled={!ready} onClick={()=>showAdd(view==='projects'?'project':'chat')}><Plus size={15}/>{view==='projects'?'Create project':'Save your first chat'}</button>}</div>}</div><div className="account-note"><ShieldCheck size={14}/> Searches saved links. Older history stays in each service.</div></>}
        </div>
        <footer className="panel-footer"><span><span className="status-dot"/> {native?'LOCAL WORKSPACE':'BROWSER PREVIEW'}</span><span>{data.items.length} saved <span className="footer-divider">/</span> <button onClick={()=>navigate('settings')}>Settings</button></span></footer>
      </section>}
      {notice&&<div className="toast" role="status"><span>{notice}{fallback&&<> <button className="text-button" onClick={()=>{void tryOpen(fallback);setNotice('');setFallback('');}}>Open web version <ArrowUpRight size={12}/></button></>}</span><button className="icon-button" aria-label="Dismiss message" onClick={()=>{setNotice('');setFallback('');}}><X size={14}/></button></div>}
    </main>
    {!native&&<footer className="page-footer"><span>Built to stay out of your way.</span><span>LOCAL FIRST <span>·</span> SUBSCRIPTION FRIENDLY</span></footer>}
    <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];if(file)void importData(file);}}/>
    {modal&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{modal==='chat'?'Save a conversation':'Create a project'}</h2><button className="icon-button" aria-label="Close dialog" onClick={()=>setModal(null)}><X size={19}/></button></div><form onSubmit={submit}><label>Name<input autoFocus required maxLength={120} value={draft.title} placeholder={modal==='chat'?'e.g. Robot camera design':'e.g. Mini bot firmware'} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>{modal==='project'?'Preferred tool':'Service'}<select value={draft.provider} onChange={e=>setDraft({...draft,provider:e.target.value})}>{available.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{modal==='chat'?<><label>Conversation link<input required type="url" value={draft.url} placeholder="https://…" onChange={e=>setDraft({...draft,url:e.target.value})}/></label><label>Project<select value={draft.projectId} onChange={e=>setDraft({...draft,projectId:e.target.value})}><option value="">No project</option>{data.items.filter(i=>i.type==='project').map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label></>:<label>Local folder <span className="muted">(optional)</span><div className="folder-input"><input value={draft.folder} placeholder={caps?.os==='windows'?'C:\\Projects\\my-robot':caps?.os==='macos'?'/Users/you/Projects/my-robot':'/home/you/projects/my-robot'} onChange={e=>setDraft({...draft,folder:e.target.value})}/>{native&&<button type="button" className="icon-button" aria-label="Choose folder" onClick={()=>void chooseFolder()}><Folder size={18}/></button>}</div></label>}<label>Note <span className="muted">(optional)</span><input maxLength={240} value={draft.note} placeholder="A little context for later" onChange={e=>setDraft({...draft,note:e.target.value})}/></label>{error&&<p className="inline-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="outline-button" onClick={()=>setModal(null)}>Cancel</button><button className="primary-button" type="submit">{modal==='chat'?'Save chat':'Create project'}<ChevronRight size={15}/></button></div></form></section></div>}
    {remove&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Remove saved entry?</h2><p>This removes “{data.items.find(i=>i.id===remove)?.title}” from Orbit. Your original conversation and files remain in their service.</p><div className="form-actions"><button autoFocus className="outline-button" onClick={()=>setRemove(null)}>Keep it</button><button className="primary-button danger" onClick={()=>{removedIds.current=[...removedIds.current,remove];updateItems(items=>items.filter(i=>i.id!==remove).map(i=>i.projectId===remove?{...i,projectId:''}:i));setRemove(null);}}>Remove entry</button></div></section></div>}
  </div>;
}

