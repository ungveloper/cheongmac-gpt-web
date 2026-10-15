'use client';
import {useState} from 'react';
import {browserDb} from '@/lib/supabase-browser';
export default function Login(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const login=async()=>{setBusy(true);try{const {error}=await browserDb().auth.signInWithOAuth({provider:'google',options:{redirectTo:`${location.origin}/auth/callback`}});if(error)throw error;}catch(e){setError(e instanceof Error?e.message:'로그인 실패');setBusy(false);}};
 return <main className="grid min-h-screen place-items-center p-6"><div className="panel w-full max-w-md p-10 text-center shadow-sm"><div className="mb-3 text-4xl text-sky-700">✳</div><h1 className="text-3xl font-bold">MacGPT</h1><p className="muted mt-2 mb-8 text-sm">청맥병원 AI 업무 파트너</p><button className="btn btn-primary w-full" disabled={busy} onClick={login}>{busy?'로그인 중...':'Google 계정으로 계속'}</button>{error&&<p className="mt-4 text-sm text-red-600">{error}</p>}<p className="muted mt-5 text-xs leading-5">첫 로그인 후 최종관리자의 승인이 필요합니다. 계정 권한은 병원 시스템에서 별도로 관리됩니다.</p></div></main>;
}
