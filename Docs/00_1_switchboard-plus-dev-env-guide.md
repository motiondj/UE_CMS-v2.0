# Switchboard Plus v2 - 개발 환경 설정 가이드

## 📋 문서 개요

**대상**: 개발 초보자  
**목적**: Switchboard Plus 개발을 위한 완전한 환경 구축  
**소요 시간**: 약 1-2시간  
**난이도**: ⭐⭐☆☆☆ (초보자 친화적)

> 🎯 **목표**: 이 가이드를 따라하면 누구나 개발을 시작할 수 있습니다!

---

## 🛠️ 1. 필수 프로그램 설치

### 1.1 Node.js 설치 (서버 개발용)

#### Windows
1. **다운로드**: https://nodejs.org 접속
2. **LTS 버전** 다운로드 (왼쪽 초록색 버튼)
3. 다운로드한 파일 실행
4. 설치 과정에서 **모두 기본값으로 Next** 클릭
5. **설치 확인** (명령 프롬프트에서):
```bash
node --version
# v18.17.0 같은 버전이 나오면 성공!

npm --version  
# 9.6.7 같은 버전이 나오면 성공!
```

#### Mac
1. **Homebrew 설치** (터미널에서):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
2. **Node.js 설치**:
```bash
brew install node
```

### 1.2 Python 설치 (클라이언트 개발용)

#### Windows
1. **다운로드**: https://www.python.org/downloads/
2. **Download Python 3.11.x** 클릭
3. 설치 시작 화면에서 **⚠️ 중요**:
   - ✅ **"Add Python to PATH"** 체크박스 반드시 선택!
4. **Install Now** 클릭
5. **설치 확인** (명령 프롬프트에서):
```bash
python --version
# Python 3.11.5 같은 버전이 나오면 성공!

pip --version
# pip 23.2.1 같은 버전이 나오면 성공!
```

#### Mac
```bash
brew install python
```

### 1.3 Visual Studio Code 설치 (코드 편집기)

1. **다운로드**: https://code.visualstudio.com/
2. **Download for Windows/Mac** 클릭
3. 설치 진행 (모두 기본값)
4. **필수 확장 프로그램 설치**:
   - VSCode 실행 후 왼쪽 Extensions 아이콘 클릭 (또는 Ctrl+Shift+X)
   - 다음 확장 프로그램 검색해서 Install:
     - `Python` (Microsoft)
     - `JavaScript (ES6) code snippets`
     - `Prettier - Code formatter`
     - `SQLite Viewer`

### 1.4 Git 설치 (버전 관리)

#### Windows
1. **다운로드**: https://git-scm.com/download/windows
2. 64-bit Git for Windows Setup 다운로드
3. 설치 시 **모두 기본값** 사용
4. **설치 확인**:
```bash
git --version
# git version 2.42.0.windows.1 같은 버전이 나오면 성공!
```

#### Mac
```bash
brew install git
```

### 1.5 추가 도구

#### DB Browser for SQLite (데이터베이스 확인용)
1. **다운로드**: https://sqlitebrowser.org/dl/
2. 운영체제에 맞는 버전 다운로드 및 설치

---

## 📁 2. 프로젝트 폴더 구조 만들기

### 2.1 프로젝트 폴더 생성

#### Windows (명령 프롬프트)
```bash
# 바탕화면에 프로젝트 폴더 만들기
cd %USERPROFILE%\Desktop
mkdir switchboard-plus-v2
cd switchboard-plus-v2
```

#### Mac (터미널)
```bash
# 바탕화면에 프로젝트 폴더 만들기
cd ~/Desktop
mkdir switchboard-plus-v2
cd switchboard-plus-v2
```

### 2.2 하위 폴더 구조 생성

```bash
# 필수 폴더들 만들기
mkdir server
mkdir client  
mkdir web-ui
mkdir docs
mkdir database
```

**폴더 설명**:
- `server/` - Node.js 서버 코드
- `client/` - Python 클라이언트 코드
- `web-ui/` - 웹 인터페이스 (이미 만들어진 HTML)
- `docs/` - 개발 문서들
- `database/` - SQLite 데이터베이스 파일

---

## 🚀 3. 서버 초기 설정

### 3.1 서버 폴더로 이동
```bash
cd server
```

### 3.2 package.json 생성
```bash
npm init -y
```

### 3.3 필수 패키지 설치
```bash
npm install express sqlite3 socket.io cors body-parser
```

### 3.4 개발용 패키지 설치
```bash
npm install --save-dev nodemon
```

### 3.5 package.json 수정
`server/package.json` 파일을 열고 scripts 부분을 다음과 같이 수정:

```json
{
  "name": "switchboard-plus-server",
  "version": "2.0.0",
  "description": "Switchboard Plus v2 Server",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  // ... 나머지 내용
}
```

### 3.6 테스트 서버 파일 생성
`server/app.js` 파일 생성:

```javascript
const express = require('express');
const app = express();
const PORT = 8000;

app.get('/', (req, res) => {
    res.json({ message: 'Switchboard Plus Server is running!' });
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
```

### 3.7 서버 실행 테스트
```bash
npm run dev
```
브라우저에서 http://localhost:8000 접속해서 메시지 확인

---

## 🐍 4. Python 클라이언트 초기 설정

### 4.1 클라이언트 폴더로 이동
```bash
cd ../client
```

### 4.2 가상 환경 생성 (권장)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux  
python3 -m venv venv
source venv/bin/activate
```

### 4.3 필수 패키지 설치
```bash
pip install requests websocket-client pyinstaller
```

### 4.4 requirements.txt 생성
```bash
pip freeze > requirements.txt
```

### 4.5 테스트 클라이언트 파일 생성
`client/test_client.py` 파일 생성:

```python
import requests

def test_server_connection():
    try:
        response = requests.get('http://localhost:8000')
        print(f"✅ 서버 연결 성공: {response.json()}")
    except Exception as e:
        print(f"❌ 서버 연결 실패: {e}")

if __name__ == "__main__":
    test_server_connection()
```

### 4.6 클라이언트 실행 테스트
```bash
python test_client.py
```

---

## 🌐 5. 웹 UI 설정

### 5.1 web-ui 폴더로 이동
```bash
cd ../web-ui
```

### 5.2 HTML 파일 복사
이미 만들어진 `switchboard_plus_ui_updated.html` 파일을 이 폴더에 복사하고 이름을 `index.html`로 변경

### 5.3 정적 파일 서빙 설정
`server/app.js`에 다음 코드 추가:

```javascript
const path = require('path');

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, '../web-ui')));
```

---

## 🔧 6. 네트워크 설정

### 6.1 Windows 방화벽 설정

1. **Windows 방화벽** 열기
2. **고급 설정** 클릭
3. **인바운드 규칙** → **새 규칙**
4. **포트** 선택 → 다음
5. **TCP** 선택, 특정 로컬 포트: `8000,8081` 입력
6. **연결 허용** → 다음 → 다음
7. 이름: `Switchboard Plus` → 마침

### 6.2 고정 IP 설정 (Display PC용)

1. **네트워크 및 인터넷 설정** 열기
2. **어댑터 옵션 변경**
3. 사용 중인 네트워크 어댑터 우클릭 → **속성**
4. **인터넷 프로토콜 버전 4 (TCP/IPv4)** 더블클릭
5. **다음 IP 주소 사용** 선택:
   - IP 주소: `192.168.1.101` (PC마다 다르게)
   - 서브넷 마스크: `255.255.255.0`
   - 기본 게이트웨이: `192.168.1.1` (라우터 IP)

---

## 📋 7. VSCode 개발 환경 최적화

### 7.1 추천 설정
VSCode에서 `Ctrl + ,` (설정) → 우측 상단 `{}` 아이콘 클릭 → 다음 추가:

```json
{
    "editor.formatOnSave": true,
    "editor.tabSize": 4,
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "javascript.updateImportsOnFileMove.enabled": "always",
    "files.autoSave": "afterDelay",
    "files.autoSaveDelay": 1000
}
```

### 7.2 디버깅 설정
`.vscode/launch.json` 파일 생성:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Launch Server",
            "program": "${workspaceFolder}/server/app.js",
            "cwd": "${workspaceFolder}/server"
        },
        {
            "type": "python",
            "request": "launch",
            "name": "Launch Client",
            "program": "${workspaceFolder}/client/main.py",
            "cwd": "${workspaceFolder}/client"
        }
    ]
}
```

---

## 🧪 8. 전체 시스템 테스트

### 8.1 서버 실행
터미널 1에서:
```bash
cd server
npm run dev
```

### 8.2 웹 UI 접속
브라우저에서 http://localhost:8000 접속

### 8.3 Python 클라이언트 실행
터미널 2에서:
```bash
cd client
python test_client.py
```

### 8.4 성공 확인
- ✅ 서버 콘솔에 "Server is running" 메시지
- ✅ 웹 UI 정상 표시
- ✅ Python 클라이언트 "연결 성공" 메시지

---

## 🆘 9. 자주 발생하는 문제 해결

### 9.1 'node' is not recognized (Windows)
- **원인**: Node.js PATH 설정 안됨
- **해결**: 
  1. Node.js 재설치
  2. 또는 시스템 환경 변수에 수동 추가

### 9.2 Python 모듈 import 오류
- **원인**: 가상환경 활성화 안됨
- **해결**: 
```bash
# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 9.3 포트 사용 중 오류
- **원인**: 8000 포트가 이미 사용 중
- **해결**: 
```bash
# Windows - 포트 확인
netstat -ano | findstr :8000

# 해당 프로세스 종료
taskkill /PID [프로세스ID] /F
```

### 9.4 방화벽 차단
- **원인**: Windows Defender 방화벽
- **해결**: 위의 6.1 방화벽 설정 참조

---

## ✅ 10. 다음 단계

환경 설정이 완료되었다면:

1. **MVP 개발 시작**: `01_v2.0_mvp_development_plan.md` 문서 참조
2. **Git 저장소 생성**: 
```bash
git init
git add .
git commit -m "Initial setup"
```

3. **첫 기능 구현**: 클라이언트 등록 API부터 시작

---

## 📞 11. 도움이 필요할 때

- **Node.js 문제**: https://nodejs.org/en/docs/
- **Python 문제**: https://docs.python.org/3/
- **VSCode 문제**: https://code.visualstudio.com/docs
- **일반적인 문제**: Stack Overflow에서 검색

> 💡 **팁**: 에러 메시지를 그대로 복사해서 구글에 검색하면 대부분 해결책을 찾을 수 있습니다!

---

**🎉 축하합니다! 이제 Switchboard Plus 개발을 시작할 준비가 완료되었습니다!**