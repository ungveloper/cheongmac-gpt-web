import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentMember} from '@/lib/auth';
import {isConfigured} from '@/lib/config';
export const dynamic='force-dynamic';
export default async function Home(){
 if(!isConfigured())return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6"><div className="panel p-9 shadow-sm"><div className="mb-5 text-4xl">✳</div><h1 className="mb-3 text-2xl font-bold">MacGPT 설정이 필요합니다</h1><p className="muted leading-7">프로젝트 코드가 준비되었습니다. Supabase 프로젝트 생성, SQL 마이그레이션, Google Provider 및 환경변수 등록 후 시작할 수 있습니다.</p><p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm">설정 안내: <code>docs/SETUP.md</code></p></div></main>;
 const identity=await currentMember();
 if(!identity)return <main className="grid min-h-screen place-items-center p-6"><div className="panel w-full max-w-md p-10 text-center shadow-sm"><div className="mb-4 text-4xl text-sky-700">✳</div><h1 className="mb-2 text-3xl font-semibold">MacGPT</h1><p className="muted mb-7 text-sm">청맥병원 AI 지식 파트너</p><Link href="/login" className="btn btn-primary w-full">Google 계정으로 로그인</Link></div></main>;
 if(!identity.member.approved||!identity.member.active)return <main className="grid min-h-screen place-items-center p-6"><div className="panel max-w-lg p-10 text-center"><div className="mb-5 text-4xl">🔒</div><h1 className="text-xl font-bold">{identity.member.active?'관리자 승인 대기':'접근이 중단된 계정'}</h1><p className="muted mt-4 text-sm">{identity.member.email} 계정은 아직 원내 지식에 접근할 수 없습니다. 최종관리자에게 승인을 요청하세요.</p><form method="post" action="/logout" className="mt-6"><button className="btn btn-secondary">로그아웃</button></form></div></main>;
 redirect('/chat');
}
