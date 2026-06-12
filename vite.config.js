import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 네이버 증권 API는 브라우저에서 직접 호출하면 CORS에 막히므로
// 개발 서버가 프록시 역할을 한다. (배포 시에는 동일한 경로 규칙의 서버 프록시 필요)
const naverHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  Referer: 'https://m.stock.naver.com/',
};

const proxy = (target, prefixFrom, prefixTo) => ({
  target,
  changeOrigin: true,
  headers: naverHeaders,
  rewrite: p => p.replace(prefixFrom, prefixTo),
});

export default defineConfig({
  plugins: [react()],
  server: {
    // Cloudflare 터널 도메인으로 들어오는 외부 요청 허용
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/n-api': proxy('https://m.stock.naver.com', /^\/n-api/, '/api'),
      '/n-front': proxy('https://m.stock.naver.com', /^\/n-front/, '/front-api'),
      '/n-polling': proxy('https://polling.finance.naver.com', /^\/n-polling/, '/api'),
      '/n-chart': proxy('https://api.stock.naver.com', /^\/n-chart/, '/chart'),
      '/n-ac': proxy('https://ac.stock.naver.com', /^\/n-ac/, ''),
    },
  },
});
