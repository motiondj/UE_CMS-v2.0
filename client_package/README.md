# UE CMS v2.0 Client Package

UE CMS v2.0 클라이언트 패키지입니다. 다른 서버에서 실행할 수 있도록 패키징된 버전입니다.

## 📦 포함 파일

- `ue_cms_client.exe` - 패키징된 클라이언트 실행 파일
- `start_client.bat` - 로컬 서버용 시작 스크립트
- `start_client_remote.bat` - 원격 서버용 시작 스크립트

## 🚀 사용법

### 로컬 서버 연결
```bash
start_client.bat
```

### 원격 서버 연결
```bash
start_client_remote.bat http://192.168.1.100:8000
```

## ⚙️ 환경 변수

- `UECMS_SERVER_URL`: 서버 URL (기본값: http://localhost:8000)

## 📋 시스템 요구사항

- Windows 10/11
- 네트워크 연결
- 서버 실행 중

---

**UE CMS Team** - nDisplay 환경을 위한 최고의 콘텐츠 관리 솔루션 