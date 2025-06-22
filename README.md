# Switchboard Plus v2.0

언리얼엔진 nDisplay 원격 제어를 위한 통합 웹 시스템

## 🚀 빠른 시작

### 1. 서버 실행

```bash
cd server
npm install
npm start
```

서버는 `http://localhost:8000`에서 실행됩니다.

### 2. 웹 UI 실행

```bash
cd web-ui-react
npm install
npm start
```

웹 UI는 `http://localhost:3000`에서 실행됩니다.

### 3. Python 클라이언트 실행

```bash
cd client
pip install -r requirements.txt
python client.py --name "Display-PC-01"
```

## 📁 프로젝트 구조

```
switchboard-plus-v2/
├── server/                 # Node.js 서버
│   ├── app.js             # 메인 서버 파일
│   ├── package.json       # 서버 의존성
│   └── switchboard.db     # SQLite 데이터베이스
├── web-ui-react/          # React 웹 UI
│   ├── src/
│   │   ├── components/    # React 컴포넌트
│   │   ├── App.js         # 메인 앱
│   │   └── index.js       # 진입점
│   └── package.json       # UI 의존성
└── client/                # Python 클라이언트
    ├── client.py          # 클라이언트 메인
    └── requirements.txt   # Python 의존성
```

## 🔧 주요 기능

- **클라이언트 관리**: Display PC 등록 및 모니터링
- **그룹 관리**: 클라이언트 그룹화
- **프리셋 관리**: 명령어 프리셋 생성 및 실행
- **실시간 통신**: Socket.io를 통한 실시간 상태 업데이트
- **실행 히스토리**: 프리셋 실행 기록 관리

## 📖 사용법

1. **클라이언트 등록**: 웹 UI에서 Display PC 정보를 등록
2. **그룹 생성**: 관련 클라이언트들을 그룹으로 묶기
3. **프리셋 생성**: 실행할 명령어를 프리셋으로 저장
4. **프리셋 실행**: 웹 UI에서 원클릭으로 nDisplay 제어

## 🛠️ 개발 환경

- **서버**: Node.js, Express, Socket.io, SQLite
- **클라이언트**: Python 3.7+
- **웹 UI**: React 18, Socket.io-client

## 📝 API 문서

### 클라이언트 API
- `GET /api/clients` - 클라이언트 목록 조회
- `POST /api/clients` - 클라이언트 추가
- `DELETE /api/clients/:id` - 클라이언트 삭제

### 그룹 API
- `GET /api/groups` - 그룹 목록 조회
- `POST /api/groups` - 그룹 추가
- `DELETE /api/groups/:id` - 그룹 삭제

### 프리셋 API
- `GET /api/presets` - 프리셋 목록 조회
- `POST /api/presets` - 프리셋 추가
- `DELETE /api/presets/:id` - 프리셋 삭제
- `POST /api/presets/:id/execute` - 프리셋 실행

## 🔌 Socket.io 이벤트

- `client_added` - 클라이언트 추가 알림
- `client_deleted` - 클라이언트 삭제 알림
- `client_status_changed` - 클라이언트 상태 변경
- `preset_executed` - 프리셋 실행 알림
- `execution_updated` - 실행 상태 업데이트

## 🐛 문제 해결

### 서버 실행 오류
- 포트 8000이 사용 중인 경우: `netstat -ano | findstr :8000`로 프로세스 확인 후 종료
- Node.js 버전 확인: `node --version` (v14 이상 권장)

### 클라이언트 연결 오류
- 서버 IP 주소 확인
- 방화벽 설정 확인
- Python 의존성 설치 확인

### 웹 UI 빌드 오류
- Node.js 버전 확인
- `npm cache clean --force` 실행
- `node_modules` 삭제 후 재설치

## 📄 라이선스

MIT License

## 🤝 기여

버그 리포트나 기능 제안은 이슈로 등록해 주세요. 