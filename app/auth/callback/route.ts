import {NextResponse} from 'next/server';
import {createServerClient} from '@supabase/ssr';
import {getSupabaseConfig} from '@/lib/config';
import {cookies} from 'next/headers';
export async function GET(request:Request){
 const url=new URL(request.url);const code=url.searchParams.get('code');const cfg=getSupabaseConfig();
 const response=NextResponse.redirect(new URL('/',url.origin));
 if(!code||!cfg)return NextResponse.redirect(new URL('/login?error=oauth',url.origin));
 const cookieStore=await cookies();
 const client=createServerClient(cfg.url,cfg.key,{
  cookies:{getAll:()=>cookieStore.getAll(),setAll:(values)=>values.forEach(({name,value,options})=>{response.cookies.set(name,value,options);cookieStore.set(name,value,options);})},
 });
 const {error}=await client.auth.exchangeCodeForSession(code);
 return error?NextResponse.redirect(new URL('/login?error=oauth',url.origin)):response;
}
