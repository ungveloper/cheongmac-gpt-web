import {authorize,allowedScopes,deny,limit} from '@/lib/api-auth';
import {adminDb} from '@/lib/supabase';
export const runtime='nodejs';
export async function GET(req:Request){
 const actor=await authorize(req);if(!actor)return deny();
 if(!await limit(actor))return Response.json({error:{code:'RATE_LIMITED'}},{status:429});
 const url=new URL(req.url);const cursor=Number(url.searchParams.get('offset')||0);
 if(!Number.isInteger(cursor)||cursor<0||cursor>1000000)return Response.json({error:{code:'BAD_CURSOR'}},{status:400});
 const size=100;
 const {data,error}=await adminDb().from('knowledge_items').select('id,title,body,visibility,current_version,updated_at').eq('status','published')
  .in('visibility',allowedScopes(actor.scope)).order('id').range(cursor,cursor+size-1);
 if(error)return Response.json({error:{code:'DATA_UNAVAILABLE'}},{status:503});
 await adminDb().from('audit_events').insert({actor_id:actor.member?.id||null,event:'knowledge.export',detail:{client:actor.clientId||null,scope:actor.scope,count:data?.length||0}});
 return Response.json({data,next_offset:(data?.length||0)===size?cursor+size:null},{headers:{'Cache-Control':'no-store'}});
}
