import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {ai,models} from '@/lib/ai';
import {z} from 'zod';
export const runtime='nodejs';
export const maxDuration=300;
const schema=z.object({ids:z.array(z.string().uuid()).min(1).refine(ids=>new Set(ids).size===ids.length,'Duplicate IDs')}).strict();
export async function POST(req:Request){
 const identity=await requireMember('admin');
 if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const input=schema.safeParse(await req.json().catch(()=>null));
 if(!input.success)return Response.json({error:'INVALID_SELECTION',message:'선택한 사실 ID가 올바르지 않습니다.'},{status:400});
 const db=adminDb();
 const {data,error}=await db.rpc('resolve_atomic_proposals_bulk',{p_actor:identity.member.id,p_proposals:input.data.ids});
 if(error){
  console.error('atomic bulk approval rejected',{code:error.code,message:error.message});
  if(error.code==='PGRST202'||/resolve_atomic_proposals_bulk/.test(error.message))
   return Response.json({error:'MIGRATION_REQUIRED',message:'Supabase SQL 004를 실행한 후 다시 시도해 주세요.'},{status:503});
  return Response.json({error:'BULK_APPROVAL_REJECTED',message:'선택한 항목 중 이미 처리됐거나 승인할 수 없는 항목이 있습니다. 어떤 항목도 승인되지 않았습니다. 새로고침 후 다시 확인하세요.'},{status:409});
 }
 const outcome=data as {approved:number;changes:Array<{id:string;version:number;status:string}>}|null;
 if(!outcome||!Array.isArray(outcome.changes)||outcome.approved!==input.data.ids.length)
  return Response.json({error:'APPROVAL_RESPONSE_INVALID',message:'DB 승인 결과를 확인하지 못했습니다. 승인 목록을 새로고침해 주세요.'},{status:503});
 // Once the atomic transaction commits, build vector indexes in bounded batches.
 // Embeddings failure never changes the approval status; keyword search still works.
 const indexedItems=outcome.changes.filter(item=>item.status!=='archive');
 let indexed=0;
 for(let offset=0;offset<indexedItems.length;offset+=48){
  const batch=indexedItems.slice(offset,offset+48);
  try{
   const rows=await Promise.all(batch.map(async item=>{
    const {data:row,error:readError}=await db.from('knowledge_items').select('title,body').eq('id',item.id).eq('current_version',item.version).single();
    if(readError||!row)throw new Error('Published knowledge missing');
    return {item,row};
   }));
   const vectors=await ai().embeddings.create({model:models().embedding,input:rows.map(({row})=>`${row.title}\n${row.body}`.slice(0,9000)),dimensions:1536});
   if(vectors.data.length!==rows.length)throw new Error('Embedding count mismatch');
   const {error:writeError}=await db.from('knowledge_chunks').upsert(rows.map(({item,row},index)=>({knowledge_id:item.id,version:item.version,content:row.body,embedding:`[${vectors.data[index].embedding.join(',')}]`})),{onConflict:'knowledge_id,version'});
   if(writeError)throw writeError;
   indexed+=rows.length;
  }catch(err){console.error('atomic bulk indexing deferred',{batch:offset,error:err instanceof Error?err.name:'unknown'});}
 }
 return Response.json({approved:outcome.approved,indexed,warning:indexed<indexedItems.length?'일부 검색 인덱스 생성에 실패해 재색인이 필요합니다.':null},{headers:{'Cache-Control':'no-store'}});
}
