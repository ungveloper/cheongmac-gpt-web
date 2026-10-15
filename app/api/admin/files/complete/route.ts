import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {bucket} from '@/lib/config';
import {z} from 'zod';
export const runtime='nodejs';
export async function POST(req:Request){
 const member=await requireMember('admin');if(!member)return Response.json({error:'FORBIDDEN'},{status:403});
 const parsed=z.object({id:z.string().uuid()}).safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({error:'BAD_REQUEST'},{status:400});
 const db=adminDb();const {data:record}=await db.from('source_files').select('*').eq('id',parsed.data.id).eq('uploaded_by',member.member.id).eq('upload_status','pending').maybeSingle();
 if(!record)return Response.json({error:'NOT_FOUND'},{status:404});
 const {data:file,error}=await db.storage.from(bucket).info(record.storage_path);
 if(error || !file || Number(file.size)!==Number(record.byte_size))return Response.json({error:'UPLOAD_NOT_VERIFIED'},{status:409});
 await db.from('source_files').update({upload_status:'uploaded'}).eq('id',record.id);
 return Response.json({ok:true});
}
