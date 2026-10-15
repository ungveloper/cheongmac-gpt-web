'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {BookOpen,Bot,Check,ChevronDown,Code2,Download,FilePlus,KeyRound,LogOut,Menu,MessageCircle,Plus,Send,Shield,Users,X,Paperclip,FileText} from 'lucide-react';
import {browserDb} from '@/lib/supabase-browser';
import {isKnowledgeChangeRequest} from '@/lib/knowledge-intent.mjs';
import type {Member} from '@/lib/auth';
type ChatMessage={role:'user'|'assistant';content:string;sources?:Source[];failed?:boolean;fileNames?:string[]};
type ChatFile={id:string;name:string;size:number;expires_at:string};
const MAX_FILE=10*1024*1024;
const MAX_TOTAL=20*1024*1024;
const MAX_FILES=3;
type ChatPhase='idle'|'analyzing'|'searching'|'writing';
const phaseLabel:Record<Exclude<ChatPhase,'idle'>,string>={analyzing:'지식 변경안 분석 중',searching:'관련 지식 검색 중',writing:'답변 생성 중'};
type Source={id:string;title:string;version:number;updated_at:string;index:number};
type Change={operation:'create'|'update'|'archive';item_id:string|null;expected_version:number|null;title:string;visibility:'public'|'internal'|'restricted';body:string};
type Proposal={id:string;summary:string;changes:Change[];status:string;created_at?:string};
type Knowledge={id:string;title:string;body:string;visibility:string;updated_at:string;current_version:number};
type ApiClient={id:string;name:string;scope:string;disabled:boolean};
type StoredFile={id:string;original_name:string;byte_size:number;knowledge_id:string|null;upload_status:string};
const titles:Record<string,string>={chat:'AI 채팅',knowledge:'지식 관리',proposals:'승인 대기',files:'파일 보관함',members:'회원 관리',api:'API 관리'};
async function json(path:string,options?:RequestInit){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});const result=await r.json();if(!r.ok)throw new Error(result.message||result.error?.message||result.error||`HTTP ${r.status}`);return result;}
const post=(path:string,data:unknown,method='POST')=>json(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
export function Workspace({member}:{member:Member}){
 const isAdmin=member.role!=='staff',isSuper=member.role==='super_admin';
 const [tab,setTab]=useState('chat'),[menu,setMenu]=useState(false),[chat,setChat]=useState<ChatMessage[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[suggestion,setSuggestion]=useState<Proposal|null>(null);
 const [knowledge,setKnowledge]=useState<Knowledge[]>([]),[proposals,setProposals]=useState<Proposal[]>([]),[members,setMembers]=useState<Member[]>([]),[apps,setApps]=useState<ApiClient[]>([]),[files,setFiles]=useState<StoredFile[]>([]),[name,setName]=useState(''),[scope,setScope]=useState('public'),[issuedKey,setIssuedKey]=useState(''),[filter,setFilter]=useState('');
 const [uploading,setUploading]=useState(false),[phase,setPhase]=useState<ChatPhase>('idle'),[forceEdit,setForceEdit]=useState(false);
 const [pendingFiles,setPendingFiles]=useState<File[]>([]),[chatFiles,setChatFiles]=useState<ChatFile[]>([]);
 const fileInput=useRef<HTMLInputElement>(null);const endRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[chat,suggestion]);
 async function refresh(next=tab){try{
  if(next==='knowledge'){const r=await json('/api/v1/knowledge?limit=50');setKnowledge(r.data||[]);}
  if(next==='proposals'){const r=await json('/api/admin/proposals');setProposals(r.data||[]);}
  if(next==='members'){const r=await json('/api/admin/members');setMembers(r.data||[]);}
  if(next==='api'){const r=await json('/api/admin/apps');setApps(r.data||[]);}
  if(next==='files'){const r=await json('/api/admin/files');setFiles(r.data||[]);}
 }catch(e){setNotice(e instanceof Error?e.message:'목록 조회 실패');}}
 function move(next:string){setTab(next);setMenu(false);setNotice('');void refresh(next);}
 function updateAssistant(patch:Partial<ChatMessage>){
  setChat(items=>{
   const copy=[...items];const last=copy[copy.length-1];
   if(last?.role==='assistant')copy[copy.length-1]={...last,...patch};
   return copy;
  });
 }
 async function stream(text:string,history:ChatMessage[],attachmentIds:string[]){
  setPhase('searching');
  const res=await fetch('/api/v1/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:history.filter(m=>!m.failed).slice(-8).map(m=>({role:m.role,content:m.content.slice(0,2000)})),attachments:attachmentIds})});
  if(!res.ok){
   const problem=await res.json().catch(()=>null);
   const code=problem?.error?.code;
   const descriptions:Record<string,string>={NOT_CONFIGURED:'OpenAI 또는 Supabase 환경변수를 확인해 주세요.',SEARCH_UNAVAILABLE:'지식 검색 서버에 접근할 수 없습니다. 터미널의 오류 로그와 DB 권한을 확인해 주세요.',ATTACHMENT_EXPIRED:'첨부파일이 만료되었습니다. 삭제하고 다시 첨부하세요.',ATTACHMENT_TOO_LARGE:'첨부파일 용량이 제한을 초과했습니다.',RATE_LIMITED:'요청 횟수가 많습니다. 잠시 후 다시 시도해 주세요.',UNAUTHORIZED:'로그인 또는 계정 승인 상태를 확인해 주세요.'};
   throw new Error(descriptions[code]||problem?.error?.message||`질문 처리 오류 (HTTP ${res.status})`);
  }
  if(!res.body)throw new Error('스트리밍을 시작하지 못했습니다.');
  const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='',answerText='',sourceList:Source[]=[],finished=false;
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;
    buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
    let pos:number;
    while((pos=buffer.indexOf('\n\n'))>=0){
     const frame=buffer.slice(0,pos);buffer=buffer.slice(pos+2);
     const event=frame.split('\n').find(x=>x.startsWith('event: '))?.slice(7);
     const raw=frame.split('\n').find(x=>x.startsWith('data: '))?.slice(6);if(!raw)continue;
     const data=JSON.parse(raw);
     if(event==='sources'){sourceList=data.sources||[];setPhase('writing');updateAssistant({sources:sourceList});}
     if(event==='delta'){
      setPhase('writing');answerText+=data.text||'';updateAssistant({content:answerText,sources:sourceList});
     }
     if(event==='error')throw new Error(data.message||'AI 답변 생성에 실패했습니다. 서버 로그를 확인해 주세요.');
     if(event==='done')finished=true;
    }
   }
   if(!finished)throw new Error('답변 스트리밍이 완료되지 않았습니다. 다시 시도해 주세요.');
   if(!answerText.trim())throw new Error('AI가 답변을 생성하지 못했습니다. OpenAI 설정과 터미널 로그를 확인해 주세요.');
   updateAssistant({content:answerText,sources:sourceList});
  }finally{reader.releaseLock();}
 }
 function selectChatFiles(files: FileList | null){
  if(!files)return;
  const incoming=Array.from(files);
  const allowed=/\.(pdf|docx|xlsx|txt|md|png|jpg|jpeg)$/i;
  if(incoming.some(f=>!allowed.test(f.name)||f.size<1||f.size>MAX_FILE)){
   setNotice('PDF·DOCX·XLSX·TXT·MD·PNG·JPG만 첨부할 수 있고, 파일당 최대 10MB입니다.');return;
  }
  const all=[...pendingFiles,...incoming];
  if(all.length+chatFiles.length>MAX_FILES||all.reduce((n,f)=>n+f.size,0)+chatFiles.reduce((n,f)=>n+f.size,0)>MAX_TOTAL){
   setNotice('대화별 최대 3개, 파일 합계 최대 20MB입니다.');return;
  }
  setPendingFiles(all);setNotice('');
 }
 async function uploadChatFiles(files:File[]):Promise<ChatFile[]>{
  const uploaded:ChatFile[]=[];
  try{
   for(const file of files){
    const signed=await post('/api/chat/attachments/sign',{name:file.name,size:file.size,type:file.type});
    const {error}=await browserDb().storage.from(signed.bucket).uploadToSignedUrl(signed.path,signed.token,file,{contentType:signed.contentType});
    if(error)throw error;
    const completed=await post('/api/chat/attachments/complete',{id:signed.id});
    uploaded.push(completed as ChatFile);
   }
   return uploaded;
  }catch(e){
   if(uploaded.length)await post('/api/chat/attachments/delete',{ids:uploaded.map(f=>f.id)}).catch(()=>undefined);
   throw e;
  }
 }
 async function removeChatFile(id:string){
  setChatFiles(files=>files.filter(f=>f.id!==id));
  try{await post('/api/chat/attachments/delete',{ids:[id]});}
  catch{setNotice('서버의 임시 첨부파일 삭제를 확인하지 못했습니다. 만료 파일 정리를 확인해 주세요.');}
 }
 function newConversation(){
  const ids=chatFiles.map(f=>f.id);
  setChat([]);setSuggestion(null);setForceEdit(false);setPendingFiles([]);setChatFiles([]);move('chat');
  if(ids.length)void post('/api/chat/attachments/delete',{ids}).catch(()=>setNotice('임시 파일의 서버 삭제를 확인하지 못했습니다. 자동 만료 정리를 확인해 주세요.'));
 }
 async function send(){
  const text=draft.trim()||(pendingFiles.length||chatFiles.length?'첨부파일 내용을 요약해 주세요.':'');
  if(!text||busy)return;
  const analyze=isAdmin&&(forceEdit||isKnowledgeChangeRequest(text));
  if(analyze&&(pendingFiles.length||chatFiles.length)){
   setNotice('채팅 첨부파일은 임시 참고자료이며 지식 변경안에 자동 반영되지 않습니다. 파일 내용을 확인한 뒤 첨부를 제거하고 명시적인 지식 변경 요청을 제출해 주세요.');return;
  }
  setBusy(true);setPhase(analyze?'analyzing':'searching');setDraft('');setNotice('');setSuggestion(null);setForceEdit(false);
  const history=chat.filter((m,i)=>!m.failed&&!(m.role==='user'&&chat[i+1]?.failed));
  const selectedNames=[...chatFiles.map(f=>f.name),...pendingFiles.map(f=>f.name)];
  setChat(items=>[...items,{role:'user' as const,content:text,fileNames:selectedNames},{role:'assistant' as const,content:''}]);
  try{
   if(analyze){
    const outcome=await post('/api/admin/assist',{message:text});
    if(outcome.kind==='proposal'){
     setSuggestion(outcome.proposal);
     updateAssistant({content:`변경안을 제안했습니다. ${outcome.proposal.summary}\n아래 변경 내용을 확인하고 승인하거나 거절할 수 있습니다.`});
     return;
    }
   }
   let all=chatFiles;
   if(pendingFiles.length){
    setPhase('searching');
    const added=await uploadChatFiles(pendingFiles);
    all=[...chatFiles,...added];setChatFiles(all);setPendingFiles([]);
   }
   await stream(text,history,all.map(f=>f.id));
  }catch(e){
   const detail=e instanceof Error?e.message:'요청 처리 중 오류가 발생했습니다.';
   updateAssistant({content:`요청을 완료하지 못했습니다. ${detail}`,failed:true});
   setNotice(detail);
  }finally{setBusy(false);setPhase('idle');}
 }
 async function decide(p:Proposal,action:'approve'|'reject'){setBusy(true);try{const r=await post('/api/admin/proposals/approve',{id:p.id,action});setSuggestion(null);setNotice(action==='approve'?`승인 완료 (${r.changes?.length||0}건)${r.warning?' · '+r.warning:''}`:'변경안을 거절했습니다.');if(tab==='proposals')await refresh('proposals');}catch(e){setNotice(e instanceof Error?e.message:'승인 처리 실패');}finally{setBusy(false);}}
 async function changeMember(m:Member,patch:Record<string,unknown>){try{await post('/api/admin/members',{id:m.id,...patch},'PATCH');await refresh('members');}catch(e){setNotice(e instanceof Error?e.message:'권한 변경 실패');}}
 async function newKey(){try{const r=await post('/api/admin/apps',{name,scope,expires_at:null});setIssuedKey(r.key);setName('');await refresh('api');}catch(e){setNotice(e instanceof Error?e.message:'키 발급 실패');}}
 async function upload(f:File){setUploading(true);setNotice('');try{const signed=await post('/api/admin/files/sign',{name:f.name,size:f.size,type:f.type||'application/octet-stream'});const {error}=await browserDb().storage.from(signed.bucket).uploadToSignedUrl(signed.path,signed.token,f,{contentType:f.type});if(error)throw error;await post('/api/admin/files/complete',{id:signed.id});setNotice('원본 파일이 안전하게 저장되었습니다. 지식 항목 ID에 연결하면 권한별 다운로드가 가능합니다.');await refresh('files');}catch(e){setNotice(e instanceof Error?e.message:'업로드 실패');}finally{setUploading(false);}}
 const navigation=[{id:'chat',icon:MessageCircle},{id:'knowledge',icon:BookOpen},...(isAdmin?[{id:'proposals',icon:Check},{id:'files',icon:FilePlus}]:[]),...(isSuper?[{id:'members',icon:Users},{id:'api',icon:KeyRound}]:[])];
 return <div className="flex min-h-screen bg-[#f6f8fb]">
  {menu&&<button aria-label="메뉴 닫기" onClick={()=>setMenu(false)} className="fixed inset-0 z-20 bg-slate-900/30 md:hidden"/>}
  <aside className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-slate-200 bg-white p-5 shadow-sm transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${menu?'translate-x-0':'-translate-x-full'}`}>
   <div className="mb-10 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-700 text-xl text-white">✳</div><div><div className="font-bold tracking-tight">MacGPT</div><div className="muted text-[11px]">청맥병원 AI Workspace</div></div></div><button onClick={()=>setMenu(false)} className="md:hidden"><X size={18}/></button></div>
   <button className="btn btn-primary mb-5 w-full" disabled={busy} onClick={newConversation}><Plus size={15}/> 새 대화</button>
   <p className="muted mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest">Workspace</p>
   <nav className="space-y-1">{navigation.map(n=>{const Icon=n.icon;return <button key={n.id} onClick={()=>move(n.id)} className={`nav-tab text-sm ${tab===n.id?'active font-semibold':''}`}><Icon size={17}/>{titles[n.id]}</button>;})}</nav>
   <div className="mt-auto border-t border-slate-100 pt-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">{(member.display_name||member.email).slice(0,1).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{member.display_name||member.email}</div><div className="muted text-xs">{member.role==='super_admin'?'최종관리자':member.role==='admin'?'관리자':'일반 직원'}</div></div></div><form action="/logout" method="post" className="mt-4"><button className="nav-tab text-sm"><LogOut size={16}/> 로그아웃</button></form></div>
  </aside>
  <div className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur md:px-10"><div className="flex items-center gap-3"><button className="md:hidden" onClick={()=>setMenu(true)} aria-label="메뉴 열기"><Menu size={21}/></button><h2 className="font-semibold">{titles[tab]}</h2><span className="hidden rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-800 sm:inline">승인 지식 기반</span></div><div className="flex items-center gap-3 text-xs"><Shield size={16} className="text-sky-700"/><span className="muted">{member.role==='staff'?'공개 + 원내':'전체 지식 접근'}</span></div></header>
   {notice&&<div className="mx-5 mt-5 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:mx-10"><span className="text-flow">{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
   {tab==='chat'&&<div className="mx-auto flex h-[calc(100dvh-72px)] w-full max-w-4xl flex-col px-4 sm:px-8"><div className="scroll-hide flex-1 space-y-6 overflow-y-auto py-8">
    {chat.length===0&&<div className="flex min-h-[55vh] flex-col items-center justify-center text-center"><div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-sky-100 text-sky-700"><Bot size={30}/></div><h1 className="mb-3 text-3xl font-semibold tracking-tight">무엇을 도와드릴까요?</h1><p className="muted max-w-md leading-7">승인된 병원 업무 규정과 매뉴얼을 기반으로 답변합니다.{isAdmin?' 관리자는 대화로 지식 수정안을 만들고 승인할 수 있습니다.':''}</p><div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">{['현재 등록된 지식은 무엇인가요?','원내 규정 관련 도움을 받고 싶어요',...(isAdmin?['새로운 지식을 등록하고 싶어요','기존 지식을 수정해 줘']:[])].map(x=><button onClick={()=>setDraft(x)} className="rounded-xl border border-slate-200 bg-white p-4 text-left text-sm hover:border-sky-400" key={x}>{x}</button>)}</div></div>}
    {chat.map((m,i)=><div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[95%] ${m.role==='user'?'bubble-user sm:max-w-[75%]':'bubble-ai w-full'}`}><div className="text-flow text-sm leading-7">{m.content || (busy&&phase!=='idle'?<span role="status" aria-label={phaseLabel[phase]} className="chat-typing" aria-live="polite"><i/><i/><i/></span>:'')} {busy&&i===chat.length-1&&m.role==='assistant'&&m.content&&!m.failed&&<span className="chat-stream-dot" aria-hidden="true">●</span>}</div>{m.fileNames&&m.fileNames.length>0&&<div className="mt-2 flex flex-wrap gap-1">{m.fileNames.map((name,k)=><span key={k} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/70 px-2 py-1 text-xs"><FileText size={12}/>{name}</span>)}</div>}{m.failed&&<button type="button" className="btn btn-secondary mt-3" disabled={busy} onClick={()=>setDraft(chat[i-1]?.role==='user'?(chat[i-1]?.content||''):'')}>질문 다시 입력</button>}{m.sources&&m.sources.length>0&&<details className="mt-4 border-t border-slate-100 pt-3"><summary className="muted cursor-pointer text-xs">근거 지식 보기 ({m.sources.length})</summary><div className="mt-2 space-y-1">{m.sources.map(s=><div className="text-xs" key={s.id}>[{s.index}] {s.title} · v{s.version} · {new Date(s.updated_at).toLocaleDateString('ko-KR')}</div>)}</div></details>}</div></div>)}
    {suggestion&&<div className="panel space-y-4 p-5"><div className="flex items-center gap-2 font-semibold"><Check size={18} className="text-sky-700"/> 승인 대기 변경안</div><p className="text-sm">{suggestion.summary}</p>{suggestion.changes.map((c,i)=><div className="rounded-lg border border-slate-200 p-4" key={i}><div className="mb-2 flex flex-wrap items-center gap-2"><span className="badge">{c.operation==='create'?'신규':c.operation==='update'?'수정':'폐기'}</span><strong className="text-sm">{c.title}</strong><span className="muted text-xs">{c.visibility}</span></div><div className="text-flow max-h-36 overflow-y-auto text-xs leading-6">{c.body}</div></div>)}<div className="flex justify-end gap-2"><button className="btn btn-secondary" disabled={busy} onClick={()=>void decide(suggestion,'reject')}>거절</button><button className="btn btn-primary" disabled={busy} onClick={()=>void decide(suggestion,'approve')}>변경 승인</button></div></div>}
    <div ref={endRef}/></div><div className="pb-6 pt-3"><form onSubmit={e=>{e.preventDefault();void send();}} className="panel p-3 shadow-sm">{(chatFiles.length>0||pendingFiles.length>0)&&<div className="mb-3 flex flex-wrap gap-2">{chatFiles.map(file=><span key={file.id} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs" title="현재 대화에서 2시간 동안 유지됩니다"><FileText size={14}/><span className="max-w-40 truncate">{file.name}</span><button type="button" disabled={busy} aria-label={`${file.name} 첨부 해제`} onClick={()=>void removeChatFile(file.id)}><X size={14}/></button></span>)}{pendingFiles.map((file,i)=><span key={`${file.name}-${i}`} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs" title="메시지를 보내면 업로드됩니다"><FileText size={14}/><span className="max-w-40 truncate">{file.name}</span><button type="button" disabled={busy} aria-label={`${file.name} 선택 취소`} onClick={()=>setPendingFiles(p=>p.filter((_,j)=>j!==i))}><X size={14}/></button></span>)}</div>}<div className="flex items-end gap-2"><input ref={fileInput} type="file" className="hidden" multiple disabled={busy} accept=".pdf,.docx,.xlsx,.txt,.md,.png,.jpg,.jpeg" onChange={e=>{selectChatFiles(e.target.files);e.target.value='';}}/><button type="button" className="rounded-xl p-3 text-slate-500 hover:bg-slate-100" disabled={busy||pendingFiles.length+chatFiles.length>=MAX_FILES} aria-label="채팅에 파일 첨부" title="파일 첨부" onClick={()=>fileInput.current?.click()}><Paperclip size={19}/></button><textarea className="max-h-40 min-h-12 flex-1 resize-none rounded-lg border-0 p-3 text-sm leading-6" disabled={busy} placeholder={isAdmin?'질문 또는 새로운 지식 등록·수정을 요청해 보세요':'업무 관련 질문을 입력하세요'} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}}/><button type="submit" disabled={busy||(!draft.trim()&&!pendingFiles.length&&!chatFiles.length)} aria-label="메시지 보내기" className="btn btn-primary mb-1">{busy?<span className="chat-typing chat-typing-light" aria-label="처리 중"><i/><i/><i/></span>:<Send size={17}/>}</button></div></form><p className="muted mt-2 px-2 text-[11px]">파일은 현재 대화에서 최대 2시간 동안 참고하며 공식 지식으로 자동 등록되지 않습니다. · PDF, DOCX, XLSX, TXT, MD, PNG, JPG · 10MB/파일</p>{isAdmin&&<div className="mt-2 flex justify-start px-1"><button type="button" aria-pressed={forceEdit} disabled={busy} onClick={()=>setForceEdit(v=>!v)} className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${forceEdit?'bg-sky-100 font-semibold text-sky-800':'muted hover:bg-white'}`}>{forceEdit?'✓ 지식 변경 모드 켜짐':'지식 변경 모드 (필요 시 선택)'}</button></div>}<p className="muted mt-3 text-center text-[11px]">의학적 판단은 의료진과 확인하세요. 주민등록번호 등 민감정보는 입력하지 마세요. · 대화 기록은 이 탭에만 보관됩니다.</p></div></div>}
   {tab!=='chat'&&<main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-5 py-8 md:px-10">
    {tab==='knowledge'&&<><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">등록된 지식</h2><p className="muted mt-1 text-sm">게시 중인 최신 지식 목록입니다.</p></div><button className="btn btn-secondary" onClick={()=>void refresh('knowledge')}>새로고침</button></div><input className="input" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="제목 또는 본문 검색"/><div className="space-y-3">{knowledge.filter(k=>(k.title+k.body).includes(filter)).map(k=><details key={k.id} className="panel p-5"><summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3"><strong>{k.title}</strong><span className="flex items-center gap-2 text-xs"><span className="badge">{k.visibility}</span><span className="muted">v{k.current_version}</span><ChevronDown size={14}/></span></summary><p className="text-flow mt-4 whitespace-pre-wrap text-sm leading-7">{k.body}</p><p className="muted mt-4 text-xs">ID: {k.id} · {new Date(k.updated_at).toLocaleDateString('ko-KR')}</p></details>)}{!knowledge.length&&<Empty>등록된 지식이 없습니다. 관리자가 채팅으로 첫 지식을 등록해 보세요.</Empty>}</div></>}
    {tab==='proposals'&&<><Heading title="변경안 승인" desc="AI가 작성한 수정안을 확인한 후 승인 또는 거절합니다."/><div className="space-y-4">{proposals.map(p=><div className="panel space-y-4 p-5" key={p.id}><div className="flex flex-wrap justify-between gap-3"><strong>{p.summary}</strong><span className="badge">{p.status}</span></div>{p.changes.map((c,i)=><div className="rounded-lg bg-slate-50 p-3" key={i}><strong className="text-sm">{c.operation} · {c.title} · {c.visibility}</strong><p className="text-flow mt-2 max-h-40 overflow-auto text-xs">{c.body}</p></div>)}{p.status==='pending'&&<div className="flex justify-end gap-2"><button className="btn btn-secondary" onClick={()=>void decide(p,'reject')}>거절</button><button className="btn btn-primary" onClick={()=>void decide(p,'approve')}>승인</button></div>}</div>)}{!proposals.length&&<Empty>변경 요청이 없습니다.</Empty>}</div></>}
    {tab==='files'&&<><Heading title="첨부파일 보관함" desc="파일은 비공개 Supabase Storage에 직접 업로드됩니다. 공식 지식에 연결해야 다운로드 권한이 부여됩니다."/><label className="panel flex cursor-pointer flex-col items-center gap-3 border-dashed p-9 text-center"><FilePlus className="text-sky-700" size={32}/><strong>{uploading?'업로드 중...':'PDF · DOCX · XLSX · TXT · 이미지 업로드'}</strong><span className="muted text-xs">파일당 최대 50MB · 관리자 전용</span><input className="hidden" type="file" disabled={uploading} accept=".pdf,.docx,.xlsx,.txt,.md,.png,.jpg,.jpeg" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value='';}}/></label><div className="space-y-3">{files.map(f=><div className="panel flex flex-wrap items-center justify-between gap-4 p-4" key={f.id}><div><div className="font-semibold text-sm">{f.original_name}</div><div className="muted text-xs">{Math.round(f.byte_size/1024)} KB · {f.upload_status}</div></div><div className="flex items-center gap-2">{f.knowledge_id?<span className="badge">지식 연결됨</span>:<button className="btn btn-secondary" onClick={async()=>{const id=window.prompt('연결할 승인 지식의 ID (UUID)를 입력하세요');if(id){try{await post('/api/admin/files',{id:f.id,knowledge_id:id},'PATCH');void refresh('files');}catch(e){setNotice(String(e));}}}}>지식 연결</button>}{f.knowledge_id&&<button className="btn btn-secondary" onClick={async()=>{try{const r=await json(`/api/files/${f.id}`);window.open(r.url,'_blank','noopener,noreferrer');}catch(e){setNotice(String(e));}}}><Download size={14}/></button>}</div></div>)}{!files.length&&<Empty>등록된 파일이 없습니다.</Empty>}</div><p className="muted text-xs">파일은 원본 보관 기능이며 PDF/Word/Excel의 자동 텍스트 추출은 후속 구현 범위입니다. 업로드만으로 AI 지식이 게시되지 않습니다.</p></>}
    {tab==='members'&&<><Heading title="회원 승인 및 권한" desc="Google 계정으로 신청한 직원의 원내 접근을 승인합니다."/><div className="panel divide-y divide-slate-100">{members.map(m=><div key={m.id} className="flex flex-wrap items-center gap-4 p-4"><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{m.display_name||m.email}</div><div className="muted truncate text-xs">{m.email}</div></div><span className="badge">{m.approved?'승인':'대기'}</span><select value={m.role} className="input !w-auto text-xs" onChange={e=>void changeMember(m,{role:e.target.value})}><option value="staff">직원</option><option value="admin">관리자</option><option value="super_admin">최종관리자</option></select><button className="btn btn-secondary" onClick={()=>void changeMember(m,{approved:!m.approved})}>{m.approved?'승인 취소':'승인'}</button><button className="btn btn-secondary" onClick={()=>void changeMember(m,{active:!m.active})}>{m.active?'정지':'활성화'}</button></div>)}</div></>}
    {tab==='api'&&<><Heading title="외부 API 관리" desc="홈페이지 서버와 외부 앱에 발급할 API 키를 관리합니다. 브라우저 코드에는 넣지 마세요."/><div className="panel space-y-4 p-5"><h3 className="font-semibold">새 애플리케이션 등록</h3><input className="input" placeholder="앱 이름 (예: 청맥병원 홈페이지 서버)" value={name} onChange={e=>setName(e.target.value)}/><select className="input" value={scope} onChange={e=>setScope(e.target.value)}><option value="public">공개 지식</option><option value="internal">원내 지식 (직원 인증 추가 필요)</option></select><button className="btn btn-primary" disabled={name.trim().length<2} onClick={()=>void newKey()}><KeyRound size={15}/> 키 발급</button>{issuedKey&&<div className="rounded-lg border border-amber-300 bg-amber-50 p-4"><strong className="text-sm">한 번만 표시되는 API 키</strong><div className="text-flow mt-2 font-mono text-xs">{issuedKey}</div><button className="btn btn-secondary mt-3" onClick={()=>navigator.clipboard.writeText(issuedKey)}>복사</button></div>}</div><div className="panel divide-y divide-slate-100">{apps.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><strong className="text-sm">{a.name}</strong><p className="muted text-xs">{a.scope} · {a.id}</p></div><button className="btn btn-secondary" onClick={async()=>{try{await post('/api/admin/apps',{id:a.id,disabled:!a.disabled},'PATCH');await refresh('api');}catch(e){setNotice(String(e));}}}>{a.disabled?'다시 활성화':'키 비활성화'}</button></div>)}</div><a href="/api-docs" className="btn btn-secondary"><Code2 size={15}/> Swagger API 문서</a></>}
   </main>}
  </div>
 </div>;
}
function Empty({children}:{children:ReactNode}){return <div className="panel muted py-16 text-center text-sm">{children}</div>;}
function Heading({title,desc}:{title:string;desc:string}){return <div><h2 className="text-2xl font-bold">{title}</h2><p className="muted mt-2 text-sm">{desc}</p></div>;}
