# 마켓나우 (market-now)

한국 주식 시황 대시보드. React + Vite로 작성됐고, 네이버 증권 비공식 API를 폴링해서 실제 시세를 보여준다.

## 실행

```bash
npm install
npm run dev   # http://localhost:5173
```

## 데이터 소스와 갱신 주기

| 영역 | API | 주기 |
|---|---|---|
| 지수 (KOSPI/KOSDAQ/KOSPI200) | polling.finance.naver.com | 7초 |
| USD/KRW 환율 | m.stock.naver.com front-api | 60초 |
| 실시간 랭킹 + 시장 온도 | m.stock.naver.com 상승/하락 랭킹 | 7초 |
| 테마 히트맵 | 테마 그룹 + 테마별 구성종목 | 30초 |
| 종목 모달 현재가 | 종목 실시간 폴링 | 5초 (열려 있는 동안) |
| 일봉 캔들 / 스파크라인 | api.stock.naver.com 차트 | 진입 시 1회 |
| 종목 검색 | ac.stock.naver.com 자동완성 | 입력 시 (200ms 디바운스) |

- "거래대금" 탭은 전용 정렬 API가 없어 상승/하락 상위 각 100종목(코스피+코스닥, 총 400종목) 안에서 거래대금순으로 정렬한다.
- 장 마감 후에는 마지막 체결 시세가 표시되고 상단 상태가 "장마감"으로 바뀐다.

## CORS 프록시

네이버 API는 브라우저에서 직접 호출할 수 없어 Vite 개발 서버가 프록시 역할을 한다
(`vite.config.js`의 `/n-api`, `/n-front`, `/n-polling`, `/n-chart`, `/n-ac`).
`npm run build`로 정적 배포할 경우 같은 경로 규칙의 서버 측 프록시(nginx, Cloudflare Workers 등)가 별도로 필요하다.

## 주의

비공식 API이므로 사전 고지 없이 변경·차단될 수 있다. 시세는 지연될 수 있으며 투자 판단의 근거로 사용할 수 없다.
