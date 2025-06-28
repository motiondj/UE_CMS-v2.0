# UE CMS v2 - 개발 환경 설정 가이드

**목적**: UE CMS 개발을 위한 완전한 환경 구축
**대상**: 개발자, 시스템 관리자
**버전**: v2.0

## 📋 개요

이 가이드는 UE CMS v2.0 개발을 위한 완전한 개발 환경을 구축하는 방법을 설명합니다. Node.js 서버, Python 클라이언트, React 웹 UI를 포함한 전체 스택 개발 환경을 설정합니다.

## 🎯 목표

- Node.js 서버 개발 환경 구축
- Python 클라이언트 개발 환경 구축
- React 웹 UI 개발 환경 구축
- 데이터베이스 설정
- 개발 도구 및 IDE 설정

## 🛠️ 시스템 요구사항

### 하드웨어
- **CPU**: Intel i5 이상 또는 AMD Ryzen 5 이상
- **RAM**: 8GB 이상 (16GB 권장)
- **저장공간**: 10GB 이상의 여유 공간
- **네트워크**: 인터넷 연결 (패키지 다운로드용)

### 소프트웨어
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 18.04+
- **Node.js**: v16.0.0 이상
- **Python**: v3.8.0 이상
- **Git**: v2.30.0 이상
- **VS Code**: v1.60.0 이상 (권장)

## 📦 필수 소프트웨어 설치

### 1. Node.js 설치

#### Windows
1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 설치 파일 실행 및 기본 설정으로 설치
3. 설치 확인:
   ```bash
   node --version
   npm --version
   ```

#### macOS
```bash
# Homebrew 사용
brew install node

# 또는 공식 설치 파일 사용
# https://nodejs.org/에서 다운로드
```

#### Ubuntu/Debian
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -

# Node.js 설치
sudo apt-get install -y nodejs

# 설치 확인
node --version
npm --version
```

### 2. Python 설치

#### Windows
1. [Python 공식 사이트](https://python.org/)에서 v3.8 이상 다운로드
2. 설치 시 "Add Python to PATH" 옵션 체크
3. 설치 확인:
   ```bash
   python --version
   pip --version
   ```

#### macOS
```bash
# Homebrew 사용
brew install python@3.8

# 또는 pyenv 사용
pyenv install 3.8.12
pyenv global 3.8.12
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv

# 설치 확인
python3 --version
pip3 --version
```

### 3. Git 설치

#### Windows
1. [Git 공식 사이트](https://git-scm.com/)에서 다운로드
2. 기본 설정으로 설치
3. 설치 확인:
   ```bash
   git --version
   ```

#### macOS
```bash
# Homebrew 사용
brew install git

# 또는 Xcode Command Line Tools와 함께 설치
xcode-select --install
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install git

# 설치 확인
git --version
```

### 4. VS Code 설치 (권장)

#### Windows/macOS
1. [VS Code 공식 사이트](https://code.visualstudio.com/)에서 다운로드
2. 기본 설정으로 설치

#### Ubuntu/Debian
```bash
sudo snap install code --classic
```

#### 추천 확장 프로그램
- **Python**: Python 언어 지원
- **JavaScript (ES6) code snippets**: JS 코드 스니펫
- **Auto Rename Tag**: HTML/JSX 태그 자동 변경
- **Bracket Pair Colorizer**: 괄호 색상 구분
- **GitLens**: Git 통합 강화
- **Live Server**: 로컬 서버 실행
- **Thunder Client**: API 테스트

## 🏗️ 프로젝트 구조 생성

### 1. 프로젝트 디렉토리 생성

```bash
# 프로젝트 루트 디렉토리 생성
mkdir ue-cms-v2
cd ue-cms-v2

# 서브 디렉토리 생성
mkdir server
mkdir client
mkdir web-ui-react
mkdir Docs
mkdir client_package
```

### 2. Git 저장소 초기화

```bash
# Git 초기화
git init

# .gitignore 파일 생성
cat > .gitignore << EOF
# Dependencies
node_modules/
venv/
__pycache__/
*.pyc

# Build outputs
build/
dist/
*.exe

# Environment variables
.env
.env.local

# Logs
*.log
npm-debug.log*

# Database
*.db
*.sqlite

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
EOF

# 초기 커밋
git add .
git commit -m "Initial project structure"
```

## 🖥️ 서버 개발 환경 설정

### 1. 서버 디렉토리 설정

```bash
cd server

# package.json 생성
npm init -y

# package.json 수정
cat > package.json << EOF
{
  "name": "ue-cms-server",
  "version": "2.0.0",
  "description": "UE CMS v2 Server",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["ue-cms", "ndisplay", "control"],
  "author": "UE CMS Team",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

# 의존성 설치
npm install

# 기본 서버 파일 생성
cat > app.js << EOF
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 데이터베이스 초기화
const db = new sqlite3.Database('ue_cms.db');

// 기본 라우트
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'UE CMS Server v2.0'
  });
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
  console.log('클라이언트 연결됨:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

// 서버 시작
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(\`🚀 UE CMS Server가 포트 \${PORT}에서 실행 중입니다.\`);
  console.log(\`📱 웹 인터페이스: http://localhost:\${PORT}\`);
});
EOF

# public 디렉토리 생성
mkdir public

# 기본 HTML 파일 생성
cat > public/index.html << EOF
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UE CMS v2.0</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 20px;
        }
        .status {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ UE CMS v2.0</h1>
        <div class="status">
            <h2>서버 상태</h2>
            <p>✅ 서버가 정상적으로 실행 중입니다</p>
            <p>포트: 8000</p>
            <p>시간: <span id="time"></span></p>
        </div>
    </div>
    <script>
        function updateTime() {
            document.getElementById('time').textContent = new Date().toLocaleString('ko-KR');
        }
        updateTime();
        setInterval(updateTime, 1000);
    </script>
</body>
</html>
EOF

cd ..
```

### 2. 서버 테스트

```bash
cd server
npm start
```

브라우저에서 `http://localhost:8000`에 접속하여 서버가 정상적으로 실행되는지 확인합니다.

## 🐍 클라이언트 개발 환경 설정

### 1. Python 가상환경 생성

```bash
cd client

# Python 가상환경 생성
python -m venv venv

# 가상환경 활성화 (Windows)
venv\Scripts\activate

# 가상환경 활성화 (macOS/Linux)
source venv/bin/activate

# pip 업그레이드
pip install --upgrade pip
```

### 2. 의존성 설치

```bash
# requirements.txt 생성
cat > requirements.txt << EOF
python-socketio==5.8.0
requests==2.31.0
psutil==5.9.5
pystray==0.19.4
pillow==10.0.0
wmi==1.5.1
EOF

# 의존성 설치
pip install -r requirements.txt
```

### 3. 기본 클라이언트 파일 생성

```bash
cat > client.py << EOF
import socketio
import requests
import time
import logging
import os
import socket
from datetime import datetime
import argparse

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('client.log'),
        logging.StreamHandler()
    ]
)

class UECMSClient:
    def __init__(self, server_url="http://localhost:8000", client_name=None):
        self.server_url = server_url
        self.client_name = client_name or self.get_computer_name()
        self.client_id = None
        self.sio = socketio.Client()
        self.running = False
        
        # Socket.io 이벤트 핸들러 등록
        self.sio.on('connect', self.on_connect)
        self.sio.on('disconnect', self.on_disconnect)
        
        logging.info(f"클라이언트 초기화 완료: {self.client_name}")
    
    def get_computer_name(self):
        """컴퓨터의 실제 호스트명을 가져옵니다."""
        try:
            return socket.gethostname()
        except:
            return f"Client_{os.getpid()}"
    
    def get_local_ip(self):
        """로컬 IP 주소를 가져옵니다."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def connect_socket(self):
        """Socket.io 연결을 설정합니다."""
        try:
            self.sio.connect(self.server_url)
            self.running = True
            print(f"✅ Socket.io 연결 성공: {self.client_name}")
            logging.info("Socket.io 연결 성공")
            return True
        except Exception as e:
            print(f"❌ Socket.io 연결 실패: {e}")
            logging.error(f"Socket.io 연결 실패: {e}")
            return False
    
    def on_connect(self):
        """Socket.io 연결 시 호출됩니다."""
        print(f"🔌 서버에 연결되었습니다: {self.client_name}")
        logging.info("서버에 연결되었습니다")
        
        # 클라이언트 등록
        self.sio.emit('register_client', {
            'name': self.client_name,
            'clientType': 'python'
        })
        print(f"📝 클라이언트 등록 요청 전송: {self.client_name}")
        
        self.start_heartbeat()
    
    def start_heartbeat(self):
        """하트비트 전송을 시작합니다."""
        def heartbeat_loop():
            while self.running:
                try:
                    self.sio.emit('heartbeat', {
                        'clientName': self.client_name,
                        'timestamp': datetime.now().isoformat()
                    })
                    time.sleep(30)  # 30초마다 하트비트
                except Exception as e:
                    logging.error(f"하트비트 전송 오류: {e}")
                    time.sleep(5)
        
        import threading
        heartbeat_thread = threading.Thread(target=heartbeat_loop, daemon=True)
        heartbeat_thread.start()
    
    def on_disconnect(self):
        """Socket.io 연결 해제 시 호출됩니다."""
        print(f"🔌 서버와의 연결이 해제되었습니다: {self.client_name}")
        logging.info("서버와의 연결이 해제되었습니다")
    
    def start(self):
        """클라이언트를 시작합니다."""
        try:
            logging.info("클라이언트 시작")
            print(f"🚀 UE CMS Client 시작: {self.client_name}")
            
            # Socket.io 연결
            if self.connect_socket():
                print("✅ Socket.io 연결 성공")
            else:
                print("⚠️ Socket.io 연결 실패")
            
            # 메인 루프
            while self.running:
                try:
                    time.sleep(1)
                except KeyboardInterrupt:
                    print("\\n🛑 사용자에 의해 종료됨")
                    break
                
        except KeyboardInterrupt:
            print("\\n🛑 사용자에 의해 종료됨")
        except Exception as e:
            logging.error(f"클라이언트 실행 중 오류: {e}")
            print(f"❌ 클라이언트 실행 중 오류: {e}")
        finally:
            self.stop()
    
    def stop(self):
        """클라이언트를 중지합니다."""
        print(f"🛑 클라이언트 종료 중: {self.client_name}")
        self.running = False
        
        try:
            if self.sio.connected:
                self.sio.disconnect()
        except Exception as e:
            print(f"⚠️ 소켓 연결 해제 중 오류: {e}")
        
        logging.info("클라이언트 종료")
        print(f"✅ 클라이언트 종료 완료: {self.client_name}")

def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description='UE CMS Client')
    parser.add_argument('--server', default='http://localhost:8000', help='서버 URL')
    parser.add_argument('--name', help='클라이언트 이름')
    
    args = parser.parse_args()
    
    try:
        client = UECMSClient(
            server_url=args.server,
            client_name=args.name
        )
        
        print(f"컴퓨터 이름: {client.client_name}")
        
        client.start()
        
    except KeyboardInterrupt:
        print("\\n🛑 사용자에 의해 종료됨")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
EOF

cd ..
```

### 3. 클라이언트 테스트

```bash
cd client

# 가상환경 활성화 (아직 활성화되지 않은 경우)
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# 클라이언트 실행
python client.py --name "TestClient"
```

## 🌐 웹 UI 개발 환경 설정

### 1. React 프로젝트 생성

```bash
cd web-ui-react

# Create React App으로 프로젝트 생성
npx create-react-app . --template typescript --yes

# package.json 수정
cat > package.json << EOF
{
  "name": "ue-cms-ui",
  "version": "2.0.0",
  "private": true,
  "dependencies": {
    "@testing-library/jest-dom": "^5.16.4",
    "@testing-library/react": "^13.3.0",
    "@testing-library/user-event": "^13.5.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "socket.io-client": "^4.7.2",
    "web-vitals": "^2.1.4"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF

# 의존성 설치
npm install

# socket.io-client 추가 설치
npm install socket.io-client
```

### 2. 기본 App.js 수정

```bash
cat > src/App.js << EOF
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const newSocket = io('http://localhost:8000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      setMessage('서버에 연결되었습니다');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setMessage('서버 연결이 끊어졌습니다');
    });

    return () => newSocket.close();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>⚡ UE CMS v2.0</h1>
        <div className="status">
          <p>연결 상태: {isConnected ? '✅ 연결됨' : '❌ 연결 끊김'}</p>
          <p>{message}</p>
        </div>
      </header>
    </div>
  );
}

export default App;
EOF
```

### 3. CSS 스타일 수정

```bash
cat > src/App.css << EOF
.App {
  text-align: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.App-header {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
}

.status {
  background: rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 10px;
  margin: 20px 0;
}

h1 {
  margin-bottom: 20px;
  font-size: 3rem;
}
EOF
```

### 4. 웹 UI 테스트

```bash
npm start
```

브라우저에서 `http://localhost:3000`에 접속하여 React 앱이 정상적으로 실행되는지 확인합니다.

## 🔧 개발 도구 설정

### 1. VS Code 설정

```bash
# .vscode 디렉토리 생성
mkdir .vscode

# settings.json 생성
cat > .vscode/settings.json << EOF
{
  "editor.formatOnSave": true,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "files.autoSave": "onFocusChange",
  "python.defaultInterpreterPath": "./client/venv/Scripts/python.exe",
  "python.terminal.activateEnvironment": true,
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  }
}
EOF

# launch.json 생성 (디버깅용)
cat > .vscode/launch.json << EOF
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Server",
      "type": "node",
      "request": "launch",
      "program": "\${workspaceFolder}/server/app.js",
      "cwd": "\${workspaceFolder}/server",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Launch Client",
      "type": "python",
      "request": "launch",
      "program": "\${workspaceFolder}/client/client.py",
      "cwd": "\${workspaceFolder}/client",
      "args": ["--name", "DebugClient"],
      "python": "\${workspaceFolder}/client/venv/Scripts/python.exe"
    }
  ]
}
EOF
```

### 2. 배치 파일 생성

```bash
# 서버 시작 스크립트 (Windows)
cat > start_server.bat << EOF
@echo off
title UE CMS Server
cd /d "%~dp0server"
echo.
echo  Launching UE CMS v2.0 Server
echo.
npm start
pause
EOF

# 클라이언트 시작 스크립트 (Windows)
cat > start_client.bat << EOF
@echo off
title UE CMS Client
cd /d "%~dp0client"
echo.
echo  Launching UE CMS v2.0 Client
echo.
call venv\\Scripts\\activate.bat
python client.py
pause
EOF

# 웹 UI 시작 스크립트 (Windows)
cat > start_web_ui.bat << EOF
@echo off
title UE CMS Web UI
cd /d "%~dp0web-ui-react"
echo.
echo  Launching UE CMS v2.0 Web UI
echo.
npm start
pause
EOF
```

## 🧪 통합 테스트

### 1. 전체 시스템 테스트

```bash
# 1. 서버 시작
cd server
npm start

# 2. 새 터미널에서 클라이언트 시작
cd client
venv\Scripts\activate  # Windows
python client.py --name "TestClient"

# 3. 새 터미널에서 웹 UI 시작
cd web-ui-react
npm start
```

### 2. 테스트 시나리오

1. **서버 연결 테스트**
   - 브라우저에서 `http://localhost:8000` 접속
   - 서버 상태 확인

2. **클라이언트 연결 테스트**
   - 클라이언트 실행 후 서버 로그 확인
   - 웹 UI에서 연결 상태 확인

3. **실시간 통신 테스트**
   - 클라이언트 연결/해제 시 웹 UI 업데이트 확인
   - 하트비트 메시지 확인

## 📝 개발 워크플로우

### 1. 일일 개발 루틴

```bash
# 1. 프로젝트 디렉토리로 이동
cd ue-cms-v2

# 2. 서버 개발
cd server
npm run dev  # nodemon으로 개발 모드 실행

# 3. 클라이언트 개발
cd ../client
venv\Scripts\activate
python client.py --name "DevClient"

# 4. 웹 UI 개발
cd ../web-ui-react
npm start
```

### 2. 코드 커밋

```bash
# 변경사항 확인
git status

# 변경사항 추가
git add .

# 커밋
git commit -m "Add feature: [기능 설명]"

# 원격 저장소에 푸시 (GitHub 등)
git push origin main
```

## 🔍 문제 해결

### 일반적인 문제들

#### 1. 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :8000  # Windows
lsof -i :8000  # macOS/Linux

# 프로세스 종료
taskkill /PID [PID] /F  # Windows
kill -9 [PID]  # macOS/Linux
```

#### 2. Python 가상환경 문제
```bash
# 가상환경 재생성
rm -rf venv
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

#### 3. Node.js 의존성 문제
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules
npm install
```

#### 4. CORS 오류
```bash
# 서버의 CORS 설정 확인
# app.js에서 cors() 미들웨어가 제대로 설정되어 있는지 확인
```

## 📚 추가 리소스

### 문서
- [Node.js 공식 문서](https://nodejs.org/docs/)
- [Express.js 가이드](https://expressjs.com/)
- [Socket.io 문서](https://socket.io/docs/)
- [React 공식 문서](https://reactjs.org/docs/)
- [Python 공식 문서](https://docs.python.org/)

### 도구
- [Postman](https://www.postman.com/) - API 테스트
- [Insomnia](https://insomnia.rest/) - API 테스트
- [SQLite Browser](https://sqlitebrowser.org/) - 데이터베이스 관리

### 커뮤니티
- [Stack Overflow](https://stackoverflow.com/)
- [GitHub](https://github.com/)
- [Reddit r/nodejs](https://www.reddit.com/r/nodejs/)
- [Reddit r/reactjs](https://www.reddit.com/r/reactjs/)

## 🎉 완료

**🎉 축하합니다! 이제 UE CMS 개발을 시작할 준비가 완료되었습니다!**

### 다음 단계
1. **기능 개발**: 클라이언트 관리, 그룹 관리, 프리셋 시스템 구현
2. **UI/UX 개선**: 웹 인터페이스 디자인 및 사용성 향상
3. **테스트**: 단위 테스트, 통합 테스트, 성능 테스트
4. **배포**: 프로덕션 환경 배포 및 모니터링 설정

### 연락처
- **개발팀**: uecms@email.com
- **기술지원**: support@uecms.com
- **문서**: docs.uecms.com

---

**UE CMS Team** - nDisplay 환경을 위한 최고의 콘텐츠 관리 솔루션