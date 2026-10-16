'use client';
import {Check,RotateCcw,X,Search} from 'lucide-react';
import {useState} from 'react';

type Change={operation:'create'|'update'|'archive';item_id:string|null;expected_version:number|null;title:string;visibility:'public'|'internal'|'restricted';body:string};
type Proposal={id:string;summary:string;changes:Change[];status:string;created_at?:string;approved_change_indices?:number[]|null;source_manifest?:{source_chars:number;covered_chars:number;atomic_fact_count?:number;coverage_complete:boolean;facts?:Array<{evidence:string;context:string;start:number;end:number}>;evidence?:string;context?:string;review_mode?:string}|null};
type Props={proposal:Proposal;excluded:number[];busy?:boolean;readOnly?:boolean;checked?:boolean;onToggle?:()=>void;onExclude?:(index:number)=>void;onRestore?:()=>void;onApprove?:()=>void;onReject?:()=>void};
export function ProposalReview({proposal,excluded,busy=false,readOnly=false,checked=false,onToggle,onExclude,onRestore,onApprove,onReject}:Props){
 const [query,setQuery]=useState('');
 const [showAll,setShowAll]=useState(false);
 const pending=proposal.status==='pending'&&!readOnly;
 const approvedIndices=proposal.status==='approved'?proposal.approved_change_indices:null;
 const visible=proposal.changes.map((change,index)=>({change,index})).filter(({index})=>
  pending?!excluded.includes(index):approvedIndices===null||approvedIndices===undefined||approvedIndices.includes(index));
 const excludedCount=pending?excluded.length:approvedIndices?.length!==undefined?proposal.changes.length-approvedIndices.length:0;
 const filtered=visible.filter(({change})=>!query.trim()||(change.title+' '+change.body).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <section className="panel space-y-4 p-5" aria-label="학습 변경안">
  {pending&&proposal.source_manifest?.review_mode==='atomic_fact'&&onToggle&&
   <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm font-semibold text-slate-700">
    <input type="checkbox" className="h-5 w-5 shrink-0 accent-sky-700" disabled={busy} checked={checked} onChange={onToggle} aria-label={`${proposal.changes[0]?.title||'독립 사실'} 학습 선택`}/>
    <span>이 사실 학습 선택</span>
   </label>}
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div className="min-w-0 flex-1"><h3 className="font-semibold leading-7">{proposal.status==='rejected'?'거절한 변경안':proposal.status==='approved'?'승인된 변경안':'승인 대기 변경안'}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{proposal.summary}</p></div>
   <span className={`member-status ${proposal.status==='pending'?'pending':proposal.status==='approved'?'approved':'inactive'}`}>{proposal.status==='pending'?'대기':proposal.status==='approved'?'승인됨':'거절됨'}</span>
  </div>
  {proposal.source_manifest?.coverage_complete&&<p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">원문 전체 구간 기록: {proposal.source_manifest.covered_chars.toLocaleString('ko-KR')} / {proposal.source_manifest.source_chars.toLocaleString('ko-KR')}자 · {proposal.source_manifest.atomic_fact_count??proposal.changes.length}개 독립 사실 · 원문 보존 확인 (내용의 의학적 정확성은 별도 검토 필요)</p>}
  {pending&&<div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-slate-600">승인 선택 {visible.length} / {proposal.changes.length}건</span>{excludedCount>0&&<button type="button" disabled={busy} className="inline-flex items-center gap-1.5 text-sky-700 hover:underline" onClick={onRestore}><RotateCcw size={15}/>제외한 {excludedCount}건 되돌리기</button>}</div>}
  {proposal.status==='approved'&&excludedCount>0&&<p className="text-sm text-slate-500">총 {proposal.changes.length}건 중 {approvedIndices?.length}건 승인, {excludedCount}건 제외</p>}
  {proposal.source_manifest?.review_mode==='atomic_fact'&&<p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">독립 지식 1건 — 승인하면 별도 지식 ID가 생성됩니다. <span className="block mt-1 text-slate-600">근거: {proposal.source_manifest.evidence}</span></p>}
  {proposal.changes.length>8&&<div className="flex flex-wrap items-center gap-2"><label className="input member-search-field flex min-w-44 flex-1 items-center gap-2"><Search size={16} className="shrink-0 text-slate-500"/><input className="member-search-textbox min-w-0 flex-1 bg-transparent text-sm" aria-label="변경안 항목 검색" placeholder="검토 항목 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" className="btn btn-secondary" onClick={()=>setShowAll(value=>!value)}>{showAll?'간략히 보기':'본문 모두 펼치기'}</button><span className="text-xs text-slate-500">검색 결과 {filtered.length} / {visible.length}건 · 승인 선택은 전체 항목 기준</span></div>}
  <div className="space-y-3">{filtered.map(({change,index})=><article key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
   <div className="mb-3 flex items-start gap-2"><span className="badge shrink-0">{change.operation==='create'?'신규':change.operation==='update'?'수정':'폐기'}</span><strong className="min-w-0 flex-1 break-words text-base">{change.title}</strong><span className="muted text-xs">{change.visibility}</span>{pending&&<button type="button" aria-label={`${change.title} 학습 제외`} title="이 항목 학습 제외" disabled={busy} onClick={()=>proposal.source_manifest?.review_mode==='atomic_fact'?onReject?.():onExclude?.(index)} className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><X size={17}/></button>}</div>
   {proposal.source_manifest?.facts?.[index]&&<details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer hover:text-sky-700">원문 근거 보기</summary><div className="text-flow mt-2 rounded-lg border border-slate-200 bg-white p-2">{proposal.source_manifest.facts[index].evidence}</div></details>}{proposal.changes.length>8&&!showAll?<details className="group/details"><summary className="cursor-pointer text-sm font-medium text-sky-700">개별 사실 펼치기 ({change.body.length.toLocaleString('ko-KR')}자)</summary><div className="text-flow mt-3 whitespace-pre-wrap text-base leading-7">{change.body}</div></details>:<div className="text-flow whitespace-pre-wrap text-base leading-7">{change.body}</div>}
  </article>)}</div>
  {pending&&<div className="flex flex-wrap items-center justify-end gap-2"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onReject}>전체 거절</button><button type="button" className="btn btn-primary" disabled={busy||visible.length===0} onClick={onApprove}><Check size={16}/>선택 {visible.length}건 승인</button></div>}
  {pending&&visible.length===0&&<p className="text-center text-sm text-slate-500">학습할 항목이 없습니다. 제외한 항목을 되돌리거나 변경안을 전체 거절하세요.</p>}
 </section>;
}
