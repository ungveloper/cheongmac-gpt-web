import {authorize,allowedScopes,deny,limit} from '@/lib/api-auth';
import {adminDb} from '@/lib/supabase';
import {bucket} from '@/lib/config';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const actor=await authorize(req);if(!actor)return deny();
 if(!await limit(actor))return Response.json({error:{code:'RATE_LIMITED'}},{status:429});
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return Response.json({error:'NOT_FOUND'},{status:404});
 const db=adminDb();
 const {data:file}=await db.from('source_files').select('storage_path,knowledge_id,original_name').eq('id',id).eq('upload_status','uploaded').maybeSingle();
 if(!file?.knowledge_id)return Response.json({error:'NOT_FOUND'},{status:404});
 const {data:knowledge}=await db.from('knowledge_items').select('id').eq('id',file.knowledge_id).eq('status','published').in('visibility',allowedScopes(actor.scope)).maybeSingle();
 if(!knowledge)return Response.json({error:'NOT_FOUND'},{status:404});
 const {data,error}=await db.storage.from(bucket).createSignedUrl(file.storage_path,60,{download:file.original_name});
 if(error||!data?.signedUrl)return Response.json({error:'STORAGE_UNAVAILABLE'},{status:503});
 return Response.json({url:data.signedUrl,expires_in:60},{headers:{'Cache-Control':'no-store'}});
}
