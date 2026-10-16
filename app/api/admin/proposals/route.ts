import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(req:Request){
 const identity=await requireMember('admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const input=z.enum(['pending','approved','rejected']).safeParse(new URL(req.url).searchParams.get('status')||'pending');
 if(!input.success)return Response.json({error:'INVALID_STATUS'},{status:400});
 const db=adminDb();
 const result=await db.from('knowledge_proposals').select('id,summary,changes,status,created_at,requested_by,approved_change_indices').eq('status',input.data).order('created_at',{ascending:false}).limit(100);
 if(!result.error)return Response.json({data:result.data});
 // Read-only fallback before SQL migration: never fall back for approval mutations.
 if(result.error.code==='42703'||/approved_change_indices/.test(result.error.message||'')){
  const legacy=await db.from('knowledge_proposals').select('id,summary,changes,status,created_at,requested_by').eq('status',input.data).order('created_at',{ascending:false}).limit(100);
  if(!legacy.error)return Response.json({data:legacy.data?.map(p=>({...p,approved_change_indices:null})),migration_required:true});
 }
 return Response.json({error:'DATA_UNAVAILABLE',message:'변경안 목록을 불러오지 못했습니다.'},{status:503});
}
