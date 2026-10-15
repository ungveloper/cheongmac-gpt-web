import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {generateKey,hashKey} from '@/lib/api-auth';
import {z} from 'zod';
export const runtime='nodejs';
const schema=z.object({name:z.string().trim().min(2).max(80),scope:z.enum(['public','internal']),expires_at:z.string().datetime().nullable().default(null)});
export async function GET(){const identity=await requireMember('super_admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const {data}=await adminDb().from('api_clients').select('id,name,scope,disabled,expires_at,created_at').order('created_at',{ascending:false});return Response.json({data});}
export async function POST(req:Request){
 const identity=await requireMember('super_admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'BAD_REQUEST'},{status:400});
 const key=generateKey();const db=adminDb();
 const {data,error}=await db.from('api_clients').insert({...parsed.data,key_hash:hashKey(key),created_by:identity.member.id}).select('id,name,scope').single();
 if(error)return Response.json({error:'CREATE_FAILED'},{status:500});
 await db.from('audit_events').insert({actor_id:identity.member.id,event:'api_key.created',detail:{client_id:data.id,scope:data.scope}});
 return Response.json({data,key,warning:'이 비밀키는 지금 한 번만 표시됩니다. 홈페이지 서버에만 보관하세요.'},{headers:{'Cache-Control':'no-store'}});
}
export async function PATCH(req:Request){
 const identity=await requireMember('super_admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const parsed=z.object({id:z.string().uuid(),disabled:z.boolean()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'BAD_REQUEST'},{status:400});
 const db=adminDb();const {error}=await db.from('api_clients').update({disabled:parsed.data.disabled}).eq('id',parsed.data.id);
 if(error)return Response.json({error:'UPDATE_FAILED'},{status:500});
 await db.from('audit_events').insert({actor_id:identity.member.id,event:'api_key.status',detail:parsed.data});
 return Response.json({ok:true});
}
