import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
export const runtime='nodejs';
export async function GET(){
 const identity=await requireMember('admin');if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const {data,error}=await adminDb().from('knowledge_proposals').select('id,summary,changes,status,created_at,requested_by').order('created_at',{ascending:false}).limit(100);
 return error?Response.json({error:'DATA_UNAVAILABLE'},{status:503}):Response.json({data});
}
