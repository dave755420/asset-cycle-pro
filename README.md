# Asset Cycle Pro — 한국어 버전

> 글로벌 자산 간 유동성 순환을 분석하는 기관 투자자 수준의 금융 분석 대시보드

---

## 📊 분석 대상 자산

| 자산 | 심볼 | 데이터 소스 |
|------|------|------------|
| 비트코인 | BTC-USD | Yahoo Finance |
| S&P 500 | SPY | Yahoo Finance |
| 코스피 | ^KS11 | Yahoo Finance |
| 달러/원 환율 | KRW=X | Yahoo Finance |
| 미국 10년 국채금리 | ^TNX | Yahoo Finance |
| 금 (Gold) | GC=F | Yahoo Finance |

---

## 🚀 로컬 실행

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행
npm run dev

# 3. 브라우저에서 접속
open http://localhost:3000
```

---

## 📦 Vercel 배포

### 방법 1: Vercel CLI

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 프로덕션 배포
vercel --prod
```

### 방법 2: GitHub 연동 (권장)

1. 이 프로젝트를 새 GitHub 레포지토리에 push
   ```bash
   git init
   git add .
   git commit -m "feat: Asset Cycle Pro 초기 구축"
   git remote add origin https://github.com/YOUR_USERNAME/asset-cycle-pro.git
   git push -u origin main
   ```

2. [vercel.com](https://vercel.com) 접속 → **New Project**
3. GitHub 레포지토리 연결
4. **Framework**: Next.js (자동 감지)
5. **Build Command**: `npm run build` (기본값)
6. **Output Directory**: `.next` (기본값)
7. **Deploy** 클릭

### 환경 변수 (선택)

Vercel 대시보드 → Settings → Environment Variables:

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `NEXT_PUBLIC_REFRESH_INTERVAL_MS` | `60000` | 자동 갱신 주기 (ms) |

---

## 🏗 아키텍처

```
asset-cycle-pro/
├── app/
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 메인 페이지
│   ├── globals.css             # 전역 스타일
│   └── api/
│       ├── assets/route.ts     # 실시간 시세 API
│       ├── correlation/route.ts # 상관관계 분석 API
│       └── history/route.ts    # 가격 히스토리 API
│
├── components/
│   ├── Dashboard.tsx           # 메인 대시보드 (탭 구조)
│   ├── Sidebar.tsx             # 좌측 설정 사이드바
│   ├── PriceCard.tsx           # 자산별 가격 카드
│   ├── CorrelationHeatmap.tsx  # 상관관계 히트맵
│   ├── InsightPanel.tsx        # 한국어 인사이트 패널
│   ├── DataTable.tsx           # 가격 데이터 테이블
│   └── PriceChart.tsx          # 가격 차트 (Recharts)
│
├── lib/
│   ├── types.ts                # TypeScript 타입 정의
│   ├── constants.ts            # 자산 메타정보 상수
│   ├── data-layer.ts           # 데이터 레이어 (API 호출, 캐싱)
│   ├── quant-engine.ts         # 퀀트 분석 엔진
│   └── utils.ts                # 포맷 유틸리티
│
└── hooks/
    └── useAssetData.ts         # React 커스텀 훅
```

---

## 🔧 API 연동

### Yahoo Finance (무료, 비공식)

```
실시간 시세: https://query1.finance.yahoo.com/v7/finance/quote?symbols=...
히스토리:    https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1y
```

- API 키 불필요
- 레이트 제한 시 자동 재시도 (3회, 지수 백오프)
- 실패 시 목 데이터로 폴백 (Random Walk 시뮬레이션)

---

## 📈 퀀트 분석 기능

### 1. 피어슨 상관계수
- 일별 수익률로 변환 후 계산
- 6×6 매트릭스 히트맵 시각화
- 마우스 호버로 세부 수치 확인

### 2. 롤링 상관관계
- 30일 / 90일 / 180일 윈도우 선택
- 시간에 따른 상관관계 변화 추적

### 3. 선행-후행(Lead-Lag) 분석
- 최대 ±20일 시차 탐색
- 절대 상관계수 최대화 기준 최적 시차 탐색

### 4. 자동 인사이트 (한국어)
- 강한 동반 상승 패턴 감지
- 역방향 헷지 관계 감지
- 금리-비트코인 리스크 분석
- 원화 약세 구간 코스피 주의

---

## 🔮 향후 확장 전략

1. **데이터 소스 다각화**: Alpha Vantage, Polygon.io API 추가
2. **Supabase 연동**: 분석 결과 저장, 알람 기능
3. **포트폴리오 시뮬레이터**: 자산 배분 최적화
4. **머신러닝 예측**: LSTM 기반 가격 예측 모델
5. **슬랙/이메일 알림**: 임계값 초과 시 자동 알림
6. **백테스팅 엔진**: 상관관계 기반 전략 검증

---

## 📄 라이선스

MIT © 2024 Asset Cycle Pro
