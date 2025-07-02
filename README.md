# UE CMS v2.0

UE CMS (Unreal Engine Content Management System) v2.0은 nDisplay 환경에서 콘텐츠를 효율적으로 관리하고 제어할 수 있는 통합 시스템입니다.

## 🚀 주요 기능

- **실시간 클라이언트 관리**: 연결된 모든 클라이언트의 상태 모니터링
- **프리셋 시스템**: 미리 정의된 콘텐츠 실행 설정 관리
- **그룹 관리**: 클라이언트들을 논리적 그룹으로 구성
- **웹 기반 UI**: 직관적인 웹 인터페이스로 쉬운 제어
- **실시간 통신**: Socket.io를 통한 실시간 데이터 동기화
- **SyncGuard 통합**: 쿼드로 싱크 모니터링 기능

## 📁 프로젝트 구조

```
UE_CMS-v2.0/
├── server/                 # Node.js 서버
│   ├── app.js             # 메인 서버 파일
│   ├── package.json       # 서버 의존성
│   ├── config/            # 서버 설정
│   ├── controllers/       # API 컨트롤러
│   ├── models/            # 데이터베이스 모델
│   ├── routes/            # API 라우트
│   ├── services/          # 비즈니스 로직
│   └── ue_cms.db         # SQLite 데이터베이스
├── client/                # Python 클라이언트
│   ├── client.py         # 메인 클라이언트
│   ├── client_tray.py    # 트레이 아이콘 클라이언트
│   ├── requirements.txt  # Python 의존성
│   └── config.json       # 클라이언트 설정
├── web-ui-react/         # React 웹 UI
│   ├── src/              # 소스 코드
│   └── public/           # 정적 파일
├── Docs/                 # 문서 및 가이드
├── backup/               # 백업 파일들 (Git에서 제외됨)
└── build scripts/        # 빌드 스크립트들
```

## 🛠️ 설치 및 실행

### 1. 서버 실행
```bash
cd server
npm install
npm start
```

### 2. 클라이언트 실행
```bash
cd client
pip install -r requirements.txt
python client.py
```

### 3. 웹 UI 실행
```bash
cd web-ui-react
npm install
npm start
```

## 🔧 배치 파일 사용

### 서버 시작
```bash
start_server.bat
# 또는
start_server.ps1
```

### 클라이언트 시작
```bash
client/start_client_tray.bat
```

## 📊 시스템 요구사항

- **Node.js**: v16 이상
- **Python**: v3.8 이상
- **Windows**: 10/11 (클라이언트용)
- **네트워크**: TCP/IP 통신 지원

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 기능 브랜치를 생성합니다 (`git checkout -b feature/AmazingFeature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/AmazingFeature`)
5. Pull Request를 생성합니다

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

- **이메일**: uecms@email.com
- **문서**: `Docs/` 폴더 참조
- **이슈**: GitHub Issues 사용

---

**UE CMS Team** - nDisplay 환경을 위한 최고의 콘텐츠 관리 솔루션 