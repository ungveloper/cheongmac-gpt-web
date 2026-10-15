import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {z} from 'zod';
export const runtime='nodejs';
const schema=z.object({id:z.string().uuid(),role:z.enum(['staff','admin','super_admin']).optional(),approved:z.boolean().optional(),active:z.boolean().optional()});
export async function GET(){
 const identity=await requireMember('super_admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const {data}=await adminDb().from('members').select('id,email,display_name,role,approved,active,created_at').order('created_at',{ascending:false}).limit(500);
 return Response.json({data});
}
export async function PATCH(req:Request){
 const identity=await requireMember('super_admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'BAD_REQUEST'},{status:400});
 const {id,...patch}=parsed.data;
 if(Object.keys(patch).length===0)return Response.json({error:'EMPTY_CHANGE'},{status:400});
 if(id===identity.member.id && (patch.active===false||patch.approved===false||(patch.role&&patch.role!=='super_admin')))return Response.json({error:'SELF_LOCKOUT'},{status:409});
 const db=adminDb();const {data,error}=await db.from('members').update(patch).eq('id',id).select('id,email,role,approved,active').single();
 if(error)return Response.json({error:'UPDATE_FAILED'},{status:500});
 await db.from('audit_events').insert({actor_id:identity.member.id,event:'member.updated',detail:{member_id:id,patch}});
 return Response.json({data});
}
