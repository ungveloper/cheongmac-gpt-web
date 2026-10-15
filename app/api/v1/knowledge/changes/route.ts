import {authorize,allowedScopes,deny,limit} from '@/lib/api-auth';
import {adminDb} from '@/lib/supabase';
export const runtime='nodejs';
export async function GET(req:Request){
 const actor=await authorize(req);if(!actor)return deny();
 if(!await limit(actor))return Response.json({error:{code:'RATE_LIMITED'}},{status:429});
 const since=Number(new URL(req.url).searchParams.get('since')||0);
 if(!Number.isSafeInteger(since)||since<0)return Response.json({error:{code:'BAD_CURSOR'}},{status:400});
 const {data,error}=await adminDb().from('knowledge_events').select('seq,knowledge_id,action,visibility,previous_visibility,version,created_at').gt('seq',since).order('seq').limit(100);
 if(error)return Response.json({error:{code:'DATA_UNAVAILABLE'}},{status:503});
 // Internal permission changes require tombstones to invalidate previous caches.
 // A prior visibility level is not in the event table; inaccessible event IDs are returned as invalidate-only.
 const scopes=allowedScopes(actor.scope);
 const events=(data||[]).filter(e=>scopes.includes(e.visibility)||Boolean(e.previous_visibility&&scopes.includes(e.previous_visibility)))
   .map(e=>scopes.includes(e.visibility)?{seq:e.seq,knowledge_id:e.knowledge_id,action:e.action,version:e.version,created_at:e.created_at}:
   {seq:e.seq,knowledge_id:e.knowledge_id,action:'invalidate',version:e.version});
 return Response.json({data:events,next_cursor:data?.at(-1)?.seq??since},{headers:{'Cache-Control':'no-store'}});
}
