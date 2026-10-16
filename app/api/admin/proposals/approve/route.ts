import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {ai,models} from '@/lib/ai';
import {z} from 'zod';
export const runtime='nodejs';
export const maxDuration=300;
const schema=z.discriminatedUnion('action',[
 z.object({id:z.string().uuid(),action:z.literal('reject')}).strict(),
 z.object({id:z.string().uuid(),action:z.literal('approve'),selected_indices:z.array(z.number().int().min(0)).min(1).refine(a=>new Set(a).size===a.length)}).strict(),
]);
export async function POST(req:Request){
 const identity=await requireMember('admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const input=schema.safeParse(await req.json().catch(()=>null));if(!input.success)return Response.json({error:'BAD_REQUEST',message:'승인 대상 항목이 올바르지 않습니다.'},{status:400});
 try{
   const db=adminDb();
   const isApproval=input.data.action==='approve';
   const {data,error}=input.data.action==='approve'?
    await db.rpc('resolve_knowledge_proposal_selected',{p_proposal:input.data.id,p_actor:identity.member.id,p_selected:input.data.selected_indices}):
    await db.rpc('resolve_knowledge_proposal',{p_proposal:input.data.id,p_actor:identity.member.id,p_action:'reject'});
   if(error){
    if(isApproval&&(error.code==='PGRST202'||error.message.includes('resolve_knowledge_proposal_selected')))
      return Response.json({error:'MIGRATION_REQUIRED',message:'Supabase에 선택 승인 SQL 마이그레이션을 먼저 적용해야 합니다.'},{status:503});
    return Response.json({error:'PROPOSAL_CONFLICT',message:error.message},{status:409});
   }
   if(!isApproval)return Response.json({status:'rejected'});
   let indexed=0;
   const publishedItems=(data as Array<{id:string;version:number;status:string}>).filter(item=>item.status!=='archive');
   // Embeddings API accepts batches: avoid one network call per independently stored fact.
   // Index failure never rolls back an already committed, audited DB approval.
   for(let offset=0;offset<publishedItems.length;offset+=48){
     const batch=publishedItems.slice(offset,offset+48);
     try{
       const rows=await Promise.all(batch.map(async item=>{
         const {data:row,error:readError}=await db.from('knowledge_items').select('title,body').eq('id',item.id).eq('current_version',item.version).single();
         if(readError||!row)throw new Error('Knowledge row missing after approval');
         return {item,row};
       }));
       const vectorResult=await ai().embeddings.create({model:models().embedding,input:rows.map(({row})=>`${row.title}\n${row.body}`.slice(0,9000)),dimensions:1536});
       const vectors=vectorResult.data;
       if(vectors.length!==rows.length)throw new Error('Embedding output count mismatch');
       const resultRows=rows.map(({item,row},index)=>({knowledge_id:item.id,version:item.version,content:row.body,embedding:`[${vectors[index].embedding.join(',')}]`}));
       const {error:upsertError}=await db.from('knowledge_chunks').upsert(resultRows,{onConflict:'knowledge_id,version'});
       if(upsertError)throw upsertError;
       indexed+=rows.length;
     }catch(e){console.warn('atomic knowledge keyword fallback; reindex needed',{batch:offset,name:e instanceof Error?e.name:'unknown'});}
   }
   const published=(data as Array<{status:string}>).filter(item=>item.status!=='archive').length;
   return Response.json({status:'approved',changes:data,indexed,warning:indexed<published?'일부 의미 검색 인덱스 생성에 실패했습니다. 정확 키워드 검색으로 조회되며 재색인 필요.':null});
 }catch(e){console.error('proposal resolve failure',e);return Response.json({error:'APPROVAL_FAILED'},{status:503});}
}
