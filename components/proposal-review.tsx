'use client';
import {Check,RotateCcw,X} from 'lucide-react';

type Change={operation:'create'|'update'|'archive';item_id:string|null;expected_version:number|null;title:string;visibility:'public'|'internal'|'restricted';body:string};
type Proposal={id:string;summary:string;changes:Change[];status:string;created_at?:string;approved_change_indices?:number[]|null};
type Props={proposal:Proposal;excluded:number[];busy?:boolean;readOnly?:boolean;onExclude?:(index:number)=>void;onRestore?:()=>void;onApprove?:()=>void;onReject?:()=>void};
export function ProposalReview({proposal,excluded,busy=false,readOnly=false,onExclude,onRestore,onApprove,onReject}:Props){
 const pending=proposal.status==='pending'&&!readOnly;
 const approvedIndices=proposal.status==='approved'?proposal.approved_change_indices:null;
 const visible=proposal.changes.map((change,index)=>({change,index})).filter(({index})=>
  pending?!excluded.includes(index):approvedIndices===null||approvedIndices===undefined||approvedIndices.includes(index));
 const excludedCount=pending?excluded.length:approvedIndices?.length!==undefined?proposal.changes.length-approvedIndices.length:0;
 return <section className="panel space-y-4 p-5" aria-label="학습 변경안">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div className="min-w-0 flex-1"><h3 className="font-semibold leading-7">{proposal.status==='rejected'?'거절한 변경안':proposal.status==='approved'?'승인된 변경안':'승인 대기 변경안'}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{proposal.summary}</p></div>
   <span className={`member-status ${proposal.status==='pending'?'pending':proposal.status==='approved'?'approved':'inactive'}`}>{proposal.status==='pending'?'대기':proposal.status==='approved'?'승인됨':'거절됨'}</span>
  </div>
  {pending&&<div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-slate-600">승인 선택 {visible.length} / {proposal.changes.length}건</span>{excludedCount>0&&<button type="button" disabled={busy} className="inline-flex items-center gap-1.5 text-sky-700 hover:underline" onClick={onRestore}><RotateCcw size={15}/>제외한 {excludedCount}건 되돌리기</button>}</div>}
  {proposal.status==='approved'&&excludedCount>0&&<p className="text-sm text-slate-500">총 {proposal.changes.length}건 중 {approvedIndices?.length}건 승인, {excludedCount}건 제외</p>}
  <div className="space-y-3">{visible.map(({change,index})=><article key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
   <div className="mb-3 flex items-start gap-2"><span className="badge shrink-0">{change.operation==='create'?'신규':change.operation==='update'?'수정':'폐기'}</span><strong className="min-w-0 flex-1 break-words text-base">{change.title}</strong><span className="muted text-xs">{change.visibility}</span>{pending&&<button type="button" aria-label={`${change.title} 학습 제외`} title="이 항목 학습 제외" disabled={busy} onClick={()=>onExclude?.(index)} className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><X size={17}/></button>}</div>
   <div className="text-flow whitespace-pre-wrap text-base leading-7">{change.body}</div>
  </article>)}</div>
  {pending&&<div className="flex flex-wrap items-center justify-end gap-2"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onReject}>전체 거절</button><button type="button" className="btn btn-primary" disabled={busy||visible.length===0} onClick={onApprove}><Check size={16}/>선택 {visible.length}건 승인</button></div>}
  {pending&&visible.length===0&&<p className="text-center text-sm text-slate-500">학습할 항목이 없습니다. 제외한 항목을 되돌리거나 변경안을 전체 거절하세요.</p>}
 </section>;
}
