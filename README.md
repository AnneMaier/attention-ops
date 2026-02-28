# Attention

**웹캠 기반 실시간 집중도 분석 서비스**

사용자의 얼굴 랜드마크를 실시간으로 추적하여 졸음, 하품, 주의 분산 상태를 감지하고 알림을 제공합니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 모니터링** | MediaPipe 기반 468개 얼굴 랜드마크 추적, EAR/MAR 알고리즘으로 상태 분석 |
| **즉각적 알림** | WebSocket을 통한 실시간 경고 (졸음, 주의분산, 하품 감지) |
| **분석 리포트** | 세션별 집중도 통계, 시간대별 패턴 시각화 |
| **AI 코칭** | 로컬 LLM(Ollama)을 활용한 맞춤형 학습 피드백 |

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client (Browser)                          │
│                    React + MediaPipe FaceLandmarker                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ WebSocket (30fps, 468 landmarks)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Rust WebSocket Server                           │
│            (Tokio async runtime, State Machine Pattern)             │
│         EAR/MAR 계산 → 상태 판정 → 알람 전송 + Redis Publish        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Redis Pub/Sub
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Redis (Message Broker)                       │
│                    고속 Producer ↔ 저속 Consumer 분리               │
└───────────────┬─────────────────────────────────┬───────────────────┘
                │                                 │
                ▼                                 ▼
┌───────────────────────────┐     ┌───────────────────────────────────┐
│   Python Data Saver       │     │         FastAPI Server            │
│   (MongoDB 영속화)        │     │   리포트 생성 + Ollama LLM 연동   │
└───────────────────────────┘     └───────────────────────────────────┘
```

---

## 기술 스택

| 레이어 | 기술 | 선택 이유 |
|--------|------|----------|
| **Frontend** | React (Vite) | 빠른 HMR, 경량 번들 |
| **실시간 처리** | Rust + Tokio | Python 대비 **25% 레이턴시 개선** (GIL 없음) |
| **메시지 브로커** | Redis Pub/Sub | 초당 3,564개 메시지 처리, 메모리 0.1MB 증가 |
| **API 서버** | FastAPI | 비동기 처리, 자동 OpenAPI 문서 |
| **AI/ML** | MediaPipe, Ollama | 브라우저 내 얼굴 인식, 로컬 LLM 코칭 |
| **DB** | MongoDB | 유연한 스키마, 세션 이벤트 집계 |
| **인프라** | Docker Compose | 로컬 개발 환경 통합 |

---

## 성능 지표

### Rust vs Python WebSocket 서버 벤치마크

| 지표 | Python | Rust | 개선율 |
|------|--------|------|--------|
| 평균 연결 지연 | 12.38ms | 9.31ms | **25% 단축** |
| P95 지연 시간 | 14.72ms | 11.13ms | **24% 단축** |

> 테스트 환경: 50명 동시 접속, 30fps, 30초간 부하 테스트 (K6)

### 데이터 파이프라인

| 지표 | 수치 |
|------|------|
| Redis 처리량 | **초당 3,564개** 메시지 |
| 메모리 증가 | 0.1MB (10,000개 메시지 처리 시) |
| E2E 지연 | < 1초 |

---

## 시작하기

### Prerequisites
- Docker & Docker Compose
- (선택) Ollama - AI 코칭 기능 사용 시

### 실행

```bash
# 클론
git clone https://github.com/your-repo/attention.git
cd attention

# 환경 변수 설정
cp .env.example .env

# 실행
docker-compose up --build
```

### 접근
- Frontend Dashboard: http://localhost:3000 (Local Run Only)
- API Documentation: http://localhost:8000/docs (Swagger UI)
- WebSocket Server: ws://localhost:8080 (Rust Core)

---

## 프로젝트 구조

<img width="5044" height="3128" alt="image (5)" src="https://github.com/user-attachments/assets/e5f61766-0049-444f-87cf-a10c68a094f6" />

```
attention/
├── react-dashboard/     # React 프론트엔드
├── websocket/           # Rust WebSocket 서버
├── fastapiServer/       # FastAPI 백엔드
├── sessionDataSave/     # Python 데이터 저장 서비스
├── nodejs/              # Node.js 서비스
├── k8s/                 # Kubernetes 매니페스트
├── attention-test/      # 부하 테스트 코드
└── docker-compose.yml   # 로컬 오케스트레이션





```

---

## 기술 블로그

프로젝트 개선 과정과 성능 검증 상세 내용:

1. [프로젝트 소개](https://velog.io/@hwengdeong/Attention-프로젝트-개선기-1.-프로젝트-소개)
2. [개선점 찾기](https://velog.io/@hwengdeong/Attention-프로젝트-개선기-2.-개선점-찾기)
3. [웹소켓 서버 성능 검증 (Rust vs Python)](https://velog.io/@hwengdeong/Attention-프로젝트-개선기-3.-개선-웹소켓-서버-성능-검증)
4. [하이브리드 네트워크 & 데이터 파이프라인 검증](https://velog.io/@hwengdeong/Attention-프로젝트-개선기-4.-검증-하이브리드-네트워크-데이터-파이프라인)

---

## 트러블슈팅 기록

| 문제 | 원인 | 해결 |
|------|------|------|
| sessionId 중복 생성 | 이벤트마다 `Date.now()` 호출 | `useState`로 세션 시작 시 1회만 생성 |
| uvicorn 무한 재시작 | `reload=True` + 파일 생성 | `reload=False`로 변경 |
| WSL↔Windows 통신 실패 | Docker 네트워크 격리 | `extra_hosts` + `HOST_GATEWAY` 환경변수 |
| WebSocket 재연결 폭주 | 고정 5초 재시도 | 지수 백오프 (1s → 2s → 4s → max 30s) |

---

## 기여 가이드

### 커밋 메시지 규칙

```
<type>: <subject>

<body>
```

| Type | 설명 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 코드 리팩터링 |
| `docs` | 문서 수정 |
| `test` | 테스트 코드 |

### 네이밍 규칙

- 폴더: 소문자 (`sessiondatasave`)
- 파일: PascalCase (`SessionPage.jsx`)
- 함수/변수: camelCase (`sendEvent`, `sessionId`)

---

## License

MIT
