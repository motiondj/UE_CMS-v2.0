# Switchboard Plus v2.0 Client Package

## 개요
Switchboard Plus v2.0 클라이언트 패키지입니다. 다른 서버에서 실행할 수 있도록 패키징된 버전입니다.

## 파일 구성
- `switchboard_client.exe` - 패키징된 클라이언트 실행 파일
- `start_client.bat` - 로컬 서버용 시작 스크립트 (localhost:8000)
- `start_client_remote.bat` - 원격 서버용 시작 스크립트
- `README.md` - 사용법 설명서

## 사용법

### 1. 로컬 서버 연결 (localhost)
```bash
start_client.bat
```

### 2. 원격 서버 연결
1. `start_client_remote.bat` 파일을 편집하여 서버 주소를 수정:
   ```batch
   set SERVER_URL=http://서버IP:8000
   ```

2. 배치 파일 실행:
   ```bash
   start_client_remote.bat
   ```

## 시스템 요구사항
- Windows 10/11
- 네트워크 연결
- 서버 접근 권한

## 문제 해결
- 클라이언트가 연결되지 않는 경우 서버 주소를 확인하세요
- 방화벽 설정을 확인하세요
- 서버가 실행 중인지 확인하세요

## 로그
클라이언트 실행 시 콘솔에 연결 상태와 로그가 표시됩니다. 