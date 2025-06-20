# Switchboard Plus v2.1 - 전원 관리 확장

## 📋 1. 문서 개요

**프로젝트**: Switchboard Plus v2.1 (전원 관리)  
**전제 조건**: v2.0 완성 및 안정 운영 확인  
**개발 기간**: 4주  
**핵심 기능**: 디스플레이 PC 전원 관리 통합

> 🎯 **v2.1 목표**: nDisplay 환경의 완전한 전원 관리 시스템
> ⚡ **핵심 가치**: 출근 한 번의 클릭으로 모든 시스템 가동

---

## 🔌 2. 전원 관리 시스템 개요

### 2.1 지원 기능

```
🔌 전원 켜기 (Wake-on-LAN)
├── 개별 클라이언트 원격 부팅
├── 그룹별 일괄 부팅  
├── 순차 부팅 (전력 부하 분산)
└── 부팅 상태 실시간 모니터링

🔄 재부팅 (원격 명령)
├── 소프트웨어 재부팅
├── 강제 재부팅 (응답 없을 때)
├── 안전 재부팅 (프로세스 종료 후)
└── 재부팅 후 자동 복구

⚡ 전원 끄기 (원격 종료)
├── 정상 종료 (언리얼엔진 종료 후)
├── 강제 종료 (비상시)
├── 스케줄 종료 (시간 예약)
└── 절전 모드 진입
```

### 2.2 시스템 아키텍처

```
🖥️ Switchboard Plus Server v2.1
┌─────────────────────────────────────┐
│ ✅ v2.0 기본 기능 (모든 기능)       │
├─────────────────────────────────────┤
│ 🆕 Wake-on-LAN 서비스               │
│ 🆕 전원 상태 모니터링               │
│ 🆕 스케줄링 엔진                    │
│ 🆕 전력 사용량 추적                 │
└─────────────────────────────────────┘
              ↓ WOL + SSH/WMI
┌─────────────────────────────────────┐
│  Display PC들 (N대)                 │
├─────────────────────────────────────┤
│ ✅ v2.0 Python 클라이언트           │
│ 🆕 전원 관리 에이전트               │
│ 🆕 MAC 주소 등록                    │
│ 🆕 전력 상태 센서                   │
└─────────────────────────────────────┘
```

---

## 🚀 3. 개발 로드맵 (4주)

### Week 1: Wake-on-LAN 구현 🔌
```
목표: 원격 부팅 기능 완성
핵심: MAC 주소 기반 WOL 패킷 전송
```

**주요 작업:**
- MAC 주소 수집 및 등록 시스템
- WOL 패킷 전송 라이브러리 구현
- 부팅 상태 확인 (ping + 클라이언트 연결)
- 웹 UI에 전원 켜기 버튼 추가

### Week 2: 원격 제어 구현 🔄
```
목표: 재부팅/종료 기능 완성  
핵심: 안전한 원격 제어 명령 시스템
```

**주요 작업:**
- Python 클라이언트에 전원 관리 모듈 추가
- 재부팅/종료 명령 처리
- 프로세스 안전 종료 로직
- 강제 제어 옵션 (비상시)

### Week 3: 스케줄링 및 자동화 ⏰
```
목표: 자동 전원 관리 시스템
핵심: 시간 기반 자동 제어
```

**주요 작업:**
- 스케줄 설정 UI 구현
- 크론 기반 스케줄링 엔진
- 출근/퇴근 시간 자동 제어
- 절전 정책 설정

### Week 4: 고급 기능 및 최적화 ⚙️
```
목표: 전력 관리 최적화
핵심: 효율적인 전력 사용
```

**주요 작업:**
- 전력 사용량 모니터링
- 순차 부팅 (전력 부하 분산)
- 전원 상태 대시보드
- 에너지 절약 리포트

---

## 🔧 4. 기술 구현 상세

### 4.1 Wake-on-LAN 구현

#### 서버 사이드 (Node.js)
```javascript
// services/wakeonlan.js
const dgram = require('dgram');

class WakeOnLAN {
    constructor() {
        this.socket = dgram.createSocket('udp4');
    }
    
    async wake(macAddress, broadcastIP = '255.255.255.255') {
        const magicPacket = this.createMagicPacket(macAddress);
        
        return new Promise((resolve, reject) => {
            this.socket.send(magicPacket, 9, broadcastIP, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    
    createMagicPacket(macAddress) {
        const mac = macAddress.replace(/[:-]/g, '');
        const macBuffer = Buffer.from(mac, 'hex');
        
        // Magic Packet: 6 * 0xFF + 16 * MAC
        const magicPacket = Buffer.alloc(102);
        
        // 6 bytes of 0xFF
        for (let i = 0; i < 6; i++) {
            magicPacket[i] = 0xFF;
        }
        
        // 16 repetitions of MAC address
        for (let i = 0; i < 16; i++) {
            macBuffer.copy(magicPacket, 6 + i * 6);
        }
        
        return magicPacket;
    }
    
    async checkBootStatus(ipAddress, timeout = 60000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const response = await ping(ipAddress);
                if (response) {
                    return await this.waitForClientConnection(ipAddress);
                }
            } catch (error) {
                // Continue checking
            }
            
            await this.sleep(5000); // 5초마다 체크
        }
        
        return false;
    }
}
```

#### MAC 주소 자동 수집
```javascript
// routes/clients.js - MAC 주소 등록 API
router.post('/:id/mac', async (req, res) => {
    try {
        const client = await Client.findByPk(req.params.id);
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        
        const { mac_address } = req.body;
        
        // MAC 주소 형식 검증
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(mac_address)) {
            return res.status(400).json({ error: 'Invalid MAC address format' });
        }
        
        await client.update({ mac_address });
        
        res.json({
            success: true,
            message: 'MAC address registered',
            client: client
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### 4.2 Python 클라이언트 전원 관리

```python
# power_manager.py - 전원 관리 모듈
import os
import sys
import time
import psutil
import subprocess
from typing import Dict, Any

class PowerManager:
    def __init__(self):
        self.platform = sys.platform
        
    def get_mac_address(self) -> str:
        """네트워크 인터페이스의 MAC 주소 반환"""
        import uuid
        mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                       for elements in range(0,2*6,2)][::-1])
        return mac
        
    def shutdown(self, force: bool = False) -> Dict[str, Any]:
        """시스템 종료"""
        try:
            if self.platform == "win32":
                cmd = "shutdown /s /t 30" if not force else "shutdown /s /f /t 0"
            else:
                cmd = "sudo shutdown -h +1" if not force else "sudo shutdown -h now"
                
            subprocess.run(cmd, shell=True, check=True)
            
            return {
                "success": True,
                "action": "shutdown",
                "force": force,
                "message": f"Shutdown command sent ({'forced' if force else 'graceful'})"
            }
            
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "error": f"Shutdown failed: {e}",
                "action": "shutdown"
            }
    
    def reboot(self, force: bool = False) -> Dict[str, Any]:
        """시스템 재부팅"""
        try:
            if self.platform == "win32":
                cmd = "shutdown /r /t 30" if not force else "shutdown /r /f /t 0"
            else:
                cmd = "sudo reboot" if force else "sudo shutdown -r +1"
                
            subprocess.run(cmd, shell=True, check=True)
            
            return {
                "success": True,
                "action": "reboot",
                "force": force,
                "message": f"Reboot command sent ({'forced' if force else 'graceful'})"
            }
            
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "error": f"Reboot failed: {e}",
                "action": "reboot"
            }
    
    def get_power_status(self) -> Dict[str, Any]:
        """전원 상태 정보 수집"""
        try:
            battery = psutil.sensors_battery()
            
            return {
                "timestamp": time.time(),
                "uptime": time.time() - psutil.boot_time(),
                "cpu_usage": psutil.cpu_percent(interval=1),
                "memory_usage": psutil.virtual_memory().percent,
                "disk_usage": psutil.disk_usage('/').percent,
                "temperature": self.get_cpu_temperature(),
                "power_source": "battery" if battery else "ac",
                "battery_percent": battery.percent if battery else None,
                "network_interfaces": self.get_network_status()
            }
            
        except Exception as e:
            return {
                "error": f"Failed to get power status: {e}",
                "timestamp": time.time()
            }
    
    def get_cpu_temperature(self) -> float:
        """CPU 온도 측정 (가능한 경우)"""
        try:
            if self.platform == "win32":
                # Windows에서는 WMI 사용
                import wmi
                w = wmi.WMI(namespace=r"root\OpenHardwareMonitor")
                temperature_infos = w.Sensor()
                for sensor in temperature_infos:
                    if sensor.SensorType == u'Temperature' and 'CPU' in sensor.Name:
                        return float(sensor.Value)
            else:
                # Linux에서는 sensors 명령 사용
                temps = psutil.sensors_temperatures()
                if 'coretemp' in temps:
                    return temps['coretemp'][0].current
                    
        except Exception:
            pass
            
        return 0.0
    
    def get_network_status(self) -> Dict[str, str]:
        """네트워크 인터페이스 상태"""
        interfaces = {}
        for interface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == 2:  # IPv4
                    interfaces[interface] = addr.address
                    break
        return interfaces

# main.py에 통합
class SwitchboardClient:
    def __init__(self):
        # 기존 초기화...
        self.power_manager = PowerManager()
        
    def register_with_server(self):
        """서버에 MAC 주소와 함께 등록"""
        try:
            # 기본 등록
            response = requests.post(f"{self.server_url}/api/clients", json={
                "name": self.config["client_name"],
                "ip_address": self.get_local_ip(),
                "port": self.config.get("port", 8081),
                "description": self.config.get("description", "")
            })
            
            if response.status_code in [200, 201]:
                client_id = response.json()['id']
                
                # MAC 주소 등록
                mac_address = self.power_manager.get_mac_address()
                mac_response = requests.post(
                    f"{self.server_url}/api/clients/{client_id}/mac",
                    json={"mac_address": mac_address}
                )
                
                if mac_response.status_code == 200:
                    print(f"✅ MAC 주소 등록 완료: {mac_address}")
                
                return True
                
        except Exception as e:
            print(f"❌ 서버 등록 실패: {e}")
            return False
    
    def handle_power_command(self, data):
        """전원 관리 명령 처리"""
        action = data.get('action')
        force = data.get('force', False)
        
        if action == 'shutdown':
            result = self.power_manager.shutdown(force)
        elif action == 'reboot':
            result = self.power_manager.reboot(force)
        elif action == 'status':
            result = self.power_manager.get_power_status()
        else:
            result = {
                "success": False,
                "error": f"Unknown power action: {action}"
            }
        
        # 결과를 서버에 보고
        self.sio.emit('power_command_result', {
            "execution_id": data.get('execution_id'),
            "client_name": self.config["client_name"],
            "action": action,
            "result": result
        })
```

### 4.3 웹 UI 전원 관리 인터페이스

#### 개별 클라이언트 전원 제어
```javascript
// 클라이언트 모달에 전원 제어 버튼 추가
function createPowerControlSection() {
    return `
        <div class="info-section">
            <h4>전원 제어</h4>
            <div class="power-controls">
                <div class="power-row">
                    <button class="btn-power btn-power-on" onclick="powerAction('wake')" 
                            title="Wake-on-LAN으로 원격 부팅">
                        🔌 전원 켜기
                    </button>
                    <div class="power-status" id="powerStatus">
                        <span class="status-indicator offline"></span>
                        전원 꺼짐
                    </div>
                </div>
                
                <div class="power-row">
                    <button class="btn-power btn-power-reboot" onclick="powerAction('reboot')" 
                            title="안전한 재부팅">
                        🔄 재부팅
                    </button>
                    <button class="btn-power btn-power-reboot-force" onclick="powerAction('reboot', true)" 
                            title="강제 재부팅">
                        ⚡ 강제 재부팅
                    </button>
                </div>
                
                <div class="power-row">
                    <button class="btn-power btn-power-shutdown" onclick="powerAction('shutdown')" 
                            title="안전한 종료">
                        ⏸️ 종료
                    </button>
                    <button class="btn-power btn-power-shutdown-force" onclick="powerAction('shutdown', true)" 
                            title="강제 종료">
                        🛑 강제 종료
                    </button>
                </div>
            </div>
            
            <div class="power-info">
                <div class="power-metric">
                    <span>가동 시간:</span>
                    <span id="uptime">-</span>
                </div>
                <div class="power-metric">
                    <span>CPU 온도:</span>
                    <span id="temperature">-</span>
                </div>
                <div class="power-metric">
                    <span>전력 상태:</span>
                    <span id="powerSource">-</span>
                </div>
            </div>
        </div>
    `;
}

async function powerAction(action, force = false) {
    const client = clients.get(currentClientId);
    if (!client) return;
    
    const confirmMessage = {
        'wake': `"${client.name}"의 전원을 켜시겠습니까?`,
        'reboot': `"${client.name}"을(를) ${force ? '강제로 ' : ''}재부팅하시겠습니까?`,
        'shutdown': `"${client.name}"을(를) ${force ? '강제로 ' : ''}종료하시겠습니까?`
    };
    
    if (confirm(confirmMessage[action])) {
        try {
            showToast(`전원 ${action} 명령을 전송하고 있습니다...`, 'info');
            
            const response = await fetch(`/api/clients/${currentClientId}/power`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, force })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showToast(`전원 ${action} 명령이 전송되었습니다.`, 'success');
                
                if (action === 'wake') {
                    // 부팅 상태 모니터링 시작
                    startBootMonitoring(currentClientId);
                }
            } else {
                showToast(`전원 ${action} 실패: ${result.error}`, 'error');
            }
            
        } catch (error) {
            showToast(`전원 제어 오류: ${error.message}`, 'error');
        }
    }
}

function startBootMonitoring(clientId) {
    const client = clients.get(clientId);
    const statusElement = document.getElementById('powerStatus');
    
    if (statusElement) {
        statusElement.innerHTML = `
            <span class="status-indicator booting"></span>
            부팅 중... <div class="spinner"></div>
        `;
    }
    
    // Socket으로 부팅 상태 모니터링
    socket.emit('monitor_boot_status', { clientId });
}
```

#### 일괄 전원 제어
```javascript
// 그룹 선택 후 일괄 전원 제어
function bulkPowerAction(action, force = false) {
    if (selectedGroups.size === 0) {
        showToast('선택된 그룹이 없습니다.', 'error');
        return;
    }
    
    const actionNames = {
        'wake': '켜기',
        'reboot': '재부팅',
        'shutdown': '끄기'
    };
    
    const totalClients = getTotalClientsInSelectedGroups();
    const actionName = actionNames[action];
    const forceText = force ? ' (강제)' : '';
    
    if (confirm(`선택된 그룹의 ${totalClients}대 클라이언트를 모두 ${actionName}${forceText} 하시겠습니까?`)) {
        
        showToast(`일괄 전원 ${actionName} 작업을 시작합니다...`, 'info');
        
        // 서버에 일괄 전원 제어 요청
        socket.emit('bulk_power_action', {
            action: action,
            force: force,
            group_ids: Array.from(selectedGroups),
            sequential: action === 'wake' // 부팅은 순차적으로
        });
    }
}

// 순차 부팅 모니터링
socket.on('sequential_boot_progress', (data) => {
    const { current, total, client_name, status } = data;
    
    showToast(`순차 부팅 진행중: ${current}/${total} - ${client_name} ${status}`, 'info');
    
    if (current === total) {
        showToast(`모든 클라이언트 부팅 완료! (${total}대)`, 'success');
    }
});
```

### 4.4 스케줄링 시스템

#### 스케줄 설정 UI
```javascript
// 스케줄 관리 모달
function showScheduleModal() {
    const modalHTML = `
        <div class="modal" id="scheduleModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>전원 스케줄 설정</h3>
                    <span class="close" onclick="closeScheduleModal()">&times;</span>
                </div>
                
                <div class="modal-body">
                    <div class="schedule-tabs">
                        <button class="tab-btn active" onclick="showScheduleTab('daily')">
                            일일 스케줄
                        </button>
                        <button class="tab-btn" onclick="showScheduleTab('weekly')">
                            주간 스케줄
                        </button>
                        <button class="tab-btn" onclick="showScheduleTab('custom')">
                            사용자 정의
                        </button>
                    </div>
                    
                    <div class="schedule-content" id="dailySchedule">
                        <h4>평일 자동 제어</h4>
                        <div class="schedule-row">
                            <label>출근 시간 (자동 켜기):</label>
                            <input type="time" id="workStartTime" value="08:30">
                            <input type="checkbox" id="enableWorkStart" checked>
                        </div>
                        
                        <div class="schedule-row">
                            <label>퇴근 시간 (자동 끄기):</label>
                            <input type="time" id="workEndTime" value="18:00">
                            <input type="checkbox" id="enableWorkEnd" checked>
                        </div>
                        
                        <div class="schedule-row">
                            <label>대상 그룹:</label>
                            <select id="scheduleTargetGroup" multiple>
                                <!-- 그룹 목록 동적 로드 -->
                            </select>
                        </div>
                        
                        <div class="schedule-options">
                            <label>
                                <input type="checkbox" id="weekendSchedule">
                                주말에도 적용
                            </label>
                            <label>
                                <input type="checkbox" id="holidaySchedule">
                                공휴일에도 적용
                            </label>
                        </div>
                    </div>
                    
                    <div class="power-savings">
                        <h4>절전 설정</h4>
                        <div class="savings-option">
                            <label>유휴 시간 자동 절전:</label>
                            <select id="idleTimeout">
                                <option value="0">사용 안함</option>
                                <option value="30">30분</option>
                                <option value="60">1시간</option>
                                <option value="120">2시간</option>
                            </select>
                        </div>
                        
                        <div class="savings-option">
                            <label>점심시간 절전:</label>
                            <input type="time" id="lunchStart" value="12:00">
                            <span>~</span>
                            <input type="time" id="lunchEnd" value="13:00">
                            <input type="checkbox" id="enableLunchPower">
                        </div>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeScheduleModal()">취소</button>
                    <button class="btn btn-primary" onclick="saveSchedule()">저장</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('scheduleModal').style.display = 'flex';
    loadScheduleData();
}

async function saveSchedule() {
    const scheduleData = {
        daily: {
            work_start: document.getElementById('workStartTime').value,
            work_end: document.getElementById('workEndTime').value,
            enable_start: document.getElementById('enableWorkStart').checked,
            enable_end: document.getElementById('enableWorkEnd').checked,
            target_groups: Array.from(document.getElementById('scheduleTargetGroup').selectedOptions)
                               .map(option => option.value),
            weekend: document.getElementById('weekendSchedule').checked,
            holiday: document.getElementById('holidaySchedule').checked
        },
        power_saving: {
            idle_timeout: parseInt(document.getElementById('idleTimeout').value),
            lunch_start: document.getElementById('lunchStart').value,
            lunch_end: document.getElementById('lunchEnd').value,
            enable_lunch: document.getElementById('enableLunchPower').checked
        }
    };
    
    try {
        const response = await fetch('/api/schedule/power', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduleData)
        });
        
        if (response.ok) {
            showToast('전원 스케줄이 저장되었습니다.', 'success');
            closeScheduleModal();
        } else {
            showToast('스케줄 저장에 실패했습니다.', 'error');
        }
        
    } catch (error) {
        showToast(`스케줄 저장 오류: ${error.message}`, 'error');
    }
}
```

#### 서버 사이드 스케줄러
```javascript
// services/scheduler.js
const cron = require('node-cron');

class PowerScheduler {
    constructor(wakeOnLAN, socketManager) {
        this.wol = wakeOnLAN;
        this.socketManager = socketManager;
        this.schedules = new Map();
    }
    
    async loadSchedules() {
        // 데이터베이스에서 스케줄 로드
        const schedules = await Schedule.findAll({ where: { active: true } });
        
        schedules.forEach(schedule => {
            this.registerSchedule(schedule);
        });
    }
    
    registerSchedule(schedule) {
        if (schedule.type === 'daily') {
            // 매일 반복 스케줄
            const cronExpression = this.buildCronExpression(schedule);
            
            const task = cron.schedule(cronExpression, async () => {
                await this.executeScheduledAction(schedule);
            }, {
                scheduled: true,
                timezone: "Asia/Seoul"
            });
            
            this.schedules.set(schedule.id, task);
        }
    }
    
    buildCronExpression(schedule) {
        const time = schedule.time.split(':');
        const hour = parseInt(time[0]);
        const minute = parseInt(time[1]);
        
        if (schedule.weekend_enabled) {
            // 매일
            return `${minute} ${hour} * * *`;
        } else {
            // 평일만 (월-금)
            return `${minute} ${hour} * * 1-5`;
        }
    }
    
    async executeScheduledAction(schedule) {
        console.log(`🕒 스케줄 실행: ${schedule.name} (${schedule.action})`);
        
        try {
            const groups = await this.getScheduleGroups(schedule.id);
            const clients = await this.getClientsFromGroups(groups);
            
            if (schedule.action === 'wake') {
                await this.executeSequentialWake(clients);
            } else if (schedule.action === 'shutdown') {
                await this.executeBulkShutdown(clients);
            }
            
            // 웹 클라이언트에 알림
            this.socketManager.broadcast('schedule_executed', {
                schedule_name: schedule.name,
                action: schedule.action,
                client_count: clients.length,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error(`스케줄 실행 실패: ${schedule.name}`, error);
        }
    }
    
    async executeSequentialWake(clients) {
        // 순차적 부팅 (전력 부하 분산)
        for (let i = 0; i < clients.length; i++) {
            const client = clients[i];
            
            try {
                await this.wol.wake(client.mac_address);
                console.log(`🔌 부팅 시작: ${client.name}`);
                
                // 각 클라이언트 간 30초 간격
                if (i < clients.length - 1) {
                    await this.sleep(30000);
                }
                
            } catch (error) {
                console.error(`부팅 실패: ${client.name}`, error);
            }
        }
    }
    
    async executeBulkShutdown(clients) {
        // 동시 종료
        const shutdownPromises = clients.map(client => {
            return this.socketManager.sendToClient(client.name, 'power_command', {
                action: 'shutdown',
                force: false,
                delay: 300 // 5분 지연
            });
        });
        
        await Promise.allSettled(shutdownPromises);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

## 📊 5. 전력 관리 대시보드

### 5.1 실시간 전력 상태 모니터링

```javascript
// 전력 대시보드 컴포넌트
function createPowerDashboard() {
    return `
        <div class="power-dashboard">
            <div class="dashboard-header">
                <h2>전력 관리 대시보드</h2>
                <div class="dashboard-controls">
                    <button class="btn btn-primary" onclick="showScheduleModal()">
                        ⏰ 스케줄 설정
                    </button>
                    <button class="btn btn-secondary" onclick="exportPowerReport()">
                        📊 리포트 내보내기
                    </button>
                </div>
            </div>
            
            <div class="power-stats-grid">
                <div class="power-stat-card">
                    <div class="stat-icon">🔌</div>
                    <div class="stat-info">
                        <div class="stat-value" id="totalPowerOn">0</div>
                        <div class="stat-label">전원 켜짐</div>
                    </div>
                </div>
                
                <div class="power-stat-card">
                    <div class="stat-icon">⚡</div>
                    <div class="stat-info">
                        <div class="stat-value" id="totalPowerOff">0</div>
                        <div class="stat-label">전원 꺼짐</div>
                    </div>
                </div>
                
                <div class="power-stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-info">
                        <div class="stat-value" id="estimatedSavings">0</div>
                        <div class="stat-label">예상 절약 (원/월)</div>
                    </div>
                </div>
                
                <div class="power-stat-card">
                    <div class="stat-icon">🌱</div>
                    <div class="stat-info">
                        <div class="stat-value" id="carbonReduction">0</div>
                        <div class="stat-label">CO₂ 절약 (kg/월)</div>
                    </div>
                </div>
            </div>
            
            <div class="power-timeline">
                <h3>오늘의 전력 사용 타임라인</h3>
                <div class="timeline-container" id="powerTimeline">
                    <!-- 타임라인 차트 -->
                </div>
            </div>
            
            <div class="schedule-status">
                <h3>활성 스케줄</h3>
                <div class="schedule-list" id="activeSchedules">
                    <!-- 활성 스케줄 목록 -->
                </div>
            </div>
        </div>
    `;
}

function updatePowerDashboard() {
    // 실시간 전력 통계 업데이트
    const powerOnCount = document.querySelectorAll('.client-item.online, .client-item.running').length;
    const powerOffCount = document.querySelectorAll('.client-item.offline').length;
    
    document.getElementById('totalPowerOn').textContent = powerOnCount;
    document.getElementById('totalPowerOff').textContent = powerOffCount;
    
    // 예상 전력 절약 계산 (PC당 300W 가정)
    const dailySavings = powerOffCount * 300 * 24 / 1000; // kWh
    const monthlySavings = dailySavings * 30 * 150; // 원 (kWh당 150원 가정)
    document.getElementById('estimatedSavings').textContent = Math.round(monthlySavings).toLocaleString();
    
    // CO2 절약량 계산 (kWh당 0.5kg CO2 가정)
    const carbonReduction = dailySavings * 30 * 0.5;
    document.getElementById('carbonReduction').textContent = carbonReduction.toFixed(1);
}

// 전력 사용 타임라인 차트
function createPowerTimeline() {
    const timelineData = generateTimelineData();
    
    const timeline = document.getElementById('powerTimeline');
    timeline.innerHTML = '';
    
    timelineData.forEach((data, hour) => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        timelineItem.innerHTML = `
            <div class="timeline-time">${hour}:00</div>
            <div class="timeline-bar">
                <div class="timeline-power-on" style="width: ${data.onPercentage}%"></div>
            </div>
            <div class="timeline-count">${data.onCount}/${data.total}</div>
        `;
        timeline.appendChild(timelineItem);
    });
}
```

---

## 🔧 6. 성능 최적화 및 안정성

### 6.1 전력 부하 분산

```javascript
// 순차 부팅으로 전력 부하 분산
class SequentialBootManager {
    constructor(wakeOnLAN, maxConcurrent = 3) {
        this.wol = wakeOnLAN;
        this.maxConcurrent = maxConcurrent;
        this.bootQueue = [];
        this.bootingClients = new Set();
    }
    
    async addToBootQueue(clients) {
        this.bootQueue.push(...clients);
        this.processBootQueue();
    }
    
    async processBootQueue() {
        while (this.bootQueue.length > 0 && this.bootingClients.size < this.maxConcurrent) {
            const client = this.bootQueue.shift();
            this.bootClient(client);
        }
    }
    
    async bootClient(client) {
        this.bootingClients.add(client.id);
        
        try {
            console.log(`🔌 부팅 시작: ${client.name}`);
            
            await this.wol.wake(client.mac_address);
            
            // 부팅 완료 대기 (최대 5분)
            const bootSuccess = await this.waitForBoot(client, 300000);
            
            if (bootSuccess) {
                console.log(`✅ 부팅 완료: ${client.name}`);
            } else {
                console.log(`⚠️ 부팅 타임아웃: ${client.name}`);
            }
            
        } catch (error) {
            console.error(`❌ 부팅 실패: ${client.name}`, error);
        } finally {
            this.bootingClients.delete(client.id);
            
            // 30초 대기 후 다음 클라이언트 부팅
            setTimeout(() => {
                this.processBootQueue();
            }, 30000);
        }
    }
    
    async waitForBoot(client, timeout) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            // ping 체크
            const pingResult = await this.pingClient(client.ip_address);
            if (pingResult) {
                // 클라이언트 연결 대기
                const clientConnected = await this.waitForClientConnection(client, 60000);
                return clientConnected;
            }
            
            await this.sleep(10000); // 10초마다 체크
        }
        
        return false;
    }
}
```

### 6.2 안전한 종료 프로세스

```python
# Python 클라이언트의 안전한 종료
class SafeShutdownManager:
    def __init__(self, switchboard_client):
        self.client = switchboard_client
        self.shutdown_timeout = 300  # 5분
        
    def initiate_safe_shutdown(self, force=False):
        """안전한 종료 프로세스"""
        try:
            if not force:
                # 1. 실행 중인 언리얼엔진 프로세스 정리
                self.stop_unreal_processes()
                
                # 2. 클라이언트 연결 정리
                self.cleanup_connections()
                
                # 3. 임시 파일 정리
                self.cleanup_temp_files()
                
                # 4. 서버에 종료 예정 알림
                self.notify_shutdown_intent()
                
                # 5. 지연 후 종료
                time.sleep(30)
            
            # 시스템 종료 실행
            self.execute_shutdown(force)
            
        except Exception as e:
            print(f"안전한 종료 실패: {e}")
            # 비상시 강제 종료
            self.execute_shutdown(True)
    
    def stop_unreal_processes(self):
        """언리얼엔진 프로세스 정리"""
        unreal_processes = []
        
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                if 'unreal' in proc.info['name'].lower():
                    unreal_processes.append(proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        # 정상 종료 시도
        for proc in unreal_processes:
            try:
                proc.terminate()
                print(f"언리얼엔진 프로세스 종료 요청: PID {proc.pid}")
            except psutil.NoSuchProcess:
                continue
        
        # 10초 대기 후 강제 종료
        time.sleep(10)
        for proc in unreal_processes:
            try:
                if proc.is_running():
                    proc.kill()
                    print(f"언리얼엔진 프로세스 강제 종료: PID {proc.pid}")
            except psutil.NoSuchProcess:
                continue
    
    def cleanup_connections(self):
        """네트워크 연결 정리"""
        try:
            # Socket.io 연결 정리
            if hasattr(self.client, 'sio') and self.client.sio.connected:
                self.client.sio.emit('client_shutdown_notice', {
                    'client_name': self.client.config['client_name'],
                    'reason': 'scheduled_shutdown'
                })
                self.client.sio.disconnect()
            
        except Exception as e:
            print(f"연결 정리 실패: {e}")
    
    def cleanup_temp_files(self):
        """임시 파일 정리"""
        temp_dirs = [
            os.path.expanduser('~/AppData/Local/Temp'),
            'C:/Windows/Temp',
            './logs/temp'
        ]
        
        for temp_dir in temp_dirs:
            if os.path.exists(temp_dir):
                try:
                    # 1일 이상 된 임시 파일 삭제
                    cutoff_time = time.time() - 86400
                    for filename in os.listdir(temp_dir):
                        filepath = os.path.join(temp_dir, filename)
                        if os.path.getmtime(filepath) < cutoff_time:
                            os.remove(filepath)
                except Exception as e:
                    print(f"임시 파일 정리 실패: {e}")
```

---

## 📱 7. 모바일 최적화

### 7.1 모바일 전원 제어 인터페이스

```css
/* 모바일 전원 제어 최적화 */
@media (max-width: 768px) {
    .power-controls {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
    }
    
    .power-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .btn-power {
        width: 100%;
        padding: 12px;
        font-size: 16px;
        min-height: 48px; /* 터치 친화적 */
    }
    
    .power-dashboard {
        padding: 16px;
    }
    
    .power-stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
    
    .power-stat-card {
        padding: 16px;
        text-align: center;
    }
}

/* 터치 제스처 지원 */
.btn-power {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
}

.btn-power:active {
    transform: scale(0.98);
}
```

### 7.2 PWA (Progressive Web App) 지원

```javascript
// manifest.json
{
    "name": "Switchboard Plus v2.1",
    "short_name": "SBPlus",
    "description": "nDisplay 전원 관리 시스템",
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#4c1d95",
    "background_color": "#f8fafc",
    "icons": [
        {
            "src": "/icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "/icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}

// 서비스 워커 등록
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('SW 등록 성공:', registration);
        })
        .catch(error => {
            console.log('SW 등록 실패:', error);
        });
}
```

---

## 🔒 8. 보안 강화

### 8.1 전원 제어 권한 관리

```javascript
// 전원 제어 권한 체크
class PowerControlSecurity {
    constructor() {
        this.powerActions = ['wake', 'reboot', 'shutdown'];
        this.sensitiveActions = ['reboot', 'shutdown'];
    }
    
    checkPermission(action, force = false) {
        // 민감한 작업에 대한 추가 확인
        if (this.sensitiveActions.includes(action)) {
            if (force) {
                return this.requestElevatedPermission(action);
            }
            return this.requestBasicPermission(action);
        }
        
        return true;
    }
    
    requestBasicPermission(action) {
        const confirmMessage = {
            'reboot': '정말 재부팅하시겠습니까? 실행 중인 작업이 중단될 수 있습니다.',
            'shutdown': '정말 종료하시겠습니까? 모든 작업이 중단됩니다.'
        };
        
        return confirm(confirmMessage[action]);
    }
    
    requestElevatedPermission(action) {
        const password = prompt(`강제 ${action}를 위해 관리자 패스워드를 입력하세요:`);
        
        // 실제 구현에서는 서버에서 패스워드 검증
        return this.validateAdminPassword(password);
    }
    
    async validateAdminPassword(password) {
        try {
            const response = await fetch('/api/auth/validate-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            return response.ok;
        } catch (error) {
            console.error('패스워드 검증 실패:', error);
            return false;
        }
    }
}
```

### 8.2 MAC 주소 보안

```javascript
// MAC 주소 암호화 저장
const crypto = require('crypto');

class MACAddressManager {
    constructor(encryptionKey) {
        this.algorithm = 'aes-256-gcm';
        this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
    }
    
    encryptMAC(macAddress) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.algorithm, this.key, iv);
        
        let encrypted = cipher.update(macAddress, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }
    
    decryptMAC(encryptedData) {
        const decipher = crypto.createDecipher(
            this.algorithm, 
            this.key, 
            Buffer.from(encryptedData.iv, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}
```

---

## 📊 9. 모니터링 및 리포팅

### 9.1 전력 사용 리포트

```javascript
// 전력 사용 리포트 생성
class PowerUsageReporter {
    constructor() {
        this.reportTypes = ['daily', 'weekly', 'monthly'];
    }
    
    async generateReport(type, startDate, endDate) {
        const reportData = await this.collectReportData(type, startDate, endDate);
        
        switch (type) {
            case 'daily':
                return this.generateDailyReport(reportData);
            case 'weekly':
                return this.generateWeeklyReport(reportData);
            case 'monthly':
                return this.generateMonthlyReport(reportData);
            default:
                throw new Error(`지원하지 않는 리포트 타입: ${type}`);
        }
    }
    
    async collectReportData(type, startDate, endDate) {
        const powerLogs = await PowerLog.findAll({
            where: {
                timestamp: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: ['client'],
            order: [['timestamp', 'ASC']]
        });
        
        return this.processLogData(powerLogs);
    }
    
    generateDailyReport(data) {
        return {
            summary: {
                totalClients: data.clientCount,
                averageUptime: data.averageUptime,
                powerOnEvents: data.powerOnCount,
                powerOffEvents: data.powerOffCount,
                energySaved: data.energySaved,
                costSaved: data.costSaved
            },
            timeline: data.hourlyTimeline,
            clients: data.clientDetails,
            recommendations: this.generateRecommendations(data)
        };
    }
    
    generateRecommendations(data) {
        const recommendations = [];
        
        // 장시간 켜져있는 클라이언트 감지
        const longRunningClients = data.clientDetails.filter(
            client => client.uptime > 12 * 3600 // 12시간 이상
        );
        
        if (longRunningClients.length > 0) {
            recommendations.push({
                type: 'energy_saving',
                priority: 'medium',
                message: `${longRunningClients.length}대의 클라이언트가 12시간 이상 켜져있습니다. 자동 절전 설정을 검토해보세요.`,
                clients: longRunningClients.map(c => c.name)
            });
        }
        
        // 불필요한 부팅 패턴 감지
        const frequentRebootClients = data.clientDetails.filter(
            client => client.rebootCount > 3
        );
        
        if (frequentRebootClients.length > 0) {
            recommendations.push({
                type: 'stability',
                priority: 'high',
                message: `${frequentRebootClients.length}대의 클라이언트가 자주 재부팅됩니다. 하드웨어 문제를 확인해주세요.`,
                clients: frequentRebootClients.map(c => c.name)
            });
        }
        
        return recommendations;
    }
    
    async exportReportToExcel(reportData, filename) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        
        // 요약 시트
        const summarySheet = workbook.addWorksheet('요약');
        summarySheet.addRow(['항목', '값']);
        summarySheet.addRow(['전체 클라이언트', reportData.summary.totalClients]);
        summarySheet.addRow(['평균 가동시간', `${Math.round(reportData.summary.averageUptime/3600)}시간`]);
        summarySheet.addRow(['전원 켜기 횟수', reportData.summary.powerOnEvents]);
        summarySheet.addRow(['전원 끄기 횟수', reportData.summary.powerOffEvents]);
        summarySheet.addRow(['절약된 전력', `${reportData.summary.energySaved}kWh`]);
        summarySheet.addRow(['절약된 비용', `${reportData.summary.costSaved.toLocaleString()}원`]);
        
        // 클라이언트 상세 시트
        const clientSheet = workbook.addWorksheet('클라이언트 상세');
        clientSheet.addRow(['이름', 'IP 주소', '가동시간', '전원 켜기', '전원 끄기', '재부팅']);
        
        reportData.clients.forEach(client => {
            clientSheet.addRow([
                client.name,
                client.ip_address,
                `${Math.round(client.uptime/3600)}시간`,
                client.powerOnCount,
                client.powerOffCount,
                client.rebootCount
            ]);
        });
        
        // 파일 저장
        await workbook.xlsx.writeFile(filename);
        return filename;
    }
}
```

### 9.2 알림 시스템

```javascript
// 전원 관리 알림
class PowerNotificationManager {
    constructor(socketManager) {
        this.socketManager = socketManager;
        this.notificationRules = new Map();
        this.setupDefaultRules();
    }
    
    setupDefaultRules() {
        // 장시간 가동 알림
        this.addRule('long_running', {
            condition: (client) => client.uptime > 16 * 3600, // 16시간
            message: (client) => `${client.name}이(가) 16시간 이상 가동중입니다. 절전을 검토해보세요.`,
            level: 'warning',
            cooldown: 4 * 3600 // 4시간마다 알림
        });
        
        // 빈번한 재부팅 알림
        this.addRule('frequent_reboot', {
            condition: (client) => client.rebootCount > 5,
            message: (client) => `${client.name}에서 빈번한 재부팅이 감지되었습니다. 하드웨어를 확인해주세요.`,
            level: 'error',
            cooldown: 24 * 3600 // 24시간마다 알림
        });
        
        // 부팅 실패 알림
        this.addRule('boot_failure', {
            condition: (client) => client.lastBootAttempt && !client.lastBootSuccess,
            message: (client) => `${client.name}의 부팅이 실패했습니다. 네트워크 연결을 확인해주세요.`,
            level: 'error',
            cooldown: 1800 // 30분마다 알림
        });
    }
    
    addRule(name, rule) {
        this.notificationRules.set(name, {
            ...rule,
            lastNotified: new Map()
        });
    }
    
    checkNotifications(clients) {
        clients.forEach(client => {
            this.notificationRules.forEach((rule, ruleName) => {
                if (rule.condition(client)) {
                    const lastNotified = rule.lastNotified.get(client.id) || 0;
                    const now = Date.now();
                    
                    if (now - lastNotified > rule.cooldown * 1000) {
                        this.sendNotification({
                            rule: ruleName,
                            client: client,
                            message: rule.message(client),
                            level: rule.level,
                            timestamp: new Date()
                        });
                        
                        rule.lastNotified.set(client.id, now);
                    }
                }
            });
        });
    }
    
    sendNotification(notification) {
        // 웹 클라이언트에 알림 전송
        this.socketManager.broadcast('power_notification', notification);
        
        // 로그 기록
        console.log(`📢 전원 관리 알림: ${notification.message}`);
        
        // 이메일 알림 (설정된 경우)
        if (process.env.EMAIL_NOTIFICATIONS === 'true') {
            this.sendEmailNotification(notification);
        }
    }
    
    async sendEmailNotification(notification) {
        // 이메일 알림 구현 (nodemailer 등 사용)
        // 실제 구현에서는 설정된 관리자 이메일로 발송
    }
}
```

---

## 🎯 10. v2.1 완성 기준

### 10.1 핵심 기능 검증

**전원 제어 기능:**
- [ ] Wake-on-LAN으로 원격 부팅 성공률 95% 이상
- [ ] 안전한 재부팅/종료 100% 성공
- [ ] 순차 부팅으로 전력 부하 분산 동작
- [ ] 강제 제어 옵션 정상 동작

**스케줄링 기능:**
- [ ] 출근/퇴근 시간 자동 제어 정확도 100%
- [ ] 절전 스케줄 정상 동작
- [ ] 예외 상황 (공휴일 등) 적절한 처리

**모니터링 기능:**
- [ ] 실시간 전력 상태 정확한 표시
- [ ] 전력 사용 리포트 생성 가능
- [ ] 알림 시스템 정상 동작

### 10.2 성능 및 안정성

**성능 요구사항:**
- [ ] 100대 클라이언트 동시 전원 제어 가능
- [ ] 부팅 완료 감지 평균 3분 이내
- [ ] 스케줄 실행 정확도 ±5분 이내

**안정성 요구사항:**
- [ ] 1주일 연속 스케줄 운영 무장애
- [ ] 네트워크 장애 시 자동 복구
- [ ] 전원 제어 실패 시 적절한 오류 처리

### 10.3 사용성

**사용자 인터페이스:**
- [ ] 직관적인 전원 제어 버튼 배치
- [ ] 모바일에서 원활한 전원 제어 가능
- [ ] 일괄 작업 진행 상황 명확한 표시

**관리 편의성:**
- [ ] 스케줄 설정 5분 이내 완료
- [ ] 전력 리포트 자동 생성 및 내보내기
- [ ] 장애 상황 즉시 알림

---

## 🔮 11. v2.2 연계 계획

v2.1 완성 후 v2.2에서 확장할 기능들:

**프로젝터 통합 관리:**
- 디스플레이 PC + 프로젝터 연동 전원 제어
- 통합 스케줄링 (PC 부팅 → 프로젝터 켜기 → 입력 소스 설정)
- 프로젝터 상태 모니터링 연동

**고급 전력 관리:**
- 스마트 절전 모드 (사용 패턴 학습)
- 전력 부하 예측 및 최적화
- 탄소 발자국 추적

---

## 📋 12. 마무리

**v2.1의 핵심 가치:**
1. **완전한 전원 관리**: PC 생명주기 전체 제어
2. **에너지 효율성**: 스마트 스케줄링으로 전력 절약
3. **운영 편의성**: 출근 한 번의 클릭으로 모든 시스템 가동
4. **확장성**: v2.2 프로젝터 통합을 위한 기반 구축

**Ready for Power Management!** ⚡