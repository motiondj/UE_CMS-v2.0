# UE CMS Client v2.0 - 배포 가이드

## 📦 패키지 내용

```
ue_cms_client_package/
├── ue_cms_client.exe          # 메인 클라이언트 실행 파일
├── start_client.bat           # 기본 실행 (localhost)
├── start_client_interactive.bat  # 대화형 실행 (서버 IP 입력)
├── config.json               # 설정 파일
└── README_DEPLOY.md          # 이 파일
```

## 🚀 다른 PC에서 실행하기

### 방법 1: 대화형 실행 (권장)

1. **패키지 압축 해제**
   ```
   ue_cms_client_package.zip 파일을 압축 해제
   ```

2. **대화형 실행 파일 실행**
   ```
   start_client_interactive.bat 더블클릭
   ```

3. **서버 IP 입력**
   - 현재 네트워크 정보가 표시됩니다
   - 서버 IP 주소를 입력하세요 (예: 192.168.1.100)
   - Enter만 누르면 localhost:8000 사용

4. **자동 연결**
   - 클라이언트가 자동으로 서버에 연결됩니다
   - 연결 상태가 실시간으로 표시됩니다

### 방법 2: 명령행 실행

```cmd
# 서버 IP 지정하여 실행
ue_cms_client.exe --server http://192.168.1.100:8000 --name "MyPC"

# 또는 설정 파일 사용
ue_cms_client.exe --config config.json
```

## ⚙️ 설정 파일 (config.json)

```json
{
  "server_url": "http://192.168.1.100:8000",
  "client_name": "MyPC",
  "saved_at": "2024-01-01T12:00:00"
}
```

## 🔧 문제 해결

### 클라이언트가 즉시 오프라인으로 바뀌는 경우

1. **서버 IP 확인**
   - 서버가 실행 중인 PC의 IP 주소를 정확히 입력했는지 확인
   - `ipconfig` 명령으로 서버 PC의 IP 확인

2. **방화벽 설정**
   - Windows 방화벽에서 포트 8000 허용
   - 서버 PC의 방화벽 설정 확인

3. **네트워크 연결**
   - 클라이언트 PC에서 서버 PC로 ping 테스트
   - 같은 네트워크에 있는지 확인

### 연결이 안 되는 경우

1. **서버 상태 확인**
   - 서버가 실행 중인지 확인
   - 웹 브라우저에서 `http://서버IP:8000` 접속 테스트

2. **포트 확인**
   - 서버가 포트 8000에서 실행 중인지 확인
   - 다른 포트를 사용하는 경우 URL에 포트 번호 포함

3. **로그 확인**
   - 클라이언트 실행 시 오류 메시지 확인
   - 서버 로그에서 연결 시도 확인

## 📋 시스템 요구사항

- **운영체제**: Windows 10/11
- **네트워크**: 서버와 같은 네트워크
- **권한**: 일반 사용자 권한으로 실행 가능

## 🔄 자동 재연결

클라이언트는 네트워크 문제나 서버 재시작 시 자동으로 재연결을 시도합니다:
- 연결 끊김 감지 시 즉시 재연결 시도
- 지수 백오프 방식으로 재시도 간격 증가
- 무한 재연결 시도 (수동 종료까지)

## 📞 지원

문제가 발생하면 다음 정보를 포함하여 문의하세요:
- 클라이언트 실행 시 오류 메시지
- 서버 IP 주소
- 네트워크 환경 (같은 네트워크/다른 네트워크)
- 방화벽 설정 상태 