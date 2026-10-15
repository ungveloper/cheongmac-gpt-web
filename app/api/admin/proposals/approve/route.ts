import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {embedding} from '@/lib/ai';
import {z} from 'zod';
export const runtime='nodejs';
const schema=z.object({id:z.string().uuid(),action:z.enum(['approve','reject'])});
export async function POST(req:Request){
 const identity=await requireMember('admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const input=schema.safeParse(await req.json().catch(()=>null));if(!input.success)return Response.json({error:'BAD_REQUEST'},{status:400});
 try{
   const db=adminDb();
   const {data,error}=await db.rpc('resolve_knowledge_proposal',{p_proposal:input.data.id,p_actor:identity.member.id,p_action:input.data.action});
   if(error)return Response.json({error:'PROPOSAL_CONFLICT',message:error.message},{status:409});
   if(input.data.action==='reject')return Response.json({status:'rejected'});
   let indexed=0;
   for(const item of data as Array<{id:string;version:number;status:string}>){
     if(item.status==='archive') continue;
     const {data:row}=await db.from('knowledge_items').select('title,body').eq('id',item.id).eq('current_version',item.version).single();
     if(!row)continue;
     try{
       const vector=await embedding(`${row.title}\n${row.body}`);
       const {error:indexError}=await db.from('knowledge_chunks').upsert({knowledge_id:item.id,version:item.version,content:row.body,embedding:`[${vector.join(',')}]`},{onConflict:'knowledge_id,version'});
       if(!indexError) indexed++;
     }catch(e){console.warn('keyword fallback until reindex',item.id,e);}
   }
   return Response.json({status:'approved',changes:data,indexed,warning:indexed<(data as Array<{status:string}>).filter(i=>i.status!=='archive').length?'일부 의미 검색 인덱스 생성에 실패했습니다. 정확 키워드 검색으로 조회되며 재색인 필요.':null});
 }catch(e){console.error(e);return Response.json({error:'APPROVAL_FAILED'},{status:503});}
}
