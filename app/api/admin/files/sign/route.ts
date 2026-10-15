import {requireMember} from '@/lib/auth';
import {adminDb} from '@/lib/supabase';
import {bucket} from '@/lib/config';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
export const runtime='nodejs';
const allowed=['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/markdown','image/png','image/jpeg'];
const schema=z.object({name:z.string().min(1).max(200),size:z.number().int().min(1).max(50*1024*1024),type:z.string()});
export async function POST(req:Request){
 const actor=await requireMember('admin');if(!actor)return Response.json({error:'FORBIDDEN'},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success || !allowed.includes(parsed.data.type))return Response.json({error:'UNSUPPORTED_FILE'},{status:400});
 const db=adminDb(),path=`uploads/${randomUUID()}`,name=parsed.data.name.replace(/[\x00-\x1f]/g,'');
 const {data:file,error}=await db.from('source_files').insert({storage_path:path,original_name:name,content_type:parsed.data.type,byte_size:parsed.data.size,uploaded_by:actor.member.id}).select('id').single();
 if(error)return Response.json({error:'CREATE_FAILED'},{status:500});
 const signed=await db.storage.from(bucket).createSignedUploadUrl(path);
 if(signed.error){await db.from('source_files').delete().eq('id',file.id);return Response.json({error:'STORAGE_UNAVAILABLE'},{status:503});}
 return Response.json({id:file.id,path,token:signed.data.token,bucket},{headers:{'Cache-Control':'no-store'}});
}
