import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
export const runtime='nodejs';
export async function GET(){
 const identity=await requireMember('admin');
 if(!identity)return Response.json({error:'FORBIDDEN'},{status:403});
 const db=adminDb();
 const [proposals,members]=await Promise.all([
  db.from('knowledge_proposals').select('id',{count:'exact',head:true}).eq('status','pending'),
  identity.member.role==='super_admin'
   ?db.from('members').select('id',{count:'exact',head:true}).eq('approved',false).eq('active',true)
   :Promise.resolve({count:0,error:null}),
 ]);
 if(proposals.error||members.error){console.error('pending counts error',proposals.error,members.error);return Response.json({error:'COUNTS_UNAVAILABLE'},{status:503});}
 return Response.json({proposals:proposals.count||0,members:members.count||0},{headers:{'Cache-Control':'no-store'}});
}
