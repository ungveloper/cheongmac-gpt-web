/** Source-preserving sections for human-approved knowledge review.
 * No LLM summarizes or deletes content. Every UTF-16 code unit of source is covered once.
 * The original content is UNTRUSTED data, never an instruction to run tools.
 */
function topic(line,context){
 const trimmed=line.trim();
 const chapter=trimmed.match(/^1-(\d{1,2})\.\s+(.+)$/);
 if(chapter)return {title:`청맥병원 ${chapter[0]}`,ctx:`1-${chapter[1]}`};
 if(/^1\.\s+청맥병원 기본 정보\s*$/.test(trimmed))return{title:'청맥병원 기본 정보',ctx:'1-0'};
 if(context==='1-5'){
  const spec=trimmed.match(/^[✔✓]\uFE0F?\s+(.+)$/u);
  if(spec)return{title:`진료 분야 · ${spec[1]}`,ctx:context};
 }
 if(context==='1-6'){
  const physician=trimmed.match(/^(.+?원장님)\s*\|\s*(.+?전문의)\s*$/u);
  if(physician)return{title:`의료진 · ${physician[1]} (${physician[2]})`,ctx:context};
 }
 if(context==='1-7'||context==='1-8'){
  const detail=trimmed.match(/^([1-9]\d?)\.\s+([^\n]{2,100})$/);
  if(detail)return{title:`${context==='1-7'?'장비·시설':'환자 지원'} · ${detail[2]}`,ctx:context};
 }
 return null;
}
function splitExact(text,maxChars){
 const out=[];
 let rest=text;
 while(rest.length>maxChars){
  let cut=rest.lastIndexOf('\n',maxChars-1)+1;
  if(cut<maxChars/2)cut=maxChars;
  out.push(rest.slice(0,cut));rest=rest.slice(cut);
 }
 if(rest)out.push(rest);
 return out;
}
export function reviewSourceSections(source,{maxBodyChars=11800,titlePrefix=''}={}){
 if(typeof source!=='string'||!source.length||!Number.isSafeInteger(maxBodyChars)||maxBodyChars<256||maxBodyChars>12000)throw new Error('INVALID_REVIEW_SOURCE');
 const headers=[];let context='';
 const tableOfContents=source.indexOf('[목차]');
 const bodyStart=tableOfContents>=0?source.lastIndexOf('\n1. 청맥병원 기본 정보'):-1;
 // The index positions are offsets into the full unmodified source; no content is skipped.
 let match;
 const re=/[^\n]*(?:\n|$)/g;
 while((match=re.exec(source))&&match[0]){
  if(bodyStart>=0&&match.index<bodyStart)continue; // Keep TOC text in the first item; do not treat TOC headings as body chapters.
  const found=topic(match[0],context);
  if(found){headers.push({start:match.index,title:found.title});context=found.ctx;}
 }
 const boundaries=[{start:0,title:'문서 표지·목차 및 서문'},...headers];
 const sections=[];
 for(let i=0;i<boundaries.length;i++){
  const from=boundaries[i].start,to=i+1<boundaries.length?boundaries[i+1].start:source.length;
  if(to<=from)continue;
  const raw=source.slice(from,to);
  const pieces=splitExact(raw,maxBodyChars);
  let cursor=from;
  for(let j=0;j<pieces.length;j++){
   const body=pieces[j];
   sections.push({title:(titlePrefix+boundaries[i].title+(pieces.length>1?` (${j+1}/${pieces.length})`:'' )).slice(0,200),body,start:cursor,end:cursor+body.length});
   cursor+=body.length;
  }
 }
 if(sections.length===0||sections[0].start!==0||sections[sections.length-1].end!==source.length||sections.map(s=>s.body).join('')!==source||sections.some((s,i)=>i>0&&s.start!==sections[i-1].end)){
  throw new Error('LEARNING_SOURCE_COVERAGE_FAILED');
 }
 return sections;
}
