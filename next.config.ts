import type { NextConfig } from "next";

// MacGPT 인증 페이지와 REST API는 요청별 권한 검사를 수행합니다.
// Next.js 16 Cache Components/PPR은 현재 라우트의 dynamic/runtime 설정과
// 호환되지 않으므로 opt-in 설정을 사용하지 않습니다.
const nextConfig: NextConfig = {
  // 개발 환경 왼쪽 아래 Next.js Dev Tools 표시만 숨깁니다.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
