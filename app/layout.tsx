import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'MacGPT | 청맥병원',description:'청맥병원 승인 지식 기반 AI 업무 파트너'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="ko"><body className="min-h-screen antialiased">{children}</body></html>;
}
