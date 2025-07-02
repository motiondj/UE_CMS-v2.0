# 클라이언트-서버 통신 프로토콜 가이드

## 📋 개요

수정된 서버에 맞춰 클라이언트가 어떻게 연결하고 통신해야 하는지 상세한 가이드입니다.

---

## 🔄 1. 전체 연결 흐름 (Connection Flow)

```
[클라이언트 시작]
       ↓
[서버 연결 시도] ←─────────────┐
       ↓                      │
[연결 성공?] ──→ [실패] ──→ [재시도 대기]
       ↓                      ↑
    [성공]                    │
       ↓                      │
[클라이언트 등록]              │
       ↓                      │
[등록 성공?] ──→ [실패] ───────┘
       ↓
    [성공]
       ↓
[하트비트 시작] ←──────────┐
       ↓                   │
[명령 대기/실행]           │
       ↓                   │
[연결 유지] ───────────────┘
       ↓
[연결 끊김 감지] ──→ [재연결 시도]
```

---

## 🔌 2. 초기 연결 및 등록

### 2.1 Socket.IO 연결

```python
import socketio
import time
import threading

class SwitchboardClient:
    def __init__(self, server_url, client_name, client_ip):
        self.server_url = server_url  # "http://192.168.1.100:8000"
        self.client_name = client_name  # "Display_01"
        self.client_ip = client_ip      # "192.168.1.101"
        
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=0,  # 무한 재시도
            reconnection_delay=1,     # 1초 시작
            reconnection_delay_max=30, # 최대 30초
            randomization_factor=0.5
        )
        
        self.is_registered = False
        self.heartbeat_thread = None
        self.should_run = True
        
        self.setup_events()
    
    def setup_events(self):
        """Socket.IO 이벤트 핸들러 설정"""
        
        # 연결 성공
        @self.sio.event
        def connect():
            print(f"✅ 서버에 연결됨: {self.server_url}")
            self.register_client()
        
        # 연결 해제
        @self.sio.event  
        def disconnect():
            print("❌ 서버와 연결이 끊어짐")
            self.is_registered = False
            # 재연결은 자동으로 시도됨
        
        # 등록 성공 응답
        @self.sio.on('registration_success')
        def on_registration_success(data):
            print(f"✅ 클라이언트 등록 성공: {data}")
            self.is_registered = True
            self.start_heartbeat()
        
        # 등록 실패 응답
        @self.sio.on('registration_failed')
        def on_registration_failed(data):
            print(f"❌ 클라이언트 등록 실패: {data}")
            self.is_registered = False
            # 5초 후 재등록 시도
            threading.Timer(5.0, self.register_client).start()
```

### 2.2 클라이언트 등록

```python
def register_client(self):
    """서버에 클라이언트 등록"""
    try:
        registration_data = {
            'name': self.client_name,
            'clientType': 'python',
            'ip_address': self.client_ip,
            'version': '2.0',
            'capabilities': ['unreal_engine', 'file_transfer'],
            'timestamp': time.time()
        }
        
        print(f"📝 클라이언트 등록 요청: {registration_data}")
        self.sio.emit('register_client', registration_data)
        
    except Exception as e:
        print(f"❌ 등록 요청 실패: {e}")
        # 5초 후 재시도
        threading.Timer(5.0, self.register_client).start()
```

---

## 💓 3. 하트비트 시스템

### 3.1 하트비트 전송

```python
def start_heartbeat(self):
    """하트비트 스레드 시작"""
    if self.heartbeat_thread and self.heartbeat_thread.is_alive():
        return
        
    self.heartbeat_thread = threading.Thread(target=self.heartbeat_loop)
    self.heartbeat_thread.daemon = True
    self.heartbeat_thread.start()
    print("💓 하트비트 시작")

def heartbeat_loop(self):
    """하트비트 루프 (30초마다)"""
    while self.should_run:
        try:
            if self.sio.connected and self.is_registered:
                heartbeat_data = {
                    'clientName': self.client_name,
                    'ip_address': self.client_ip,
                    'timestamp': time.time(),
                    'status': 'online',
                    'uptime': time.time() - self.start_time,
                    'process_count': self.get_running_process_count()
                }
                
                print(f"💓 하트비트 전송: {self.client_name}")
                self.sio.emit('heartbeat', heartbeat_data)
            
            time.sleep(30)  # 30초 대기
            
        except Exception as e:
            print(f"❌ 하트비트 전송 실패: {e}")
            time.sleep(10)  # 오류 시 10초 후 재시도
```

### 3.2 하트비트 응답 처리

```python
def setup_heartbeat_events(self):
    """하트비트 관련 이벤트 설정"""
    
    # 하트비트 응답
    @self.sio.on('heartbeat_response')
    def on_heartbeat_response(data):
        if data['status'] == 'ok':
            print(f"💓 하트비트 응답 수신: {data['message']}")
        else:
            print(f"⚠️ 하트비트 오류: {data['message']}")
            if data.get('shouldReconnect'):
                self.reconnect()
    
    # 연결 확인 요청 (서버에서 오는)
    @self.sio.on('connection_check')
    def on_connection_check(data):
        print(f"🔍 서버 연결 확인 요청: {data}")
        
        # 즉시 응답
        response_data = {
            'clientName': self.client_name,
            'timestamp': time.time(),
            'status': 'alive',
            'received_at': data.get('timestamp')
        }
        
        self.sio.emit('connection_check_response', response_data)
        print(f"✅ 연결 확인 응답 전송")
```

---

## 📡 4. 명령 수신 및 실행

### 4.1 명령 수신 이벤트

```python
def setup_command_events(self):
    """명령 수신 이벤트 설정"""
    
    # 프리셋 실행 명령
    @self.sio.on('execute_command')
    def on_execute_command(data):
        print(f"🎬 실행 명령 수신: {data}")
        
        client_name = data.get('clientName')
        command = data.get('command')
        preset_id = data.get('presetId')
        
        if client_name == self.client_name:
            self.execute_command(command, preset_id)
        else:
            print(f"⚠️ 다른 클라이언트용 명령 무시: {client_name}")
    
    # 프리셋 정지 명령
    @self.sio.on('stop_command')
    def on_stop_command(data):
        print(f"⏹️ 정지 명령 수신: {data}")
        
        client_name = data.get('clientName')
        preset_id = data.get('presetId')
        
        if client_name == self.client_name:
            self.stop_processes(preset_id)
        else:
            print(f"⚠️ 다른 클라이언트용 명령 무시: {client_name}")
    
    # 서버 종료 알림
    @self.sio.on('server_shutdown')
    def on_server_shutdown(data):
        print(f"🚨 서버 종료 알림: {data['message']}")
        
        reconnect_after = data.get('reconnectAfter', 5000)
        print(f"⏰ {reconnect_after/1000}초 후 재연결 시도 예정")
        
        # 지정된 시간 후 재연결 시도
        threading.Timer(
            reconnect_after/1000, 
            self.reconnect
        ).start()
```

### 4.2 명령 실행 및 결과 전송

```python
def execute_command(self, command, preset_id=None):
    """명령 실행"""
    try:
        print(f"🚀 명령 실행 시작: {command}")
        
        # 프로세스 시작 알림
        self.send_execution_status('starting', preset_id)
        
        # 실제 명령 실행 (예: 언리얼엔진)
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # 프로세스 등록
        self.running_processes[preset_id] = process
        
        # 실행 성공 알림
        self.send_execution_status('running', preset_id, {
            'pid': process.pid,
            'command': command,
            'start_time': time.time()
        })
        
        print(f"✅ 명령 실행 성공: PID {process.pid}")
        
        # 프로세스 모니터링 시작
        self.monitor_process(process, preset_id)
        
    except Exception as e:
        print(f"❌ 명령 실행 실패: {e}")
        self.send_execution_status('failed', preset_id, {
            'error': str(e)
        })

def send_execution_status(self, status, preset_id=None, details=None):
    """실행 상태를 서버에 전송"""
    try:
        status_data = {
            'clientName': self.client_name,
            'status': status,
            'presetId': preset_id,
            'timestamp': time.time(),
            'details': details or {}
        }
        
        self.sio.emit('execution_result', status_data)
        print(f"📊 실행 상태 전송: {status}")
        
    except Exception as e:
        print(f"❌ 상태 전송 실패: {e}")
```

---

## 🔄 5. 재연결 메커니즘

### 5.1 자동 재연결

```python
def connect_to_server(self):
    """서버 연결 시도"""
    try:
        print(f"🔄 서버 연결 시도: {self.server_url}")
        self.sio.connect(self.server_url)
        return True
        
    except Exception as e:
        print(f"❌ 연결 실패: {e}")
        return False

def reconnect(self):
    """수동 재연결"""
    try:
        if self.sio.connected:
            self.sio.disconnect()
        
        print("🔄 재연결 시도 중...")
        self.is_registered = False
        
        # 재연결
        if self.connect_to_server():
            print("✅ 재연결 성공")
            # 재연결 성공 알림
            self.sio.emit('reconnection_success', {
                'clientName': self.client_name,
                'timestamp': time.time()
            })
        else:
            print("❌ 재연결 실패")
            
    except Exception as e:
        print(f"❌ 재연결 오류: {e}")
```

### 5.2 연결 상태 모니터링

```python
def monitor_connection(self):
    """연결 상태 모니터링 스레드"""
    while self.should_run:
        try:
            if not self.sio.connected:
                print("🔍 연결 끊김 감지 - 재연결 시도")
                self.reconnect()
            
            time.sleep(10)  # 10초마다 체크
            
        except Exception as e:
            print(f"❌ 연결 모니터링 오류: {e}")
            time.sleep(5)
```

---

## 📊 6. 프로세스 상태 보고

### 6.1 주기적 상태 보고

```python
def send_process_status(self):
    """프로세스 상태를 서버에 보고"""
    try:
        running_processes = []
        
        for preset_id, process in self.running_processes.items():
            if process.poll() is None:  # 아직 실행 중
                running_processes.append({
                    'preset_id': preset_id,
                    'pid': process.pid,
                    'uptime': time.time() - process.create_time()
                })
        
        status_data = {
            'clientName': self.client_name,
            'running_process_count': len(running_processes),
            'running_processes': running_processes,
            'status': 'running' if running_processes else 'online',
            'timestamp': time.time()
        }
        
        self.sio.emit('process_status', status_data)
        
    except Exception as e:
        print(f"❌ 프로세스 상태 전송 실패: {e}")

def start_process_monitoring(self):
    """프로세스 모니터링 시작"""
    def monitor_loop():
        while self.should_run:
            try:
                if self.sio.connected and self.is_registered:
                    self.send_process_status()
                
                time.sleep(20)  # 20초마다 상태 보고
                
            except Exception as e:
                print(f"❌ 프로세스 모니터링 오류: {e}")
                time.sleep(10)
    
    threading.Thread(target=monitor_loop, daemon=True).start()
```

---

## 🚨 7. 에러 처리 및 복구

### 7.1 네트워크 오류 처리

```python
def handle_network_error(self, error):
    """네트워크 오류 처리"""
    print(f"🌐 네트워크 오류: {error}")
    
    # 연결 상태 확인
    if not self.sio.connected:
        print("🔄 연결이 끊어짐 - 재연결 시도")
        self.reconnect()
    
    # 심각한 오류는 재시작
    if "timeout" in str(error).lower():
        print("⏰ 타임아웃 오류 - 클라이언트 재시작")
        self.restart_client()

def restart_client(self):
    """클라이언트 재시작"""
    try:
        print("🔄 클라이언트 재시작 중...")
        
        # 모든 프로세스 정리
        self.cleanup_processes()
        
        # 연결 해제
        if self.sio.connected:
            self.sio.disconnect()
        
        # 잠시 대기
        time.sleep(5)
        
        # 재시작
        self.should_run = True
        self.is_registered = False
        self.start()
        
    except Exception as e:
        print(f"❌ 재시작 실패: {e}")
```

---

## 🔧 8. 완전한 클라이언트 구현 예시

### 8.1 메인 클라이언트 클래스

```python
import socketio
import threading
import time
import subprocess
import sys
import signal

class SwitchboardClient:
    def __init__(self, config):
        self.server_url = config['server_url']
        self.client_name = config['client_name'] 
        self.client_ip = config['client_ip']
        
        # Socket.IO 클라이언트 설정
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=0,  # 무한 재시도
            reconnection_delay=1,
            reconnection_delay_max=30,
            randomization_factor=0.5,
            logger=False,
            engineio_logger=False
        )
        
        # 상태 관리
        self.is_registered = False
        self.should_run = True
        self.start_time = time.time()
        self.running_processes = {}
        
        # 스레드 관리
        self.heartbeat_thread = None
        self.monitor_thread = None
        
        self.setup_all_events()
    
    def setup_all_events(self):
        """모든 이벤트 핸들러 설정"""
        # 연결 관련
        self.setup_connection_events()
        # 하트비트 관련  
        self.setup_heartbeat_events()
        # 명령 관련
        self.setup_command_events()
        # 상태 관련
        self.setup_status_events()
    
    def start(self):
        """클라이언트 시작"""
        print(f"🚀 Switchboard Client 시작: {self.client_name}")
        
        # 신호 처리
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # 서버 연결
        self.connect_to_server()
        
        # 모니터링 시작
        self.start_connection_monitoring()
        self.start_process_monitoring()
        
        # 메인 루프
        try:
            while self.should_run:
                time.sleep(1)
        except KeyboardInterrupt:
            self.shutdown()
    
    def shutdown(self):
        """정상 종료"""
        print("🛑 클라이언트 종료 중...")
        self.should_run = False
        
        # 모든 프로세스 정리
        self.cleanup_processes()
        
        # 연결 해제
        if self.sio.connected:
            self.sio.disconnect()
        
        print("✅ 클라이언트 종료 완료")
        sys.exit(0)
    
    def signal_handler(self, signum, frame):
        """시스템 신호 처리"""
        print(f"📡 신호 수신: {signum}")
        self.shutdown()

# 메인 실행
if __name__ == "__main__":
    config = {
        'server_url': 'http://192.168.1.100:8000',
        'client_name': 'Display_01', 
        'client_ip': '192.168.1.101'
    }
    
    client = SwitchboardClient(config)
    client.start()
```

---

## 📋 9. 서버 응답 메시지 형식

### 9.1 등록 응답

```json
// 성공
{
  "clientId": 123,
  "clientName": "Display_01",
  "message": "클라이언트 등록이 완료되었습니다."
}

// 실패  
{
  "reason": "이미 존재하는 클라이언트 이름입니다.",
  "message": "클라이언트 등록에 실패했습니다."
}
```

### 9.2 하트비트 응답

```json
// 성공
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "하트비트 수신 완료",
  "nextHeartbeatIn": 30000
}

// 오류
{
  "status": "error", 
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "하트비트 처리 중 오류 발생",
  "shouldReconnect": true
}
```

### 9.3 명령 메시지

```json
// 실행 명령
{
  "clientName": "Display_01",
  "command": "D:\\UnrealEngine\\MyProject.exe -fullscreen",
  "presetId": 456
}

// 정지 명령
{
  "clientName": "Display_01", 
  "presetId": 456
}
```

---

## ✅ 10. 체크리스트

### 클라이언트 구현시 확인사항

- [ ] Socket.IO 자동 재연결 설정 완료
- [ ] 클라이언트 등록 로직 구현
- [ ] 30초 주기 하트비트 전송
- [ ] 명령 수신 및 실행 로직
- [ ] 프로세스 상태 보고 (20초 주기)
- [ ] 연결 확인 요청에 응답
- [ ] 재연결 메커니즘 구현
- [ ] 에러 처리 및 로깅
- [ ] 정상 종료 처리
- [ ] 서버 종료 알림 처리

이 가이드대로 구현하면 수정된 서버와 완벽하게 통신할 수 있습니다!