import {authorize,allowedScopes,deny,limit} from '@/lib/api-auth';
import {adminDb} from '@/lib/supabase';
export const runtime='nodejs';
export async function GET(req:Request){
  const actor=await authorize(req);if(!actor)return deny();
  if(!await limit(actor))return Response.json({error:{code:'RATE_LIMITED'}},{status:429});
  const url=new URL(req.url);const page=Math.max(1,Math.min(10000,Number(url.searchParams.get('page'))||1));
  const size=Math.max(1,Math.min(50,Number(url.searchParams.get('limit'))||20));
  const {data,error,count}=await adminDb().from('knowledge_items').select('id,title,body,visibility,current_version,updated_at', {count:'exact'})
    .eq('status','published').in('visibility',allowedScopes(actor.scope)).order('updated_at',{ascending:false}).range((page-1)*size,page*size-1);
  if(error)return Response.json({error:{code:'DATA_UNAVAILABLE'}},{status:503});
  return Response.json({data,meta:{page,limit:size,total:count}},{headers:{'Cache-Control':'no-store'}});
}
