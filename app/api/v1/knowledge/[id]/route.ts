import {authorize,allowedScopes,deny,limit} from '@/lib/api-auth';
import {adminDb} from '@/lib/supabase';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const actor=await authorize(req);if(!actor)return deny();
 if(!await limit(actor))return Response.json({error:{code:'RATE_LIMITED'}},{status:429});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return Response.json({error:{code:'NOT_FOUND'}},{status:404});
 const {data}=await adminDb().from('knowledge_items').select('id,title,body,visibility,current_version,updated_at').eq('id',id).eq('status','published').in('visibility',allowedScopes(actor.scope)).maybeSingle();
 return data?Response.json({data},{headers:{'Cache-Control':'no-store'}}):Response.json({error:{code:'NOT_FOUND'}},{status:404});
}
