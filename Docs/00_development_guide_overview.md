# Switchboard Plus 개발 작업 가이드

## 📋 전체 개발 로드맵

### 🎯 **개발 목표**
언리얼엔진 nDisplay 환경의 완전한 통합 관리 시스템 구축

---

## 📁 문서 구조

### **개발 가이드**
- `00_development_guide_overview.md` - 전체 개발 로드맵 및 작업 가이드

### **v2.x 시리즈 (기본 기능)**
- `01_v2.0_mvp_development_plan.md` - MVP 개발 계획 (기본 nDisplay 제어)
- `02_v2.1_power_management_plan.md` - 전원 관리 확장 계획
- `03_v2.2_projector_integration_plan.md` - 프로젝터 통합 제어 계획
- `04_v2.3_enterprise_expansion_plan.md` - 엔터프라이즈 확장 계획

### **v2.4~v2.7 시리즈 (파일 관리)**
- `05_v2.4_basic_file_transfer_plan.md` - 기본 파일 전송 시스템
- `06_v2.5_advanced_transfer_plan.md` - 고급 전송 기능
- `07_v2.6_sync_system_plan.md` - 동기화 시스템
- `08_v2.7_advanced_management_plan.md` - 고급 관리 기능

### **v3.x 시리즈 (미디어 플랫폼)**
- `09_v3.0_media_platform_plan.md` - 미디어 관리 플랫폼 계획

---

## 🎨 웹UI 샘플 vs 개발 계획서 비교

### **✅ 현재 UI에서 이미 구현된 기능들 (v2.0 MVP)**
- 클라이언트 관리 (추가/삭제/상태 모니터링)
- 그룹 관리 (생성/편집/삭제)
- 프리셋 관리 (생성/편집/실행/삭제)
- 실시간 상태 업데이트 (Socket.io)
- 다크/라이트 테마
- 일괄 제어 기능
- 실행 히스토리 모니터링
- 성능 메트릭 표시 (CPU, RAM, 지연시간)
- 연결 히스토리 추적

### **🔄 v2.1 전원 관리에서 추가될 UI 변경사항**

#### **1. 클라이언트 카드 전원 제어 버튼**
```html
<!-- 현재: 클릭 시 상세 모달만 -->
<div class="client-item" onclick="showClientModal(client.id)">

<!-- v2.1: 전원 제어 버튼 추가 -->
<div class="client-item">
    <div class="client-power-controls">
        <button class="btn btn-primary" onclick="powerAction('wake', client.id)">🔌</button>
        <button class="btn btn-secondary" onclick="powerAction('reboot', client.id)">🔄</button>
        <button class="btn btn-danger" onclick="powerAction('shutdown', client.id)">⚡</button>
    </div>
</div>
```

#### **2. 전원 상태별 필터링 UI**
```html
<!-- v2.1: 전원 상태별 필터링 추가 -->
<div class="bulk-controls">
    <div class="power-filters">
        <label><input type="checkbox" checked> 온라인</label>
        <label><input type="checkbox" checked> 오프라인</label>
        <label><input type="checkbox" checked> 실행중</label>
    </div>
    <div class="bulk-actions">
        <button class="btn btn-primary btn-bulk" onclick="bulkPowerAction('wake_all')">전체 켜기</button>
        <button class="btn btn-secondary btn-bulk" onclick="bulkPowerAction('restart_all')">전체 재부팅</button>
        <button class="btn btn-danger btn-bulk" onclick="bulkPowerAction('shutdown_all')">전체 끄기</button>
    </div>
</div>
```

#### **3. 전원 상태 모니터링 강화**
```css
/* v2.1: 전원 상태별 색상 추가 */
.client-item.powering-on {
    background: var(--client-warming);
    border-color: #f59e0b;
}

.client-item.powering-off {
    background: var(--client-cooling);
    border-color: #3b82f6;
}

.client-item.error {
    background: var(--client-error);
    border-color: #ef4444;
}
```

### **🔄 v2.2 프로젝터 통합에서 추가될 UI 변경사항**

#### **1. 프로젝터 관리 섹션**
```html
<!-- v2.2: 새로운 프로젝터 섹션 추가 -->
<div class="section">
    <h2 class="section-title">
        프로젝터 관리
        <button class="btn btn-secondary btn-with-text" onclick="showAddProjectorModal()">
            ➕ 새 프로젝터
        </button>
    </h2>
    
    <div class="projector-grid" id="projectorGrid">
        <!-- 프로젝터 카드들 -->
    </div>
</div>
```

#### **2. 프로젝터 카드 컴포넌트**
```html
<div class="projector-card">
    <div class="projector-header">
        <div class="projector-name">프로젝터_01</div>
        <div class="projector-status online">온라인</div>
    </div>
    <div class="projector-metrics">
        <div>램프: 1,234시간</div>
        <div>온도: 45°C</div>
        <div>입력: HDMI1</div>
        <div>밝기: 80%</div>
    </div>
    <div class="projector-controls">
        <button class="btn btn-primary" onclick="projectorAction('power_on')">🔌</button>
        <button class="btn btn-secondary" onclick="projectorAction('input_hdmi1')">📺</button>
        <button class="btn btn-secondary" onclick="projectorAction('brightness_up')">🌟</button>
        <button class="btn btn-danger" onclick="projectorAction('power_off')">⚡</button>
    </div>
</div>
```

#### **3. 통합 워크플로우 UI**
```html
<!-- v2.2: 통합 워크플로우 섹션 -->
<div class="section">
    <h2 class="section-title">
        통합 워크플로우
        <button class="btn btn-primary btn-with-text" onclick="showWorkflowModal()">
            ➕ 새 워크플로우
        </button>
    </h2>
    
    <div class="workflow-list">
        <div class="workflow-item">
            <div class="workflow-name">아침 시작</div>
            <div class="workflow-steps">
                <span>1. 프로젝터 켜기</span>
                <span>2. 5분 대기</span>
                <span>3. PC 부팅</span>
                <span>4. 언리얼엔진 실행</span>
            </div>
            <button class="btn btn-primary" onclick="executeWorkflow('morning_start')">▶️ 실행</button>
        </div>
    </div>
</div>
```

### **🔄 v2.3 엔터프라이즈에서 추가될 UI 변경사항**

#### **1. 사용자 권한 관리 UI**
```html
<!-- v2.3: 로그인/권한 관리 -->
<div class="header">
    <div class="header-content">
        <h1>⚡ Switchboard Plus v2.3</h1>
        <div class="user-info">
            <span>관리자</span>
            <button class="btn btn-secondary" onclick="showUserSettings()">⚙️</button>
            <button class="btn btn-secondary" onclick="logout()">🚪</button>
        </div>
    </div>
</div>
```

#### **2. 플러그인 관리 UI**
```html
<!-- v2.3: 플러그인 관리 섹션 -->
<div class="section">
    <h2 class="section-title">
        플러그인 관리
        <button class="btn btn-secondary btn-with-text" onclick="showPluginMarket()">
            🔌 플러그인 마켓
        </button>
    </h2>
    
    <div class="plugin-grid">
        <div class="plugin-card">
            <div class="plugin-name">타사 디스플레이 제어</div>
            <div class="plugin-status installed">설치됨</div>
            <button class="btn btn-secondary" onclick="configurePlugin('display_control')">설정</button>
        </div>
    </div>
</div>
```

### **🔄 v2.4~v2.7 파일 관리에서 추가될 UI 변경사항**

#### **1. 파일 관리 섹션**
```html
<!-- v2.4: 파일 관리 섹션 -->
<div class="section">
    <h2 class="section-title">
        파일 관리
        <button class="btn btn-secondary btn-with-text" onclick="showFileUploadModal()">
            📤 파일 업로드
        </button>
    </h2>
    
    <div class="file-browser">
        <div class="file-list">
            <div class="file-item">
                <div class="file-name">content_video.mp4</div>
                <div class="file-size">2.5GB</div>
                <div class="file-status synced">동기화됨</div>
                <button class="btn btn-primary" onclick="syncFile('content_video.mp4')">🔄</button>
            </div>
        </div>
    </div>
</div>
```

#### **2. 동기화 상태 모니터링**
```html
<!-- v2.6: 동기화 모니터링 -->
<div class="sync-monitor">
    <div class="sync-status">
        <div class="sync-progress">
            <div class="progress-bar" style="width: 75%"></div>
        </div>
        <div class="sync-info">
            <span>동기화 중: 3/4 파일</span>
            <span>남은 시간: 2분 30초</span>
        </div>
    </div>
</div>
```

### **🔄 v3.0 미디어 플랫폼에서 추가될 UI 변경사항**

#### **1. 미디어 플레이어 UI**
```html
<!-- v3.0: 미디어 플레이어 -->
<div class="media-player">
    <div class="video-container">
        <video id="mainVideo" controls>
            <source src="content_video.mp4" type="video/mp4">
        </video>
    </div>
    <div class="media-controls">
        <button class="btn btn-primary" onclick="playMedia()">▶️</button>
        <button class="btn btn-secondary" onclick="pauseMedia()">⏸️</button>
        <button class="btn btn-secondary" onclick="stopMedia()">⏹️</button>
        <div class="volume-control">
            <input type="range" min="0" max="100" value="80">
        </div>
    </div>
</div>
```

#### **2. 미디어 스케줄링**
```html
<!-- v3.0: 미디어 스케줄링 -->
<div class="media-schedule">
    <div class="schedule-item">
        <div class="schedule-time">09:00 - 12:00</div>
        <div class="schedule-content">메인 콘텐츠 재생</div>
        <div class="schedule-status active">재생 중</div>
    </div>
</div>
```

### **📊 주요 UI 변경 사항 요약**

| 버전 | 주요 변경사항 | UI 추가 요소 |
|------|---------------|--------------|
| v2.0 | ✅ 기본 완성 | 클라이언트/그룹/프리셋 관리 |
| v2.1 | 🔌 전원 제어 | Wake-on-LAN 버튼, 전원 상태 필터 |
| v2.2 | 📽️ 프로젝터 통합 | 프로젝터 카드, 통합 워크플로우 |
| v2.3 | 🛡️ 엔터프라이즈 | 로그인/권한, 플러그인 관리 |
| v2.4~v2.7 | 📁 파일 관리 | 파일 브라우저, 동기화 모니터 |
| v3.0 | 🎬 미디어 플랫폼 | 미디어 플레이어, 스케줄링 |

---

## 🚀 개발 순서 및 단계별 목표

### **Phase 1: MVP 기반 (v2.0)**
**목표**: 기본 동작하는 시스템 구축
- ✅ Express 서버 + SQLite + Socket.io
- ✅ React 웹 UI (클라이언트/프리셋/그룹 관리)
- ✅ Python 클라이언트 (언리얼엔진 제어)
- ✅ 기본 파일 전송 기능
- **성공 기준**: 웹에서 프리셋 클릭 → 모든 PC에서 언리얼엔진 실행

### **Phase 2: 전원 관리 (v2.1)**
**목표**: 완전한 전원 제어 시스템
- 🔌 Wake-on-LAN (전원 켜기)
- ⚡ 원격 재부팅/전원 끄기
- 📊 실시간 전원 상태 모니터링
- 🎯 일괄 전원 제어 (전체 켜기/끄기)
- **성공 기준**: 원클릭으로 모든 PC 전원 제어 가능

### **Phase 3: 프로젝터 통합 (v2.2)**
**목표**: PC + 프로젝터 통합 관리
- 📽️ 4가지 프로토콜 지원 (PJLink, HTTP, RS-232, SNMP)
- 🎛️ 프로젝터 전원/입력/화면 설정 제어
- 📊 실시간 프로젝터 상태 모니터링
- 🔄 통합 워크플로우 (PC 부팅 + 프로젝터 켜기 + 언리얼엔진 실행)
- **성공 기준**: 하나의 시스템으로 PC와 프로젝터 완전 제어

### **Phase 4: 엔터프라이즈 확장 (v2.3)**
**목표**: 대규모 환경 지원
- 🔌 플러그인 시스템 (타사 연동)
- ☁️ 클라우드 동기화 (설정/프리셋 백업)
- 📱 모바일 앱 (iOS/Android)
- 🔗 API 확장 (외부 시스템 연동)
- 🛡️ 사용자 권한 관리 (RBAC)
- 📝 감사 로그 (모든 작업 이력)
- **성공 기준**: 대규모/기업 환경에서 실질적 운영 가능

### **Phase 5: 파일 관리 시스템 (v2.4~v2.7)**
**목표**: 완전한 파일 관리 솔루션

#### **v2.4 - 기본 파일 전송**
- 📤 기본 파일 업로드/다운로드
- 📁 중앙 파일 관리
- **성공 기준**: 100MB 파일을 5대 클라이언트에 10분 내 전송

#### **v2.5 - 고급 전송 기능**
- 📦 청크 기반 대용량 파일 전송
- 🔍 파일 중복 제거 (Deduplication)
- 📊 실시간 진행률 모니터링
- **성공 기준**: 500MB 파일을 10대 클라이언트에 5분 내 전송

#### **v2.6 - 동기화 시스템**
- 🔄 실시간 폴더 동기화
- ⚔️ 충돌 해결 시스템
- ⏰ 스케줄링 시스템
- **성공 기준**: 폴더 변경 감지 5초 이내 반응

#### **v2.7 - 고급 관리 기능**
- 🗂️ 파일 버전 관리
- 🔍 고급 검색 및 필터링
- 💾 백업 및 복구 시스템
- 📊 디스크 사용량 관리
- **성공 기준**: 엔터프라이즈급 파일 관리 완성

### **Phase 6: 미디어 플랫폼 (v3.0)**
**목표**: 완전한 미디어 관리 플랫폼
- 🎬 동영상 재생 시스템
- 🎵 오디오 관리
- 🖼️ 이미지 갤러리
- 📺 미디어 스케줄링
- **성공 기준**: 완전한 미디어 관리 플랫폼 구축

---

## 📅 개발 일정 요약

| 버전 | 기간 | 핵심 기능 | 완료 기준 |
|------|------|-----------|-----------|
| v2.0 | 8-10주 | MVP (기본 nDisplay 제어) | 웹에서 언리얼엔진 실행 |
| v2.1 | 4-6주 | 전원 관리 | 원클릭 전원 제어 |
| v2.2 | 6-8주 | 프로젝터 통합 | PC+프로젝터 통합 제어 |
| v2.3 | 6-8주 | 엔터프라이즈 | 대규모 환경 지원 |
| v2.4 | 1주 | 기본 파일 전송 | 100MB 파일 전송 |
| v2.5 | 1주 | 고급 전송 | 500MB 파일 전송 |
| v2.6 | 1주 | 동기화 | 실시간 폴더 동기화 |
| v2.7 | 1주 | 고급 관리 | 버전 관리 + 검색 |
| v3.0 | 8-12주 | 미디어 플랫폼 | 완전한 미디어 관리 |

---

## 🎯 각 단계별 핵심 성공 기준

### **v2.0 MVP**
- ✅ 웹에서 프리셋 클릭 → 언리얼엔진 실행
- ✅ 5분 내 서버 설치 및 웹 접속
- ✅ 5분 내 클라이언트 설치 및 연결

### **v2.1 전원 관리**
- ✅ Wake-on-LAN 성공률 95% 이상
- ✅ 전원 상태 확인 응답 시간 10초 이내
- ✅ 20대 PC 동시 전원 제어

### **v2.2 프로젝터 통합**
- ✅ 4가지 프로토콜 지원
- ✅ 프로젝터 제어 응답 시간 5초 이내
- ✅ 50대 프로젝터 동시 관리

### **v2.3 엔터프라이즈**
- ✅ 플러그인 시스템으로 타사 연동
- ✅ 클라우드 백업/복구 및 멀티사이트 동기화
- ✅ 모바일 앱에서 주요 기능 제어

### **v2.4~v2.7 파일 관리**
- ✅ 500MB 파일을 10대 클라이언트에 5분 내 전송
- ✅ 폴더 변경 감지 5초 이내 반응
- ✅ 파일 버전 10개까지 관리

### **v3.0 미디어 플랫폼**
- ✅ 완전한 미디어 관리 플랫폼
- ✅ 동영상/오디오/이미지 통합 관리
- ✅ 미디어 스케줄링 및 자동 재생

---

## 🔧 개발 우선순위

### **1순위 (필수)**
- v2.0 MVP → v2.1 전원 관리 → v2.2 프로젝터 통합

### **2순위 (중요)**
- v2.3 엔터프라이즈 → v2.4~v2.7 파일 관리

### **3순위 (고급)**
- v3.0 미디어 플랫폼

---

## 💡 개발 전략

### **MVP 우선 (v2.0)**
- 완벽한 기능보다 **동작하는 시스템** 우선
- 복잡한 설계보다 **간단하고 명확한 코드** 우선
- 모든 기능보다 **핵심 가치 제공** 우선

### **점진적 확장**
- 각 버전 완성 후 다음 버전 시작
- 사용자 피드백 기반으로 우선순위 조정
- 안정성 확보 후 고급 기능 추가

### **실용적 접근**
- 실제 사용 환경에서 테스트
- 성능과 안정성 균형 유지
- 사용자 편의성 최우선

---

## 📚 문서 활용 가이드

### **개발 시작 시**
1. `00_development_guide_overview.md` - 전체 로드맵 확인
2. `01_v2.0_mvp_development_plan.md` - MVP 개발 시작

### **단계별 개발 시**
- 각 버전별 상세 계획서 참조
- 성공 기준 및 체크리스트 활용
- 기술 아키텍처 및 API 설계 참조

### **문제 해결 시**
- 각 문서의 "문제 해결" 섹션 참조
- 성공 기준과 실제 결과 비교
- 개발 전략 재검토

---

## 🎉 최종 목표

**완전한 nDisplay 환경 통합 관리 시스템**
- 🖥️ PC 제어 (전원, 언리얼엔진)
- 📽️ 프로젝터 제어 (전원, 설정)
- 📁 파일 관리 (전송, 동기화, 버전 관리)
- ☁️ 클라우드 연동 (백업, 동기화)
- 📱 모바일 지원 (원격 제어)
- 🎬 미디어 관리 (재생, 스케줄링)

**Ready for Development!** 🚀 