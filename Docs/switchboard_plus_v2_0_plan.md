# Switchboard Plus v2.0 - 핵심 개발 계획서

## 📋 1. 문서 개요

**프로젝트**: Switchboard Plus v2.0 (핵심 기능)  
**목적**: 언리얼엔진 nDisplay 원격 제어를 위한 웹 기반 통합 시스템  
**개발 도구**: Cursor AI 협업 중심  
**배포 방식**: 전용 서버 + 웹 접속  
**개발 기간**: 8-10주 (MVP 완성)

> 🎯 **v2.0 핵심 목표**: 실제 동작하는 nDisplay 원격 제어 시스템
> ✨ **MVP 전략**: 핵심 기능만 완벽 구현 → v2.1+에서 고급 기능 확장

---

## 🏗️ 2. 시스템 아키텍처

### 2.1 v2.0 서버 구조

```
🖥️ Switchboard Plus Server (1대)
┌─────────────────────────────────────┐
│  포트 8000 (HTTP 접속)              │
├─────────────────────────────────────┤
│ ✅ Express 서버 (REST API)          │
│ ✅ React UI (정적 파일)             │  
│ ✅ Socket.io (실시간 통신)          │
│ ✅ SQLite 데이터베이스              │
└─────────────────────────────────────┘
              ↓ HTTP + WebSocket
┌─────────────────────────────────────┐
│  Display PC들 (N대)                 │
├─────────────────────────────────────┤
│ ✅ Python 클라이언트                │
│ ✅ 언리얼엔진 nDisplay              │  
│ ✅ 수동 IP 설정                     │
└─────────────────────────────────────┘
```

### 2.2 핵심 기능 범위

| 기능 | v2.0 포함 | 상세 |
|------|-----------|------|
| **클라이언트 관리** | ✅ | 수동 등록, 상태 모니터링 |
| **그룹 관리** | ✅ | 그룹 생성, 클라이언트 할당 |
| **프리셋 실행** | ✅ | 언리얼엔진 원격 실행/중지 |
| **실시간 모니터링** | ✅ | Socket 기반 상태 추적 |
| **웹 UI** | ✅ | 반응형, 다크/라이트 테마 |
| **일괄 제어** | ✅ | 체크박스 기반 다중 선택 |

---

## 🚀 3. 개발 로드맵 (4단계)

### Phase 1: 백엔드 서버 (Week 1-2) 🏠
```
환경: 로컬 개발 (localhost:8000)
목표: Express + Socket.io + SQLite 서버 구축
핵심: REST API + WebSocket 통신 기반 구조
```

**주요 작업:**
- Express 서버 설정 및 미들웨어 구성
- SQLite 데이터베이스 스키마 생성
- Socket.io 실시간 통신 설정
- 클라이언트/그룹/프리셋 REST API 구현
- 기본 에러 처리 및 로깅

### Phase 2: 웹 UI 통합 (Week 3-4) 🏠
```
환경: 로컬 개발 (기존 UI + 백엔드 연동)
목표: 완성된 웹 UI와 백엔드 API 통합
핵심: 실제 데이터 CRUD + 실시간 업데이트
```

**주요 작업:**
- 기존 UI와 REST API 연동
- Socket.io 클라이언트 구현
- 실시간 상태 업데이트 구현
- 프리셋 실행 흐름 완성
- 에러 처리 및 사용자 피드백

### Phase 3: Python 클라이언트 (Week 5-6) 🌐
```
환경: 멀티 PC (서버 1대 + 클라이언트 N대)
목표: 실제 언리얼엔진 원격 제어
핵심: Python 클라이언트 ↔ 서버 통신
```

**주요 작업:**
- Python 클라이언트 개발
- 서버 등록 및 하트비트 구현
- 언리얼엔진 프로세스 관리
- 명령 수신 및 실행 결과 보고
- 네트워크 재연결 로직

### Phase 4: 배포 및 검증 (Week 7-8) 🚀
```
환경: 실제 운영 환경
목표: 설치 가능한 배포판 + 안정성 검증
핵심: 패키징 + 문서화 + 사용자 테스트
```

**주요 작업:**
- 빌드 스크립트 및 패키징
- 설치 가이드 작성
- 실제 환경 테스트 (10대 이상)
- 24시간 연속 운영 검증
- 사용자 피드백 반영

---

## 🔧 4. Phase 1: 백엔드 서버 구현

### 4.1 프로젝트 구조

```
switchboard-plus-v2/
├── package.json              # 루트 패키지
├── server/                   # 백엔드 서버
│   ├── src/
│   │   ├── app.js           # Express 메인 앱
│   │   ├── config/          # 설정 파일
│   │   │   └── database.js  # DB 설정
│   │   ├── models/          # 데이터 모델
│   │   │   ├── Client.js    # 클라이언트 모델
│   │   │   ├── Group.js     # 그룹 모델
│   │   │   └── Preset.js    # 프리셋 모델
│   │   ├── routes/          # API 라우트
│   │   │   ├── clients.js   # 클라이언트 API
│   │   │   ├── groups.js    # 그룹 API
│   │   │   └── presets.js   # 프리셋 API
│   │   ├── socket/          # Socket 이벤트
│   │   │   └── events.js    # Socket 핸들러
│   │   └── utils/           # 유틸리티
│   │       ├── logger.js    # 로깅
│   │       └── validator.js # 입력 검증
│   ├── public/              # React 빌드 파일
│   ├── database.sqlite      # SQLite 파일
│   └── package.json         # 서버 의존성
├── client/                  # Python 클라이언트
│   ├── main.py              # 메인 실행 파일
│   ├── config.json          # 설정 파일
│   ├── requirements.txt     # Python 의존성
│   └── install.bat          # 윈도우 설치 스크립트
└── web-ui/                  # React 개발 (기존)
    ├── src/
    ├── package.json
    └── vite.config.js
```

### 4.2 데이터베이스 스키마

```sql
-- 클라이언트 테이블
CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    port INTEGER DEFAULT 8081,
    description TEXT,
    status VARCHAR(50) DEFAULT 'offline',
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 그룹 테이블
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 그룹-클라이언트 관계 테이블
CREATE TABLE group_clients (
    group_id INTEGER,
    client_id INTEGER,
    PRIMARY KEY (group_id, client_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

-- 프리셋 테이블
CREATE TABLE presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    command TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 프리셋-그룹 관계 테이블
CREATE TABLE preset_groups (
    preset_id INTEGER,
    group_id INTEGER,
    PRIMARY KEY (preset_id, group_id),
    FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- 프리셋 실행 히스토리
CREATE TABLE executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id VARCHAR(255) UNIQUE NOT NULL,
    preset_id INTEGER,
    preset_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    target_clients TEXT, -- JSON array
    results TEXT,        -- JSON object
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE SET NULL
);

-- 인덱스 생성
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_ip ON clients(ip_address);
CREATE INDEX idx_executions_status ON executions(status);
```

### 4.3 핵심 API 엔드포인트

```javascript
// 클라이언트 관리 API
GET    /api/clients           # 클라이언트 목록 조회
POST   /api/clients           # 클라이언트 수동 등록
PUT    /api/clients/:id       # 클라이언트 정보 수정
DELETE /api/clients/:id       # 클라이언트 삭제
POST   /api/clients/register  # Python 클라이언트 자동 등록
POST   /api/clients/heartbeat # 하트비트 수신

// 그룹 관리 API
GET    /api/groups            # 그룹 목록 조회
POST   /api/groups            # 그룹 생성
PUT    /api/groups/:id        # 그룹 수정
DELETE /api/groups/:id        # 그룹 삭제
POST   /api/groups/:id/clients # 그룹에 클라이언트 추가/제거

// 프리셋 관리 API
GET    /api/presets           # 프리셋 목록 조회
POST   /api/presets           # 프리셋 생성
PUT    /api/presets/:id       # 프리셋 수정
DELETE /api/presets/:id       # 프리셋 삭제
POST   /api/presets/:id/execute # 프리셋 실행

// 실행 히스토리 API
GET    /api/executions        # 실행 히스토리 조회
GET    /api/executions/:id    # 특정 실행 상세 조회
POST   /api/executions/:id/stop # 실행 중지

// 시스템 API
GET    /api/health            # 서버 상태 체크
GET    /api/stats             # 통계 정보
```

### 4.4 Socket.io 이벤트 구조

```javascript
// 클라이언트(Python) → 서버
CLIENT_REGISTER: 'client:register'          # 클라이언트 등록
CLIENT_HEARTBEAT: 'client:heartbeat'        # 하트비트
CLIENT_STATUS_UPDATE: 'client:status_update' # 상태 변경
CLIENT_EXECUTION_RESULT: 'client:execution_result' # 실행 결과

// 서버 → 클라이언트(Python)  
SERVER_EXECUTE_PRESET: 'server:execute_preset'     # 프리셋 실행 명령
SERVER_STOP_PRESET: 'server:stop_preset'           # 프리셋 중지 명령
SERVER_STOP_ALL: 'server:stop_all'                 # 모든 프로세스 중지

// 웹 UI ↔ 서버
UI_JOIN: 'ui:join'                          # 웹 클라이언트 접속
UI_PRESET_EXECUTE: 'ui:preset_execute'      # 프리셋 실행 요청

// 서버 → 웹 UI (브로드캐스트)
BROADCAST_CLIENT_STATUS: 'broadcast:client_status'     # 클라이언트 상태 변경
BROADCAST_PRESET_STARTED: 'broadcast:preset_started'   # 프리셋 실행 시작
BROADCAST_PRESET_COMPLETED: 'broadcast:preset_completed' # 프리셋 실행 완료
```

---

## 🎨 5. Phase 2: 웹 UI 통합

### 5.1 기존 UI 연동 포인트

**현재 UI 상태**: 완성된 프론트엔드 (시뮬레이션)
**연동 작업**: API 호출 및 Socket 이벤트 활성화

```javascript
// 시뮬레이션 코드 → 실제 API 호출로 변경
// Before (시뮬레이션)
clients.set(clientId, clientData);

// After (실제 API)
const response = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientData)
});
```

### 5.2 Socket.io 클라이언트 활성화

```javascript
// 현재 주석 처리된 Socket 코드 활성화
const socket = io();

socket.on('connect', () => {
    updateSocketStatus(true);
    showToast('서버에 연결되었습니다.', 'success');
});

socket.on('broadcast:client_status', (data) => {
    updateClientStatus(data.client_id, data.status);
});

socket.on('broadcast:preset_started', (data) => {
    addExecutionToHistory(data);
});
```

---

## 🐍 6. Phase 3: Python 클라이언트

### 6.1 클라이언트 구조

```python
# main.py - 메인 클라이언트
import json
import time
import requests
import subprocess
import socketio
from pathlib import Path

class SwitchboardClient:
    def __init__(self):
        self.config = self.load_config()
        self.server_url = f"http://{self.config['server_ip']}:{self.config['server_port']}"
        self.sio = socketio.Client()
        self.running_processes = {}
        
    def load_config(self):
        # config.json에서 서버 정보 로드
        
    def register_with_server(self):
        # 서버에 클라이언트 등록
        
    def connect_websocket(self):
        # Socket.io 연결 및 이벤트 핸들러 설정
        
    def execute_command(self, command):
        # 언리얼엔진 실행
        
    def send_heartbeat(self):
        # 주기적 하트비트 전송
        
    def run(self):
        # 메인 실행 루프
```

### 6.2 설정 파일 구조

```json
{
    "client_name": "Display_01",
    "server_ip": "192.168.1.100",
    "server_port": 8000,
    "heartbeat_interval": 30,
    "auto_reconnect": true,
    "unreal_timeout": 300
}
```

---

## 📦 7. Phase 4: 배포 및 검증

### 7.1 빌드 구조

```
SwitchboardPlus-v2.0/
├── Server/
│   ├── SBPlusServer.exe      # Node.js 실행 파일
│   ├── public/               # React UI
│   ├── database.sqlite       # 초기 DB
│   └── README.md             # 서버 설치 가이드
├── Client/
│   ├── SBPlusClient.exe      # Python 실행 파일
│   ├── config.json           # 설정 템플릿
│   └── README.md             # 클라이언트 설치 가이드
└── QuickStart.pdf            # 빠른 시작 가이드
```

### 7.2 성공 기준

**핵심 기능 검증:**
- [ ] 웹에서 프리셋 클릭 → 모든 Display PC에서 언리얼엔진 실행
- [ ] 10대 이상 클라이언트 동시 관리
- [ ] 24시간 연속 운영 가능
- [ ] 5분 내 신규 설치 가능

**성능 요구사항:**
- [ ] 프리셋 실행 명령 → 5초 이내 응답
- [ ] 웹 UI 응답 시간 3초 이내
- [ ] 서버 메모리 사용량 500MB 이하

---

## 🔮 8. v2.0 완성 후 확장 계획

### v2.1 - 전원 관리 (4주)
- Wake-on-LAN 전원 켜기
- 원격 재부팅/종료
- 전력 절약 스케줄링

### v2.2 - 프로젝터 통합 (6주)  
- PJLink 프로토콜 지원
- 프로젝터 상태 모니터링
- 통합 전원 관리

### v2.3 - 엔터프라이즈 (8주)
- 사용자 권한 관리
- 클라우드 동기화
- 모바일 앱

---

## 🎯 9. 마무리

**v2.0의 핵심 가치:**
1. **실무성**: 실제 nDisplay 운영에 바로 사용 가능
2. **안정성**: 24시간 무인 운영 지원
3. **직관성**: 기술 지식 없이도 사용 가능
4. **확장성**: v2.1+ 자연스러운 기능 확장

**Ready for Core Development!** 🚀