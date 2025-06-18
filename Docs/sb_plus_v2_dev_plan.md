# Switchboard Plus v2 - 실무 중심 개발 계획서

## 📋 1. 문서 개요

**프로젝트**: Switchboard Plus v2.0  
**목적**: 언리얼엔진 nDisplay 원격 제어를 위한 통합 웹 시스템  
**개발 도구**: Cursor AI 협업 중심  
**배포 방식**: 전용 서버 + 웹 접속  

> 🎯 **핵심 변화**: 개발 중심 → 실무 운영 중심으로 전환

---

## 🏗️ 2. 시스템 아키텍처

### 2.1 통합 서버 구조 (신규)

```
🖥️ Switchboard Plus Server (1대)
┌─────────────────────────────────────┐
│  포트 80/443 (외부 접속)            │
├─────────────────────────────────────┤
│ ✅ Express 서버 (API)               │
│ ✅ React UI (정적 파일)             │  
│ ✅ Socket.io (실시간 통신)          │
│ ✅ SQLite 데이터베이스              │
└─────────────────────────────────────┘
              ↓ HTTP API
┌─────────────────────────────────────┐
│  Display PC들 (N대)                 │
├─────────────────────────────────────┤
│ ✅ Python 클라이언트                │
│ ✅ 언리얼엔진 nDisplay              │  
│ ✅ 수동 IP 설정 (간단)              │
└─────────────────────────────────────┘
```

### 2.2 기존 vs 새로운 방식

| 구분 | 기존 방식 | 새로운 방식 |
|------|-----------|-------------|
| **서버 구조** | 분리형 (개발+운영) | 통합형 (운영 최적화) |
| **접속 방식** | 관리자 PC만 | 어디서든 웹 접속 |
| **클라이언트 검색** | UDP 자동 검색 | 수동 IP 설정 |
| **배포 복잡도** | 높음 (네트워크 설정) | 낮음 (IP만 입력) |
| **확장성** | 제한적 | 높음 (웹 기반) |

---

## 🚀 3. 개발 로드맵 (4단계) - 핵심 기능 우선

### Phase 1: 통합 서버 개발 (Week 1-2) 🏠 **로컬 개발**
```
환경: 개발자 PC 1대 (localhost)
목표: 하나의 패키지로 서버+웹UI 통합
테스트: http://localhost:8000 접속 확인
결과물: 설치 후 바로 사용 가능한 서버
```

### Phase 2: 웹 UI 완성 (Week 3-4) 🏠 **로컬 개발**
```
환경: 개발자 PC 1대 (localhost)  
목표: React 기반 관리 인터페이스
테스트: 가상 클라이언트로 UI 동작 확인
결과물: 프리셋, 클라이언트 관리 UI
```

### Phase 3: 클라이언트 연결 (Week 5-6) 🌐 **멀티 PC 전환**
```
환경: 서버 1대 + 클라이언트 PC (실제 IP)
목표: Python 클라이언트로 안정적 연결 및 nDisplay 제어
테스트: 실제 네트워크에서 멀티 PC 연결 및 언리얼엔진 실행
결과물: 완전한 nDisplay 원격 제어 시스템
```

### Phase 4: 배포 패키지 & 운영 검증 (Week 7-8) 🚀 **실제 운영**
```
환경: 실제 운영 환경 (전용 서버 + 다수 Display PC)
목표: 설치부터 운영까지 완전 자동화 + 안정성 검증
테스트: 10대 이상 실제 환경에서 24시간 연속 운영 검증
결과물: 배포 가능한 완성품 + 사용자 가이드
```

> 🎯 **핵심 목표**: Phase 1-4로 nDisplay 원격 제어의 모든 기본 기능을 완벽하게 완성

### 3.1 확장성 고려 설계 원칙 ⚡

> 💡 **중요**: v2.0 개발 시부터 v2.1(전원 관리), v2.2(프로젝터 제어) 확장을 염두에 둔 설계 필수!

#### 3.1.1 데이터베이스 설계 (확장 고려)

```sql
-- v2.0 기본 테이블 + 미래 확장 필드 포함
CREATE TABLE clients (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) UNIQUE,
    ip_address VARCHAR(45),
    port INTEGER,
    status VARCHAR(50),
    -- v2.1 전원 관리를 위한 필드 미리 추가
    mac_address VARCHAR(17),        -- Wake-on-LAN용
    power_status VARCHAR(20),       -- 'on', 'off', 'unknown'
    last_power_action DATETIME,
    -- v2.2 프로젝터를 위한 확장성
    device_type VARCHAR(50) DEFAULT 'display_pc',  -- 'display_pc', 'projector'
    capabilities JSON,              -- 디바이스별 지원 기능
    created_at DATETIME,
    updated_at DATETIME
);

-- v2.0에서 사용하지 않지만 미리 생성 (확장용)
CREATE TABLE device_actions (
    id INTEGER PRIMARY KEY,
    client_id INTEGER,
    action_type VARCHAR(50),        -- 'power', 'projector_control' 등
    action_data JSON,               -- 액션별 상세 데이터
    status VARCHAR(20),             -- 'pending', 'success', 'failed'
    created_at DATETIME,
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- 프리셋도 확장 고려
CREATE TABLE presets (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    description TEXT,
    -- v2.2 프로젝터 제어를 위한 확장
    preset_type VARCHAR(50) DEFAULT 'content',  -- 'content', 'system', 'integrated'
    config JSON,                    -- 프리셋별 설정 (프로젝터 설정 포함)
    created_at DATETIME
);
```

#### 3.1.2 API 설계 (확장성 우선)

```javascript
// v2.0에서 만들 API 구조 (확장 염두)
app.use('/api/clients', clientsRouter);        // v2.0 기본
app.use('/api/devices', devicesRouter);        // v2.2 프로젝터 통합용
app.use('/api/power', powerRouter);            // v2.1 전원 관리용  
app.use('/api/projectors', projectorsRouter);  // v2.2 프로젝터 제어용
app.use('/api/actions', actionsRouter);        // 범용 액션 API

// 확장 가능한 API 응답 구조
{
  "id": 1,
  "name": "Display_01",
  "type": "display_pc",
  "status": "online",
  "capabilities": {
    "power_control": true,          // v2.1에서 사용
    "remote_reboot": true,          // v2.1에서 사용
    "content_execution": true       // v2.0에서 사용
  },
  "network": {
    "ip_address": "192.168.1.101",
    "mac_address": "aa:bb:cc:dd:ee:ff"  // v2.1에서 사용
  },
  "power": {
    "status": "on",                 // v2.1에서 사용
    "last_action": "2024-01-15T09:30:00Z"
  }
}
```

#### 3.1.3 UI 컴포넌트 설계 (모듈화)

```jsx
// 확장 가능한 컴포넌트 구조
src/components/
├── devices/                    // 통합 디바이스 관리
│   ├── DeviceGrid.jsx         // 모든 디바이스 표시
│   ├── DeviceCard.jsx         // 범용 디바이스 카드
│   ├── DeviceModal.jsx        // 범용 디바이스 상세 모달
│   └── device-types/          // 디바이스 타입별 컴포넌트
│       ├── DisplayPCCard.jsx  // v2.0
│       ├── PowerControls.jsx  // v2.1에서 추가
│       └── ProjectorCard.jsx  // v2.2에서 추가
├── actions/                   // 범용 액션 시스템
│   ├── ActionButton.jsx       // 재사용 가능한 액션 버튼
│   ├── BulkActions.jsx        // 일괄 작업 컴포넌트
│   └── ActionModal.jsx        // 액션 확인 모달
└── presets/
    ├── PresetCard.jsx         // v2.2에서 프로젝터 설정 추가 고려
    └── PresetModal.jsx

// 확장 가능한 DeviceCard 예시
function DeviceCard({ device }) {
  const deviceTypeComponents = {
    'display_pc': DisplayPCControls,
    'projector': ProjectorControls,  // v2.2에서 추가
  };
  
  const DeviceControls = deviceTypeComponents[device.type] || DefaultControls;
  
  return (
    <Card>
      <CardHeader>
        <DeviceIcon type={device.type} />
        <Typography>{device.name}</Typography>
        <StatusIndicator status={device.status} />
      </CardHeader>
      
      <CardContent>
        <DeviceControls device={device} />
      </CardContent>
      
      {/* v2.1에서 전원 제어 추가 */}
      {device.capabilities.power_control && (
        <PowerControls device={device} />
      )}
    </Card>
  );
}
```

#### 3.1.4 서비스 레이어 설계 (확장성)

```javascript
// 범용 디바이스 서비스
class DeviceService {
  // v2.0 기본 기능
  async getDevices(type = null) {
    const query = type ? { type } : {};
    return await Device.findAll({ where: query });
  }
  
  // v2.1, v2.2에서 사용할 액션 시스템 (미리 구조 준비)
  async executeAction(deviceId, actionType, actionData) {
    const device = await Device.findById(deviceId);
    
    const actionHandlers = {
      'power_on': this.handlePowerOn,
      'power_off': this.handlePowerOff,
      'reboot': this.handleReboot,
      // v2.2에서 추가될 프로젝터 액션들
      'projector_input': this.handleProjectorInput,
      'projector_brightness': this.handleProjectorBrightness,
    };
    
    const handler = actionHandlers[actionType];
    if (handler) {
      return await handler(device, actionData);
    }
    
    throw new Error(`Unsupported action: ${actionType}`);
  }
  
  // v2.0에서는 빈 함수로 두고 v2.1에서 구현
  async handlePowerOn(device, data) {
    // TODO: v2.1에서 Wake-on-LAN 구현
    throw new Error('Power control not implemented yet');
  }
}
```

#### 3.1.5 Socket 이벤트 설계 (확장성)

```javascript
// v2.0에서 만들 때부터 확장 가능한 구조
const socketEvents = {
  // 기본 디바이스 이벤트
  'device:status': (data) => { /* 모든 디바이스 상태 */ },
  'device:registered': (data) => { /* 새 디바이스 등록 */ },
  
  // v2.1에서 추가될 전원 이벤트 (구조만 준비)
  'device:power:changed': (data) => { /* 전원 상태 변경 */ },
  'device:action:result': (data) => { /* 액션 실행 결과 */ },
  
  // v2.2에서 추가될 프로젝터 이벤트 (구조만 준비)  
  'projector:status': (data) => { /* 프로젝터 상태 */ },
  'projector:lamp:warning': (data) => { /* 램프 교체 알림 */ },
};
```

#### 3.1.6 확장성 체크리스트 (v2.0 개발 시 필수)

**데이터베이스 설계** ✅
- [ ] 확장 필드 미리 추가 (mac_address, device_type 등)
- [ ] JSON 필드 활용으로 유연한 설정 저장
- [ ] 미래 테이블 구조 미리 생성 (device_actions)

**API 설계** ✅  
- [ ] 범용 디바이스 API 구조
- [ ] 확장 가능한 액션 시스템
- [ ] 일관성 있는 응답 형식 (capabilities, power 필드 포함)

**UI 컴포넌트** ✅
- [ ] 모듈화된 컴포넌트 구조
- [ ] 디바이스 타입별 분리
- [ ] 재사용 가능한 액션 컴포넌트

**서비스 레이어** ✅
- [ ] 범용 디바이스 서비스
- [ ] 확장 가능한 액션 핸들러 구조
- [ ] 플러그인 방식 확장 준비

> 🎯 **확장 효과**: 이렇게 설계하면 v2.1, v2.2 추가 시 기존 코드 수정 최소화!

---

## 🔧 4. Phase 1: 통합 서버 개발

### 4.1 프로젝트 구조 (Cursor AI 작업용)

```
switchboard-plus-v2/
├── package.json              # 루트 패키지 설정
├── server/                   # 통합 서버
│   ├── src/
│   │   ├── app.js           # Express 메인 앱
│   │   ├── api/             # REST API 라우트
│   │   │   ├── clients.js   # 클라이언트 관리
│   │   │   ├── presets.js   # 프리셋 관리
│   │   │   └── groups.js    # 그룹 관리
│   │   ├── socket/          # WebSocket 처리
│   │   │   └── events.js    # Socket 이벤트
│   │   ├── models/          # 데이터베이스 모델
│   │   │   └── index.js     # Sequelize 설정
│   │   └── utils/           # 유틸리티
│   │       └── logger.js    # 로깅 설정
│   ├── public/              # React 빌드 파일 위치
│   ├── database.sqlite      # SQLite 파일
│   └── package.json         # 서버 의존성
├── client/                  # Python 클라이언트
│   ├── main.py              # 메인 실행 파일
│   ├── config.json          # 설정 파일 (IP 입력)
│   ├── server_comm.py       # 서버 통신
│   ├── process_manager.py   # 언리얼 실행 관리
│   └── requirements.txt     # Python 의존성
└── web-ui/                  # React 개발 (빌드 후 server/public으로)
    ├── src/
    ├── package.json
    └── vite.config.js
```

### 4.2 핵심 파일별 구현 가이드

#### server/src/app.js (Cursor AI 작업)
```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

// 미들웨어
app.use(cors());
app.use(express.json());

// API 라우트
app.use('/api/clients', require('./api/clients'));
app.use('/api/presets', require('./api/presets'));
app.use('/api/groups', require('./api/groups'));

// React 앱 서빙 (정적 파일)
app.use(express.static(path.join(__dirname, '../public')));

// SPA 지원 (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Socket 이벤트 처리
require('./socket/events')(io);

const PORT = process.env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Switchboard Plus Server running on http://0.0.0.0:${PORT}`);
});
```

#### client/config.json (수동 설정)
```json
{
  "connection": {
    "server_ip": "192.168.1.100",
    "server_port": 8000,
    "retry_interval": 5,
    "max_retries": 10
  },
  "client": {
    "name": "Display_01",
    "description": "Main Display Wall",
    "port": 8081
  },
  "unreal": {
    "executable_path": "C:/UnrealProjects/MyProject/MyProject.exe",
    "ndisplay_config": "Config/ndisplay.cfg",
    "node_name": "node_01"
  },
  "logging": {
    "level": "INFO",
    "file": "client.log"
  }
}
```

### 4.3 Phase 1 체크리스트 (Cursor AI 작업)

#### 4.3.1 서버 기본 구조
- [ ] Express 앱 생성 및 설정
- [ ] Socket.io 서버 연결
- [ ] CORS 설정 (모든 도메인 허용)
- [ ] 정적 파일 서빙 설정
- [ ] SPA 라우팅 지원

#### 4.3.2 데이터베이스 설정
- [ ] Sequelize + SQLite 연결
- [ ] 클라이언트 모델 정의
- [ ] 프리셋 모델 정의
- [ ] 그룹 모델 정의
- [ ] 초기 마이그레이션

#### 4.3.3 API 라우트 구현
- [ ] GET /api/clients (클라이언트 목록)
- [ ] POST /api/clients (클라이언트 등록)
- [ ] PUT /api/clients/:id (클라이언트 수정)
- [ ] DELETE /api/clients/:id (클라이언트 삭제)
- [ ] 프리셋 CRUD API
- [ ] 그룹 CRUD API

#### 4.3.4 Socket 이벤트 처리
- [ ] 클라이언트 연결/해제 처리
- [ ] 실시간 상태 업데이트
- [ ] 명령 실행 이벤트
- [ ] 하트비트 처리

#### 4.3.5 테스트 (로컬 환경)
- [ ] 서버 실행 확인 (http://localhost:8000)
- [ ] API 엔드포인트 테스트 (Postman)
- [ ] Socket 연결 테스트
- [ ] 로그 출력 확인
- [ ] **🚨 Phase 3 전 멀티PC 테스트 준비**
  - [ ] 서버 IP를 0.0.0.0으로 바인딩 확인
  - [ ] 방화벽 설정 가이드 준비
  - [ ] 다른 PC에서 접속 테스트

---

## 🎨 5. Phase 2: 웹 UI 완성

### 5.1 React 프로젝트 구조

```
web-ui/src/
├── components/
│   ├── layout/
│   │   ├── Header.jsx       # 상단 헤더
│   │   └── Sidebar.jsx      # 사이드바 (선택)
│   ├── dashboard/
│   │   ├── Dashboard.jsx    # 메인 대시보드
│   │   ├── StatsCards.jsx   # 통계 카드
│   │   └── SystemStatus.jsx # 시스템 상태
│   ├── clients/
│   │   ├── ClientGrid.jsx   # 클라이언트 그리드
│   │   ├── ClientCard.jsx   # 개별 클라이언트 카드
│   │   └── ClientModal.jsx  # 클라이언트 수정 모달
│   ├── presets/
│   │   ├── PresetList.jsx   # 프리셋 목록
│   │   ├── PresetCard.jsx   # 프리셋 카드
│   │   └── PresetModal.jsx  # 프리셋 생성/수정
│   └── common/
│       ├── Toast.jsx        # 알림 토스트
│       └── Loading.jsx      # 로딩 스피너
├── hooks/
│   ├── useSocket.js         # Socket 연결 훅
│   ├── useApi.js            # API 호출 훅
│   └── useToast.js          # 토스트 알림 훅
├── services/
│   ├── api.js               # Axios 설정
│   └── socket.js            # Socket 클라이언트
├── store/                   # Redux 또는 Zustand
│   ├── clientStore.js
│   ├── presetStore.js
│   └── uiStore.js
├── App.jsx
└── main.jsx
```

### 5.2 핵심 컴포넌트 구현

#### Dashboard.jsx (메인 화면)
```jsx
import React, { useEffect, useState } from 'react';
import { Grid, Container, Typography } from '@mui/material';
import ClientGrid from '../clients/ClientGrid';
import PresetList from '../presets/PresetList';
import StatsCards from './StatsCards';
import useSocket from '../../hooks/useSocket';
import useApi from '../../hooks/useApi';

function Dashboard() {
  const [clients, setClients] = useState([]);
  const [presets, setPresets] = useState([]);
  const { socket, isConnected } = useSocket();
  const { get } = useApi();

  useEffect(() => {
    // 초기 데이터 로드
    loadClients();
    loadPresets();
  }, []);

  const loadClients = async () => {
    try {
      const data = await get('/api/clients');
      setClients(data);
    } catch (error) {
      console.error('Failed to load clients:', error);
    }
  };

  const loadPresets = async () => {
    try {
      const data = await get('/api/presets');
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  return (
    <Container maxWidth="xl">
      <Typography variant="h4" sx={{ mb: 3 }}>
        Switchboard Plus Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* 상태 카드 */}
        <Grid item xs={12}>
          <StatsCards 
            clientCount={clients.length}
            onlineCount={clients.filter(c => c.status === 'online').length}
            isConnected={isConnected}
          />
        </Grid>
        
        {/* 클라이언트 모니터링 */}
        <Grid item xs={12} md={8}>
          <ClientGrid 
            clients={clients} 
            onRefresh={loadClients}
          />
        </Grid>
        
        {/* 프리셋 관리 */}
        <Grid item xs={12} md={4}>
          <PresetList 
            presets={presets}
            onRefresh={loadPresets}
          />
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;
```

### 5.3 Phase 2 체크리스트 (Cursor AI 작업)

#### 5.3.1 프로젝트 설정
- [ ] Vite + React 프로젝트 생성
- [ ] Material-UI 설치 및 테마 설정
- [ ] Axios 설정 (API 통신)
- [ ] Socket.io 클라이언트 설정
- [ ] 상태 관리 라이브러리 설정

#### 5.3.2 레이아웃 컴포넌트
- [ ] Header 컴포넌트 (제목, 연결 상태)
- [ ] Dashboard 메인 레이아웃
- [ ] 반응형 그리드 시스템
- [ ] 로딩 및 에러 처리

#### 5.3.3 클라이언트 관리
- [ ] ClientGrid (클라이언트 목록)
- [ ] ClientCard (개별 상태 표시)
- [ ] 실시간 상태 업데이트
- [ ] 클라이언트 제어 버튼

#### 5.3.4 프리셋 관리
- [ ] PresetList (프리셋 목록)
- [ ] PresetModal (생성/편집)
- [ ] 프리셋 실행/중지 기능
- [ ] 드래그 앤 드롭 정렬

#### 5.3.5 빌드 및 배포
- [ ] 프로덕션 빌드 (npm run build)
- [ ] 빌드 파일을 server/public으로 복사
- [ ] 통합 테스트 (서버에서 UI 확인)
- [ ] **🌐 멀티PC 테스트 준비**
  - [ ] 개발 서버 --host 옵션으로 외부 접속 테스트
  - [ ] 다른 PC에서 http://개발자IP:5173 접속 확인
  - [ ] 통합 서버로 http://개발자IP:8000 접속 확인

---

## 🖥️ 6. Phase 3: 클라이언트 연결 & nDisplay 제어 (🌐 **멀티 PC 환경 전환**)

> ⚠️ **중요**: 이 단계부터는 **실제 멀티 PC 환경**에서 테스트합니다!
> - 서버: 고정 IP (예: 192.168.1.100)
> - 클라이언트: 다른 PC들 (192.168.1.101, 102...)
> - 네트워크: 같은 서브넷, 방화벽 설정 필요
> 
> 🎯 **핵심 목표**: 웹에서 프리셋 클릭 → 모든 Display PC에서 동시에 언리얼엔진 실행!

### 6.1 Python 클라이언트 구조

```python
# client/main.py
import json
import time
import requests
import subprocess
from pathlib import Path

class SwitchboardClient:
    def __init__(self, config_path='config.json'):
        self.config = self.load_config(config_path)
        self.server_url = f"http://{self.config['connection']['server_ip']}:{self.config['connection']['server_port']}"
        self.running_processes = {}
        
    def load_config(self, config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    
    def register_client(self):
        """서버에 클라이언트 등록"""
        data = {
            'name': self.config['client']['name'],
            'description': self.config['client']['description'],
            'ip_address': self.get_local_ip(),
            'port': self.config['client']['port']
        }
        
        try:
            response = requests.post(f"{self.server_url}/api/clients", json=data)
            if response.status_code == 200:
                print(f"✅ 서버에 등록 완료: {self.config['client']['name']}")
                return True
        except Exception as e:
            print(f"❌ 서버 등록 실패: {e}")
            return False
    
    def send_heartbeat(self):
        """하트비트 전송"""
        try:
            response = requests.post(f"{self.server_url}/api/clients/heartbeat", 
                                   json={'name': self.config['client']['name']})
            return response.status_code == 200
        except:
            return False
    
    def execute_command(self, command):
        """언리얼엔진 실행"""
        try:
            process = subprocess.Popen(command, shell=True)
            self.running_processes[command] = process
            print(f"✅ 명령 실행: {command}")
            return True
        except Exception as e:
            print(f"❌ 명령 실행 실패: {e}")
            return False
    
    def stop_all_processes(self):
        """모든 프로세스 중지"""
        for cmd, process in self.running_processes.items():
            process.terminate()
        self.running_processes.clear()
        print("🛑 모든 프로세스 중지")
    
    def run(self):
        """메인 실행 루프"""
        print(f"🚀 Switchboard Plus Client 시작: {self.config['client']['name']}")
        
        # 서버 등록
        if not self.register_client():
            print("서버 등록 실패. 종료합니다.")
            return
        
        # 메인 루프
        while True:
            try:
                # 하트비트 전송
                if not self.send_heartbeat():
                    print("⚠️ 서버 연결 끊김. 재연결 시도 중...")
                    time.sleep(self.config['connection']['retry_interval'])
                    continue
                
                # 명령 확인 (HTTP 폴링)
                self.check_commands()
                
                time.sleep(5)  # 5초 대기
                
            except KeyboardInterrupt:
                print("🛑 클라이언트 종료")
                self.stop_all_processes()
                break

if __name__ == "__main__":
    client = SwitchboardClient()
    client.run()
```

### 6.2 설정 도구 만들기

#### client/setup_wizard.py (설정 마법사)
```python
import json
import ipaddress
from pathlib import Path

def setup_wizard():
    print("🔧 Switchboard Plus Client 설정 도구")
    print("=" * 50)
    
    config = {}
    
    # 서버 연결 설정
    print("\n1. 서버 연결 설정")
    while True:
        server_ip = input("서버 IP 주소 입력 (예: 192.168.1.100): ").strip()
        try:
            ipaddress.ip_address(server_ip)
            break
        except:
            print("❌ 올바른 IP 주소를 입력하세요.")
    
    server_port = input("서버 포트 (기본값: 8000): ").strip() or "8000"
    
    # 클라이언트 정보
    print("\n2. 클라이언트 정보")
    client_name = input("클라이언트 이름 (예: Display_01): ").strip()
    client_desc = input("설명 (선택사항): ").strip() or f"{client_name} Display Client"
    
    # 언리얼엔진 설정
    print("\n3. 언리얼엔진 설정")
    unreal_path = input("언리얼엔진 실행 파일 경로: ").strip()
    ndisplay_config = input("nDisplay 설정 파일 경로: ").strip()
    node_name = input("노드 이름 (예: node_01): ").strip()
    
    # config.json 생성
    config = {
        "connection": {
            "server_ip": server_ip,
            "server_port": int(server_port),
            "retry_interval": 5,
            "max_retries": 10
        },
        "client": {
            "name": client_name,
            "description": client_desc,
            "port": 8081
        },
        "unreal": {
            "executable_path": unreal_path,
            "ndisplay_config": ndisplay_config,
            "node_name": node_name
        },
        "logging": {
            "level": "INFO",
            "file": "client.log"
        }
    }
    
    # 파일 저장
    with open('config.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    
    print("\n✅ 설정 완료! config.json 파일이 생성되었습니다.")
    print("이제 main.py를 실행하여 클라이언트를 시작하세요.")

if __name__ == "__main__":
    setup_wizard()
```

### 6.3 Phase 3 체크리스트 (Cursor AI 작업)

#### 6.3.1 클라이언트 기본 구조
- [ ] Python 메인 클래스 구현
- [ ] 설정 파일 로드 기능
- [ ] 서버 등록 기능
- [ ] 하트비트 전송

#### 6.3.2 프로세스 관리
- [ ] 언리얼엔진 실행 기능
- [ ] 프로세스 모니터링
- [ ] 안전한 종료 처리
- [ ] 에러 처리 및 로깅

#### 6.3.3 서버 통신
- [ ] HTTP API 통신
- [ ] 명령 수신 처리
- [ ] 상태 보고 기능
- [ ] 재연결 로직

#### 6.3.4 설정 도구
- [ ] 대화형 설정 마법사
- [ ] IP 주소 유효성 검사
- [ ] 파일 경로 확인
- [ ] config.json 생성

#### 6.3.5 패키징 및 멀티PC 테스트 (🎯 **핵심 검증**)
- [ ] requirements.txt 작성
- [ ] PyInstaller 빌드 스크립트
- [ ] 실행 파일 생성
- [ ] **🌐 실제 멀티PC 환경 테스트**
  - [ ] 서버 PC에서 고정 IP 설정
  - [ ] 클라이언트 PC에서 서버 IP로 연결 테스트
  - [ ] 방화벽 포트 8000, 8081 오픈 확인
  - [ ] **🎯 웹에서 프리셋 실행 → 모든 클라이언트에서 언리얼엔진 동시 실행**
  - [ ] **🎯 nDisplay 동기화 확인 (다중 화면 콘텐츠)**
  - [ ] 여러 클라이언트 동시 연결 테스트
  - [ ] 네트워크 끊김 시 자동 재연결 테스트
  - [ ] **🎯 프리셋 중지 → 모든 언리얼엔진 프로세스 안전 종료**
- [ ] 배포 패키지 준비

---

## 📦 7. Phase 4: 배포 패키지

### 7.1 전체 배포 구조

```
SwitchboardPlus-v2-Release/
├── Server/                    # 서버 패키지
│   ├── SBPlusServer.exe      # Node.js 실행 파일
│   ├── public/               # React UI
│   ├── database.sqlite       # 초기 DB
│   ├── config/               # 설정 파일
│   └── README.md             # 서버 설치 가이드
├── Client/                   # 클라이언트 패키지
│   ├── SBPlusClient.exe      # Python 실행 파일
│   ├── setup_wizard.exe      # 설정 도구
│   ├── config-template.json  # 설정 템플릿
│   └── README.md             # 클라이언트 설치 가이드
├── Installer/                # 설치 프로그램
│   ├── setup-server.exe      # 서버 인스톨러
│   ├── setup-client.exe      # 클라이언트 인스톨러
│   └── setup-guide.pdf       # 설치 가이드
└── Documentation/            # 사용자 문서
    ├── user-manual.pdf       # 사용자 매뉴얼
    ├── admin-guide.pdf       # 관리자 가이드
    └── troubleshooting.pdf   # 문제 해결 가이드
```

### 7.2 자동 빌드 스크립트

#### build-all.js (전체 빌드)
```javascript
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🔨 Switchboard Plus v2 빌드 시작...');

// 1. React UI 빌드
console.log('📦 React UI 빌드 중...');
execSync('npm run build', { cwd: 'web-ui', stdio: 'inherit' });

// 2. UI를 서버로 복사
console.log('📁 UI 파일 복사 중...');
fs.emptyDirSync('server/public');
fs.copySync('web-ui/dist', 'server/public');

// 3. 서버 실행 파일 생성 (pkg 사용)
console.log('🖥️ 서버 실행 파일 생성 중...');
execSync('npx pkg server/src/app.js --target node18-win-x64 --output dist/SBPlusServer.exe', 
         { stdio: 'inherit' });

// 4. Python 클라이언트 빌드
console.log('🐍 Python 클라이언트 빌드 중...');
execSync('pyinstaller --onefile client/main.py --name SBPlusClient', 
         { stdio: 'inherit' });

// 5. 설정 도구 빌드
execSync('pyinstaller --onefile client/setup_wizard.py --name setup_wizard', 
         { stdio: 'inherit' });

// 6. 배포 패키지 구성
console.log('📦 배포 패키지 구성 중...');
fs.ensureDirSync('release');
fs.copySync('dist', 'release');
fs.copySync('server/public', 'release/public');

console.log('✅ 빌드 완료! release 폴더를 확인하세요.');
```

### 7.3 사용자 가이드 템플릿

#### 빠른 시작 가이드 (README.md)
```markdown
# Switchboard Plus v2 - 빠른 시작 가이드

## 🚀 1분 만에 시작하기

### 서버 설치 (1대만)
1. `SBPlusServer.exe` 실행
2. 웹 브라우저에서 `http://서버IP:8000` 접속
3. 완료! 🎉

### 클라이언트 설치 (Display PC마다)
1. `setup_wizard.exe` 실행하여 서버 IP 입력
2. `SBPlusClient.exe` 실행
3. 웹에서 클라이언트 등록 확인
4. 완료! 🎉

## 📞 문제 해결
- 연결 안됨: 방화벽 확인 (포트 8000, 8081)
- 클라이언트 안보임: IP 주소 확인
- 기타 문제: troubleshooting.pdf 참고

## 📧 지원
- 이메일: support@switchboardplus.com
- 문서: docs.switchboardplus.com
```

### 7.4 Phase 4 체크리스트 (Cursor AI 작업)

#### 7.4.1 빌드 시스템
- [ ] React UI 빌드 스크립트
- [ ] 서버 실행 파일 생성 (pkg)
- [ ] Python 실행 파일 생성 (PyInstaller)
- [ ] 통합 빌드 스크립트

#### 7.4.2 설치 프로그램
- [ ] 서버 인스톨러 (NSIS/WiX)
- [ ] 클라이언트 인스톨러
- [ ] 자동 업데이트 기능
- [ ] 언인스톨 기능

#### 7.4.3 문서화
- [ ] 사용자 매뉴얼 작성
- [ ] 관리자 가이드 작성
- [ ] 문제 해결 가이드
- [ ] API 문서 (선택)

#### 7.4.4 품질 보증
- [ ] 전체 시스템 테스트
- [ ] 여러 환경 테스트
- [ ] 사용자 acceptance 테스트
- [ ] 성능 테스트

#### 7.4.5 배포 준비
- [ ] 배포 패키지 검증
- [ ] 체크섬 생성
- [ ] 배포 사이트 준비
- [ ] 사용자 교육 자료

---

## 🎯 8. 성공 기준 및 검증

### 8.1 핵심 기능 요구사항 (nDisplay 제어)
- [ ] **웹에서 프리셋 클릭 → 모든 Display PC에서 언리얼엔진 동시 실행**
- [ ] **nDisplay 동기화된 멀티 화면 콘텐츠 정상 출력**
- [ ] **프리셋 중지 → 모든 언리얼엔진 프로세스 안전 종료**
- [ ] 모든 Display PC 실시간 상태 모니터링
- [ ] 클라이언트 자동 재연결 (네트워크 끊김 복구)
- [ ] 5분 내 신규 클라이언트 설치 및 등록 가능

### 8.2 성능 요구사항 (운영 안정성)
- [ ] 10대 이상 클라이언트 동시 관리 및 제어
- [ ] **프리셋 실행 명령 → 5초 이내 모든 클라이언트 응답**
- [ ] 웹 UI 응답 시간 3초 이내
- [ ] **24시간 연속 운영 가능 (무인 자동 운영)**
- [ ] 서버 메모리 사용량 500MB 이하

### 8.3 사용성 요구사항 (실제 운영)
- [ ] **nDisplay 운영자가 기술 문서 없이 설치 가능**
- [ ] **웹 UI에서 직관적으로 프리셋 생성 및 실행**
- [ ] 문제 발생 시 웹에서 상태 확인 및 자가 진단 가능
- [ ] PC와 모바일에서 모두 접속 가능 (반응형 웹)
- [ ] **언리얼엔진 실행 실패 시 명확한 에러 메시지 표시**

---

## 🔮 9. 확장 계획 (Phase 1-4 완성 후)

### 9.1 v2.1 확장 기능 - 디스플레이 전원 관리 🔌

> **📅 개발 시기**: Phase 1-4 완성 → 실제 운영 안정성 확인 → v2.1 기능 추가

#### 🎯 핵심 기능 개요
```
개별 제어:
클라이언트 카드 클릭 → 모달 팝업
├── 🔌 전원 켜기 (Wake-on-LAN)
├── 🔄 재부팅 (원격 명령)
├── ⚡ 전원 끄기 (원격 명령)  
└── 🗑️ 삭제 (DB에서 제거)

일괄 제어:
디스플레이 목록 컨테이너
├── ☑️ 전체 선택/개별 선택
├── 🔌 선택된 것 전원 켜기
├── 🔄 선택된 것 재부팅
├── ⚡ 선택된 것 전원 끄기
└── 🗑️ 선택된 것 삭제
```

#### 🎨 UI 디자인 방향
- **기준**: 제공된 HTML 디자인 스타일 유지
- **모달**: 클라이언트 클릭 시 깔끔한 팝업
- **버튼**: 기존 디자인과 일관성 있는 색상 (초록/주황/빨강)
- **확인**: 위험한 작업(삭제/전원끄기)은 확인 대화상자
- **피드백**: 작업 중 로딩 상태 및 결과 토스트 알림

#### 🔧 기술 구현 방식
```
전원 켜기: Wake-on-LAN (MAC 주소 기반)
재부팅/끄기: 클라이언트에 HTTP 명령 전송
삭제: 서버 DB에서 안전 제거
상태 확인: 실시간 전원 상태 모니터링
```

#### 💡 사용 시나리오
```
출근: "전체 켜기" → 모든 Display PC 자동 부팅
퇴근: "전체 끄기" → 전력 절약을 위한 일괄 종료
문제 해결: 문제 PC 클릭 → "재부팅" → 원격 문제 해결
유지보수: 교체할 PC → "삭제" → 시스템에서 제거
```

### 9.2 v2.2 확장 기능 - 프로젝터 통합 제어 📽️

> **🎯 핵심 가치**: nDisplay 환경의 완전한 통합 관리

#### 핵심 기능
- **프로젝터 전원 관리**: 개별/일괄 전원 on/off, 워밍업/쿨다운 관리
- **디스플레이 제어**: 입력 소스 변경, 밝기/대비 조정, 화면 설정
- **상태 모니터링**: 램프 시간, 온도, 필터 상태, 에러 모니터링
- **통합 워크플로우**: 프리셋 실행 시 프로젝터 설정 자동 적용
- **스케줄링**: 자동 켜기/끄기, 유지보수 알림

#### 지원 프로토콜
```
🔗 PJLink (표준): 대부분 최신 프로젝터 지원
🌐 HTTP/TCP: 네트워크 기반 프로젝터
📡 RS-232: 구형 프로젝터 시리얼 통신
🔌 SNMP: 기업용 프로젝터 관리
```

#### 사용 시나리오
```
통합 시스템 시작:
"아침 시작" 프리셋 실행
→ Display PC 부팅 + 프로젝터 켜기
→ 입력 소스 자동 설정 + 최적 밝기 조정
→ 언리얼엔진 실행 + 프로젝터 동기화
→ 완벽한 콘텐츠 출력!

개별 문제 해결:
프로젝터 3번 문제 발생
→ 웹에서 클릭 → 상태 확인 (온도 과열)
→ "재시작" → 자동 쿨다운 후 재시작
→ 문제 해결 완료

운영 효율성:
50대 프로젝터 환경
→ "전체 끄기" 클릭 → 순차적 안전 종료
→ 전력 절약 + 램프 수명 연장
```

#### 기대 효과
- **완전한 통합 관리**: PC + 프로젝터를 하나의 시스템으로
- **운영 효율성**: 수십 대 프로젝터 원클릭 제어
- **유지보수 최적화**: 실시간 상태 모니터링 및 예방 관리
- **에너지 절약**: 스마트 스케줄링으로 불필요한 전력 소모 방지

### 9.3 v2.3 확장 기능 - 엔터프라이즈 📈
- **플러그인 시스템**: 타사 시스템 연동 지원
- **클라우드 동기화**: 설정 및 프리셋 클라우드 백업
- **모바일 앱**: 전용 모바일 관리 앱
- **API 확장**: 외부 시스템 연동용 REST API

---

## 🔧 10. Cursor AI 협업 가이드

### 10.1 각 Phase별 Cursor AI 작업 방법

#### Phase 1 시작 시
```
1. 새 폴더 생성: switchboard-plus-v2
2. Cursor AI에게 전달할 내용:
   - 이 개발 계획서
   - 원하는 Phase (예: Phase 1)
   - 구체적인 작업 요청

예시 프롬프트:
"Phase 1의 서버 기본 구조를 구현해주세요. 
 - Express + Socket.io 서버
 - SQLite 데이터베이스 연결
 - API 라우트 기본 틀
 - 정적 파일 서빙 설정"
```

#### 코드 리뷰 및 수정 요청
```
"다음 기능을 추가해주세요:
 - 클라이언트 등록 시 중복 이름 체크
 - Socket 연결 시 인증 추가
 - 에러 처리 강화"
```

### 10.2 품질 체크포인트

각 Phase 완료 시 확인사항:
1. **코드 동작 확인**: 실제 실행 가능한지
2. **에러 처리**: 예외 상황 대응
3. **로깅**: 디버깅 가능한 로그 출력
4. **문서화**: 주요 함수에 주석
5. **테스트**: 기본 기능 테스트 코드

### 10.3 협업 효율성 팁

1. **명확한 요구사항**: 구체적인 기능 명세
2. **단계별 진행**: 한 번에 너무 많은 요청 X
3. **테스트 우선**: 각 단계마다 동작 확인
4. **문서 업데이트**: 변경사항 즉시 반영

---

## 🎉 11. 마무리

이 개발 계획서는 **실무 중심의 실용적인 시스템**을 만들기 위한 로드맵입니다.

### 핵심 가치
1. **단순함**: 복잡한 설정 최소화
2. **안정성**: 수동 설정으로 확실한 연결
3. **접근성**: 웹 기반 어디서든 접속
4. **확장성**: 미래 기능 확장 고려

### Cursor AI와의 협업
- 각 Phase별로 단계적 진행
- 구체적이고 명확한 작업 지시
- 테스트 중심의 개발
- 지속적인 문서 업데이트

**Ready for Development!** 🚀

---

## 📋 부록: v2.1 전원 관리 UI 구현 예시

> 💡 **참고**: 제공된 HTML 디자인 스타일 기반

### A.1 클라이언트 모달 HTML 예시
```html
<!-- 클라이언트 클릭 시 나타나는 모달 -->
<div class="modal" id="clientModal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Display 1 관리</h3>
            <span class="close" onclick="closeModal()">&times;</span>
        </div>
        
        <div class="modal-body">
            <!-- 시스템 정보 -->
            <div class="info-section">
                <h4>시스템 정보</h4>
                <div class="info-grid">
                    <div>IP 주소: 192.168.1.101</div>
                    <div>상태: 🟢 온라인</div>
                    <div>마지막 연결: 방금 전</div>
                </div>
            </div>
            
            <!-- 전원 제어 -->
            <div class="power-section">
                <h4>전원 제어</h4>
                <div class="button-group">
                    <button class="btn btn-primary" onclick="powerAction('on')">
                        🔌 전원 켜기
                    </button>
                    <button class="btn btn-secondary" onclick="powerAction('reboot')">
                        🔄 재부팅
                    </button>
                    <button class="btn btn-danger" onclick="powerAction('off')">
                        ⚡ 전원 끄기
                    </button>
                </div>
            </div>
            
            <!-- 위험 구역 -->
            <div class="danger-section">
                <h4>위험 구역</h4>
                <button class="btn btn-danger" onclick="deleteClient()">
                    🗑️ 목록에서 삭제
                </button>
                <p class="warning-text">삭제하면 데이터베이스에서 완전히 제거됩니다.</p>
            </div>
        </div>
    </div>
</div>
```

### A.2 일괄 제어 UI 예시
```html
<!-- 디스플레이 목록 상단에 추가 -->
<div class="bulk-controls" style="margin-bottom: 15px;">
    <div class="selection-info">
        <label>
            <input type="checkbox" id="selectAll" onchange="toggleSelectAll()">
            전체 선택
        </label>
        <span id="selectedCount">0</span>개 선택됨
    </div>
    
    <div class="bulk-actions">
        <button class="btn btn-primary btn-small" onclick="bulkPower('on')">
            🔌 선택된 것 켜기
        </button>
        <button class="btn btn-secondary btn-small" onclick="bulkPower('reboot')">
            🔄 선택된 것 재부팅
        </button>
        <button class="btn btn-danger btn-small" onclick="bulkPower('off')">
            ⚡ 선택된 것 끄기
        </button>
        <button class="btn btn-danger btn-small" onclick="bulkDelete()">
            🗑️ 선택된 것 삭제
        </button>
    </div>
</div>
```

### A.3 CSS 스타일 예시 (기존 스타일 확장)
```css
/* 모달 스타일 */
.modal {
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
}

.modal-content {
    background: white;
    border-radius: 8px;
    padding: 20px;
    max-width: 500px;
    width: 90%;
    max-height: 80%;
    overflow-y: auto;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e2e8f0;
}

.close {
    font-size: 24px;
    cursor: pointer;
    color: #64748b;
}

.close:hover {
    color: #ef4444;
}

/* 버튼 그룹 */
.button-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

/* 일괄 제어 */
.bulk-controls {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bulk-actions {
    display: flex;
    gap: 6px;
}

/* 위험 구역 스타일 */
.danger-section {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #fee2e2;
}

.warning-text {
    font-size: 11px;
    color: #991b1b;
    margin-top: 5px;
}
```

---

*이 계획서는 Cursor AI와의 협업을 통해 지속적으로 업데이트됩니다.*