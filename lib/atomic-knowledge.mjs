/** Atomic, source-grounded knowledge drafts. No model paraphrasing and no arbitrary item-count cap.
 * Facts carry exact evidence spans and contextual headings; no content is discarded silently.
 * Note: sentence splitting does not establish medical truth. All items still require review.
 */
const headingPattern=/^\s*(?:\d+(?:-\d+)?\.\s+.{2,110}|\[[^\]]{2,60}\]|[✔✓]\uFE0F?\s+.{2,100})$/u;
function normalizeSpace(s){return s.replace(/\s+/g,' ').trim();}
function headLabel(value){return normalizeSpace(value.replace(/^\s*(?:\d+(?:-\d+)?\.\s*|[✔✓]\uFE0F?\s*)/u,'')).slice(0,100);}
function isInstruction(s){return /^(?:위 내용을?\s*학습|첨부(?:한)?\s*파일을?\s*(?:학습|분석)|최종\s*승인\s*전|(?:문서에 없는|파일에서 확인되지 않은)\s*내용)/u.test(s.trim());}
function splitStatements(raw){
 // Preserve exact offsets. Never split decimals, abbreviations, telephone numbers or numbered lists.
 const boundaries=[0];
 for(let i=0;i<raw.length-1;i++){
  const c=raw[i],next=raw[i+1];
  if((c==='.'||c==='!'||c==='?'||c==='。')&&/\s/u.test(next)&&!(c==='.'&&/\d/u.test(raw[i-1]||''))) {
   const part=raw.slice(boundaries.at(-1),i+1).trim();
   if(part.length>=8)boundaries.push(i+1);
  }
 }
 boundaries.push(raw.length);
 return boundaries.slice(0,-1).map((start,i)=>({start,end:boundaries[i+1],raw:raw.slice(start,boundaries[i+1])})).filter(item=>item.raw.length);
}
function labelFor(claim,context,ordinal){
 const c=normalizeSpace(claim).replace(/^[ㆍ•·\-*]\s*/u,'').replace(/^\d+[.)]\s*/, '');
 const meaningful=c.length>55?c.slice(0,52)+'…':c;
 return (context?context+' · '+meaningful:meaningful||`사실 ${ordinal}`).slice(0,200);
}
function statementFor(raw,context){
 let claim=normalizeSpace(raw);
 claim=claim.replace(/^[ㆍ•·\-*]\s*/u,'').trim();
 // A medical staff credential without its subject becomes ambiguous: prefix exact heading context.
 if(/(?:원장님|전문의)/.test(context)&&/^[-ㆍ•·]/u.test(raw.trim())){
  const doctor=context.match(/([^\s·>]+\s*원장님)/u)?.[1];
  if(doctor)claim=`${doctor}: ${claim}`;
 }else if(/관련 영문 용어/.test(context)&&/^[ㆍ•·]/u.test(raw.trim())){
  claim=`${context.replace(' > 관련 영문 용어','')} 영문 용어: ${claim}`;
 }
 // Split explicitly parallel claims into three independent, context-complete statements.
 const audiences=claim.match(/^오늘날 청맥병원은 (.+?(?:에게는|에는) .+?),\s*(.+?(?:에게는|에는) .+?),\s*(.+?(?:에게는|에는) .+?)으로 자리하고 있습니다\.$/u);
 if(audiences)return audiences.slice(1).map(part=>({text:`오늘날 청맥병원은 ${part}으로 자리하고 있습니다.`,evidence:claim}));
 // Two separate administrative facts in a single line remain separately editable.
 if(/^대표 전화:\s*/u.test(claim)&&/\(FAX\s/u.test(claim)){
  const parts=claim.match(/^대표 전화:\s*(.*?)\s*\(FAX\s*(.*?)\)$/u);
  if(parts)return [{text:`대표 전화: ${parts[1]}`,evidence:claim},{text:`팩스: ${parts[2]}`,evidence:claim}];
 }
 if(/^진료 시간:\s*/u.test(claim)&&claim.includes(' / ')){
  return claim.split(' / ').map((part,i)=>({text:i?part:`${part}`,evidence:claim}));
 }
 // Marketing identity must be framed as a brand expression, not a geographical fact.
 if(/^대한민국 혈관특별시[,，]/u.test(claim)){
  const end=claim.indexOf(',');
  if(end>=0)return [{text:`청맥병원 브랜드 표현: “${claim.slice(0,end).trim()}”`,evidence:claim.slice(0,end+1)},{text:claim.slice(end+1).trim(),evidence:claim.slice(end+1).trim()}].filter(v=>v.text.length>2);
 }
 return [{text:claim,evidence:claim}];
}
export function extractAtomicFacts(source,{maxFactChars=11000}={}){
 if(typeof source!=='string'||!source.trim())throw new Error('ATOMIC_SOURCE_EMPTY');
 if(!Number.isSafeInteger(maxFactChars)||maxFactChars<256||maxFactChars>12000)throw new Error('ATOMIC_MAX_BODY_INVALID');
 const lines=[...source.matchAll(/[^\n]*(?:\n|$)/g)].filter(m=>m[0].length>0);
 const tocStart=source.indexOf('[목차]');
 const bodyStart=tocStart>=0?source.lastIndexOf('\n1. 청맥병원 기본 정보'):-1;
 const fragments=[];const facts=[];
 let context='',inToc=false,ordinal=0;
 function register(kind,from,to,reason){
  if(to<=from)return;
  fragments.push({kind,start:from,end:to,...(reason?{reason}:{})});
 }
 for(const m of lines){
  const text=m[0],start=m.index,nonNewline=text.replace(/\n$/,'');
  const stripped=nonNewline.trim();
  if(!stripped){register('context',start,start+text.length,'whitespace');continue;}
  if(/^(?:청맥 브랜드북|작성일:|작성자:)/u.test(stripped)){register('context',start,start+text.length,'document_metadata');continue;}
  if(/^\[목차\]$/u.test(stripped)){inToc=true;register('context',start,start+text.length,'table_of_contents');continue;}
  if(inToc&&bodyStart>=0&&start<bodyStart){register('context',start,start+text.length,'table_of_contents');continue;}
  if(inToc&&start>=bodyStart)inToc=false;
  const isDoctor=/^(.+?원장님)\s*\|\s*(.+?전문의)$/u.test(stripped);
  const isHeading=(headingPattern.test(stripped)&&(!/^\d+[.)]\s/u.test(stripped)||/^(?:1-|1\.\s+청맥병원)/.test(stripped)))||isDoctor||/^(?:메타 제목|메타 설명|메타태그|관련 영문 용어|대표 증상|청맥병원 의료진 \| 데이터베이스)$/u.test(stripped);
  if(isHeading){
   if(isDoctor){context=`의료진 · ${stripped.split('|')[0].trim()}`;}
   else if(/^1-\d+\./u.test(stripped)||/^1\.\s+청맥병원/u.test(stripped)){context=`청맥병원 · ${headLabel(stripped)}`;}
   else if(/^[✔✓]/u.test(stripped)){context=`진료 분야 · ${headLabel(stripped)}`;}
   else if(/^(메타 제목|메타 설명|메타태그|관련 영문 용어|대표 증상)/u.test(stripped)){context=context.split(' > ')[0]+' > '+stripped;}
   else if(!context){context=headLabel(stripped);}
   register('context',start,start+text.length,'heading');continue;
  }
  if(isInstruction(stripped)){register('context',start,start+text.length,'user_instruction');continue;}
  // Preserve original character coverage for every sentence. Non-factual fragments are presented separately in manifest.
  const lineItems=splitStatements(text);
  for(const piece of lineItems){
   const raw=piece.raw,clean=normalizeSpace(raw);
   const from=start+piece.start,to=start+piece.end;
   if(!clean){register('context',from,to,'whitespace');continue;}
   // Standalone graphic/ordinal labels never become medical facts.
   if(/^(?:하나|둘|셋|넷|---+)\.?$/u.test(clean)){
    register('context',from,to,'decorative_label');continue;
   }
   let pieces=statementFor(raw,context);
   if(pieces.some(p=>p.text.length>maxFactChars))throw new Error('ATOMIC_FACT_TOO_LONG');
   // Multiple atomic claims from one compound expression share their evidence span; source coverage counts the original span once.
   const index=facts.length;
   for(const p of pieces){
    if(!p.text)continue;
    const ordinalNumber=++ordinal;
    const title=labelFor(p.text,context,ordinalNumber);
    if(title.length<2)continue;
    facts.push({title,body:p.text,start:from,end:to,evidence:clean,context,ordinal:ordinalNumber,source_piece:index});
   }
   if(facts.length===index)register('context',from,to,'non_factual_fragment');
   else register('fact',from,to);
  }
 }
 // Adjacent, contiguous spans must cover all original characters exactly once.
 if(fragments[0]?.start!==0||fragments.at(-1)?.end!==source.length||fragments.some((f,i)=>i&&f.start!==fragments[i-1].end))throw new Error('ATOMIC_SOURCE_COVERAGE_FAILED');
 if(!facts.length)throw new Error('ATOMIC_NO_FACTS');
 return {facts,fragments,sourceChars:source.length,coveredChars:fragments.reduce((sum,f)=>sum+f.end-f.start,0),complete:true};
}
