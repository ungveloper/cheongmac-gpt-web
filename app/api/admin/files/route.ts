import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(){
 const identity=await requireMember('admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const {data}=await adminDb().from('source_files').select('id,original_name,content_type,byte_size,knowledge_id,upload_status,created_at').order('created_at',{ascending:false}).limit(100);
 return Response.json({data});
}
export async function PATCH(req:Request){
 const identity=await requireMember('admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const parsed=z.object({id:z.string().uuid(),knowledge_id:z.string().uuid()}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return Response.json({error:'BAD_REQUEST'},{status:400});
 const db=adminDb();const {data:knowledge}=await db.from('knowledge_items').select('id').eq('id',parsed.data.knowledge_id).eq('status','published').maybeSingle();
 if(!knowledge)return Response.json({error:'INVALID_KNOWLEDGE'},{status:404});
 const {error}=await db.from('source_files').update({knowledge_id:knowledge.id}).eq('id',parsed.data.id).eq('upload_status','uploaded');
 if(error)return Response.json({error:'UPDATE_FAILED'},{status:500});
 await db.from('audit_events').insert({actor_id:identity.member.id,event:'file.attached',detail:parsed.data});
 return Response.json({ok:true});
}
