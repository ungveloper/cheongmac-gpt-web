import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {z} from 'zod';
export const runtime='nodejs';
const schema=z.object({id:z.string().uuid(),role:z.enum(['staff','admin','super_admin']).optional(),approved:z.boolean().optional(),active:z.boolean().optional()});
const PAGE_SIZE=10;
const sorts={created_desc:['created_at',false],created_asc:['created_at',true],name_asc:['display_name',true],name_desc:['display_name',false],email_asc:['email',true],email_desc:['email',false],role_asc:['role',true],approval_pending_first:['approved',true],approval_approved_first:['approved',false]} as const;

export async function GET(req:Request){
 const identity=await requireMember('super_admin');
 if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const params=new URL(req.url).searchParams;
 const view=params.get('view')==='pending'?'pending':'all';
 const rawPage=Number(params.get('page')||'1');
 if(!Number.isSafeInteger(rawPage)||rawPage<1||rawPage>100000)return Response.json({error:'BAD_PAGE'},{status:400});
 const search=(params.get('q')||'').trim();
 if(search.length>80)return Response.json({error:'BAD_QUERY'},{status:400});
 const sortKey=params.get('sort')||'created_desc';
 if(!(sortKey in sorts))return Response.json({error:'BAD_SORT'},{status:400});
 const [column,ascending]=sorts[sortKey as keyof typeof sorts];
 const offset=(rawPage-1)*PAGE_SIZE;
 let query=adminDb().from('members')
   .select('id,email,display_name,role,approved,active,created_at',{count:'exact'})
   .order(column,{ascending,nullsFirst:false}).order('id',{ascending:true})
   .range(offset,offset+PAGE_SIZE-1);
 if(view==='pending')query=query.eq('approved',false).eq('active',true);
 if(search){
   // PostgREST .or() expects raw filter syntax: strip delimiters and LIKE control characters.
   const safe=search.replace(/[%,.()\\"']/g,' ').replace(/\s+/g,' ').trim();
   if(safe)query=query.or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%`);
 }
 const {data,error,count}=await query;
 if(error){console.error('member list error',error);return Response.json({error:'MEMBERS_UNAVAILABLE'},{status:503});}
 return Response.json({data:data||[],total:count||0,page:rawPage,page_size:PAGE_SIZE},{headers:{'Cache-Control':'no-store'}});
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
