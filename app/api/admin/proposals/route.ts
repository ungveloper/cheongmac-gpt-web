import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {z} from 'zod';
export const runtime='nodejs';
export async function GET(req:Request){
 const identity=await requireMember('admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const input=z.enum(['pending','approved','rejected']).safeParse(new URL(req.url).searchParams.get('status')||'pending');
 if(!input.success)return Response.json({error:'INVALID_STATUS'},{status:400});
 const pageValue=Number(new URL(req.url).searchParams.get('page')||1);
 const page=Number.isSafeInteger(pageValue)&&pageValue>=1?pageValue:1;
 const limit=25,offset=(page-1)*limit;
 const db=adminDb();
 const result=await db.from('knowledge_proposals').select('id,summary,changes,status,created_at,requested_by,approved_change_indices,source_manifest',{count:'exact'}).eq('status',input.data).order('created_at',{ascending:false}).range(offset,offset+limit-1);
 if(!result.error)return Response.json({data:result.data,meta:{page,limit,total:result.count||0}});
 // Read-only fallback before SQL migration: never fall back for approval mutations.
 if(result.error.code==='42703'||/approved_change_indices|source_manifest/.test(result.error.message||'')){
  const previous=await db.from('knowledge_proposals').select('id,summary,changes,status,created_at,requested_by,approved_change_indices').eq('status',input.data).order('created_at',{ascending:false}).range(offset,offset+limit-1);
  if(!previous.error)return Response.json({data:previous.data?.map(p=>({...p,source_manifest:null})),migration_required:true});
  const legacy=await db.from('knowledge_proposals').select('id,summary,changes,status,created_at,requested_by').eq('status',input.data).order('created_at',{ascending:false}).range(offset,offset+limit-1);
  if(!legacy.error)return Response.json({data:legacy.data?.map(p=>({...p,approved_change_indices:null})),migration_required:true});
 }
 return Response.json({error:'DATA_UNAVAILABLE',message:'변경안 목록을 불러오지 못했습니다.'},{status:503});
}
