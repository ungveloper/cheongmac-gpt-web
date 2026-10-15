import {NextResponse} from 'next/server';
import {sessionDb} from '@/lib/supabase';
export async function POST(req:Request){
 const db=await sessionDb();if(db)await db.auth.signOut();
 return NextResponse.redirect(new URL('/login',req.url),303);
}
