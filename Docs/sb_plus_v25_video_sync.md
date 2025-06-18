# Switchboard Plus v2.5 - 동영상 재생/동기화 시스템

## 📋 1. 개요

**버전**: v2.5  
**목적**: 멀티 Display PC 환경에서 프레임 단위 정확한 동영상 동기화 재생 시스템 구축  
**전제 조건**: v2.0-v2.4 완성 (nDisplay 제어, 전원 관리, 프로젝터 제어, 파일 전송)  
**개발 기간**: 4-6주  
**난이도**: ⭐⭐⭐⭐⭐ (매우 높음)

> 🎯 **핵심 목표**: 전문 미디어서버 수준의 동기화 정확도로 독립적인 기술 자산 구축

---

## 🎯 2. 핵심 기능

### 2.1 동기화 재생 시스템
```
🎬 Frame-Perfect 동기화
├── ±1 프레임 (16ms@60fps) 이내 정확도
├── 다양한 해상도/프레임률 지원
├── 실시간 동기화 보정
└── 네트워크 지연 자동 보상

⏱️ 정밀 타이밍 제어
├── NTP 기반 시간 동기화
├── 예측적 지연 보상
├── 프레임 단위 시작점 제어
└── 실시간 드리프트 보정
```

### 2.2 미디어 재생 엔진
```
🎥 고성능 재생
├── 하드웨어 가속 디코딩 (GPU)
├── 낮은 지연시간 렌더링
├── 메모리 효율적 버퍼링
└── 다양한 코덱 지원

🔄 재생 제어
├── 정밀한 Seek 기능
├── 가변 재생 속도
├── 구간 반복 재생
└── 실시간 재생 파라미터 조정
```

### 2.3 통합 미디어 관리
```
📁 미디어 라이브러리
├── v2.4 파일 시스템 연동
├── 메타데이터 자동 추출
├── 미디어 프리셋 관리
└── 재생 목록 구성

🎛️ 통합 제어
├── 웹 기반 통합 컨트롤
├── 프로젝터 설정 연동 (v2.2)
├── 시스템 전원 관리 (v2.1)
└── 모바일 원격 제어
```

---

## 🏗️ 3. 동기화 기술 아키텍처

### 3.1 동기화 알고리즘 설계

#### 3.1.1 시간 동기화 계층
```python
# 고정밀 시간 동기화 시스템
class PrecisionTimeSync:
    def __init__(self):
        self.ntp_servers = ['pool.ntp.org', 'time.google.com']
        self.local_offset = 0
        self.drift_rate = 0
        self.last_sync = 0
        
    async def sync_system_time(self):
        """시스템 시간을 NTP 서버와 동기화"""
        offsets = []
        
        for server in self.ntp_servers:
            try:
                offset = await self.query_ntp_server(server)
                offsets.append(offset)
            except Exception as e:
                continue
                
        if offsets:
            # 중앙값 사용으로 이상값 제거
            self.local_offset = statistics.median(offsets)
            self.last_sync = time.time()
            
    def get_precise_time(self):
        """드리프트 보정이 적용된 정밀 시간"""
        current_time = time.time()
        time_since_sync = current_time - self.last_sync
        
        # 드리프트 보정 적용
        drift_correction = self.drift_rate * time_since_sync
        
        return current_time + self.local_offset + drift_correction
    
    async def measure_network_latency(self, target_client):
        """네트워크 지연시간 측정"""
        latencies = []
        
        for _ in range(10):  # 10회 측정
            start = self.get_precise_time()
            await self.ping_client(target_client)
            end = self.get_precise_time()
            
            latencies.append((end - start) / 2)  # RTT의 절반
            
        # 이상값 제거 후 평균
        return statistics.median(latencies)

class SyncEngine:
    def __init__(self):
        self.time_sync = PrecisionTimeSync()
        self.client_latencies = {}
        self.sync_accuracy_target = 0.016  # 16ms (1 frame at 60fps)
        
    async def calculate_start_time(self, clients):
        """모든 클라이언트의 최적 시작 시간 계산"""
        # 1. 모든 클라이언트의 네트워크 지연 측정
        for client in clients:
            self.client_latencies[client.id] = await self.time_sync.measure_network_latency(client)
        
        # 2. 최대 지연시간 클라이언트 기준으로 시작 시간 계산
        max_latency = max(self.client_latencies.values())
        preparation_time = 2.0  # 2초 준비 시간
        
        start_time = self.time_sync.get_precise_time() + max_latency + preparation_time
        
        return start_time
    
    async def send_sync_command(self, client, media_file, start_time):
        """개별 클라이언트에 동기화 명령 전송"""
        client_latency = self.client_latencies[client.id]
        
        # 클라이언트별 지연시간 보정
        adjusted_start_time = start_time - client_latency
        
        command = {
            'type': 'sync_play',
            'media_file': media_file,
            'start_time': adjusted_start_time,
            'frame_rate': self.extract_frame_rate(media_file),
            'sync_id': f"sync_{int(time.time())}"
        }
        
        await self.send_command_to_client(client, command)
```

#### 3.1.2 적응형 동기화 보정
```python
class AdaptiveSyncCorrection:
    def __init__(self):
        self.frame_drift_history = {}
        self.correction_threshold = 0.008  # 8ms
        
    async def monitor_sync_accuracy(self, clients):
        """실시간 동기화 정확도 모니터링"""
        while True:
            sync_status = await self.check_all_clients_sync(clients)
            
            for client_id, status in sync_status.items():
                drift = status['time_drift']
                
                if abs(drift) > self.correction_threshold:
                    await self.apply_correction(client_id, drift)
                    
            await asyncio.sleep(0.1)  # 100ms 간격 체크
    
    async def apply_correction(self, client_id, drift):
        """드리프트 보정 적용"""
        if drift > 0:
            # 클라이언트가 늦음 - 미세한 속도 증가
            correction = {'type': 'speed_adjust', 'rate': 1.001}
        else:
            # 클라이언트가 빠름 - 미세한 속도 감소  
            correction = {'type': 'speed_adjust', 'rate': 0.999}
            
        await self.send_correction_to_client(client_id, correction)
        
        # 보정 이력 기록
        self.frame_drift_history[client_id] = {
            'timestamp': time.time(),
            'drift': drift,
            'correction': correction['rate']
        }
```

### 3.2 미디어 재생 엔진

#### 3.2.1 고성능 재생 클라이언트
```python
# client/media_player.py
import cv2
import numpy as np
from threading import Thread, Event
import time
import queue

class HighPerformanceMediaPlayer:
    def __init__(self):
        self.cap = None
        self.frame_queue = queue.Queue(maxsize=30)  # 30프레임 버퍼
        self.is_playing = False
        self.target_fps = 60
        self.frame_time = 1.0 / self.target_fps
        self.current_frame = 0
        self.sync_event = Event()
        
    async def load_media(self, file_path):
        """미디어 파일 로드 및 분석"""
        self.cap = cv2.VideoCapture(file_path)
        
        if not self.cap.isOpened():
            raise Exception(f"Cannot open video file: {file_path}")
            
        # 비디오 정보 추출
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.frame_time = 1.0 / self.fps
        
        # GPU 가속 설정 (가능한 경우)
        self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('H','2','6','4'))
        
        print(f"Video loaded: {self.total_frames} frames @ {self.fps} fps")
        
    def preload_frames(self):
        """프레임 미리 로드 (버퍼링)"""
        while self.is_playing:
            if self.frame_queue.qsize() < 30:  # 버퍼 공간 있음
                ret, frame = self.cap.read()
                if ret:
                    try:
                        self.frame_queue.put(frame, timeout=0.1)
                    except queue.Full:
                        pass  # 버퍼가 가득 찬 경우 스킵
                else:
                    break  # 비디오 끝
                    
    async def sync_play(self, start_time):
        """동기화된 재생 시작"""
        # 정확한 시작 시간까지 대기
        current_time = time.time()
        wait_time = start_time - current_time
        
        if wait_time > 0:
            print(f"Waiting {wait_time:.3f}s for sync start...")
            await asyncio.sleep(wait_time)
            
        # 재생 시작
        self.is_playing = True
        self.sync_event.set()
        
        # 프레임 로딩 스레드 시작
        preload_thread = Thread(target=self.preload_frames)
        preload_thread.start()
        
        # 정밀한 프레임 출력
        await self.precise_frame_output()
        
    async def precise_frame_output(self):
        """정밀한 프레임 타이밍으로 출력"""
        start_time = time.perf_counter()
        frame_count = 0
        
        while self.is_playing:
            target_time = start_time + (frame_count * self.frame_time)
            current_time = time.perf_counter()
            
            # 다음 프레임 시간까지 대기
            sleep_time = target_time - current_time
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
                
            # 프레임 출력
            if not self.frame_queue.empty():
                frame = self.frame_queue.get()
                self.display_frame(frame)
                frame_count += 1
            else:
                # 버퍼 언더런 - 대기
                await asyncio.sleep(0.001)
                
    def display_frame(self, frame):
        """프레임 화면 출력 (GPU 가속)"""
        # OpenGL 또는 DirectX를 통한 하드웨어 가속 출력
        cv2.imshow('Synchronized Video', frame)
        cv2.waitKey(1)
        
    async def seek_to_time(self, time_seconds):
        """정밀한 시간 위치로 이동"""
        target_frame = int(time_seconds * self.fps)
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        self.current_frame = target_frame
        
        # 프레임 큐 클리어 후 재버퍼링
        while not self.frame_queue.empty():
            self.frame_queue.get()
            
    def get_current_time(self):
        """현재 재생 시간 반환"""
        return self.current_frame / self.fps
        
    def stop(self):
        """재생 중지"""
        self.is_playing = False
        self.sync_event.clear()
        
        if self.cap:
            self.cap.release()
            
        cv2.destroyAllWindows()
```

#### 3.2.2 GPU 가속 최적화
```python
class GPUAcceleratedPlayer:
    def __init__(self):
        self.use_gpu = self.detect_gpu_capability()
        self.decoder = self.init_hardware_decoder()
        
    def detect_gpu_capability(self):
        """GPU 가속 지원 여부 확인"""
        try:
            # NVIDIA GPU 확인
            if self.check_nvidia_gpu():
                return 'nvidia'
            # Intel GPU 확인  
            elif self.check_intel_gpu():
                return 'intel'
            # AMD GPU 확인
            elif self.check_amd_gpu():
                return 'amd'
            else:
                return 'cpu'
        except:
            return 'cpu'
            
    def init_hardware_decoder(self):
        """하드웨어 디코더 초기화"""
        if self.use_gpu == 'nvidia':
            # NVDEC 사용
            return cv2.cudacodec.createVideoReader
        elif self.use_gpu == 'intel':
            # Intel Quick Sync 사용
            return self.init_intel_decoder
        else:
            # CPU 디코딩
            return cv2.VideoCapture
            
    async def decode_frame_gpu(self, frame_data):
        """GPU를 이용한 프레임 디코딩"""
        if self.use_gpu != 'cpu':
            # GPU 메모리에서 직접 디코딩
            gpu_frame = self.decoder.nextFrame()
            cpu_frame = gpu_frame.download()
            return cpu_frame
        else:
            return self.decode_frame_cpu(frame_data)
```

### 3.3 통합 시스템 설계

#### 3.3.1 미디어 세션 관리
```python
class MediaSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.clients = []
        self.media_file = None
        self.sync_engine = SyncEngine()
        self.status = 'idle'  # idle, preparing, playing, paused
        self.start_time = None
        self.current_position = 0
        
    async def add_client(self, client):
        """세션에 클라이언트 추가"""
        await client.prepare_for_session(self.session_id)
        self.clients.append(client)
        
    async def load_media(self, media_file):
        """모든 클라이언트에 미디어 로드"""
        self.media_file = media_file
        
        # v2.4 파일 시스템과 연동하여 파일 존재 확인
        missing_clients = await self.check_media_availability()
        
        if missing_clients:
            # 누락된 클라이언트에 파일 전송
            await self.distribute_media_file(missing_clients)
            
        # 모든 클라이언트에 미디어 로드 명령
        load_tasks = [
            client.load_media(media_file) for client in self.clients
        ]
        await asyncio.gather(*load_tasks)
        
    async def start_synchronized_playback(self):
        """동기화된 재생 시작"""
        if self.status != 'idle':
            raise Exception(f"Cannot start playback in {self.status} state")
            
        self.status = 'preparing'
        
        # 최적 시작 시간 계산
        start_time = await self.sync_engine.calculate_start_time(self.clients)
        self.start_time = start_time
        
        # 모든 클라이언트에 동기화 명령 전송
        sync_tasks = [
            self.sync_engine.send_sync_command(client, self.media_file, start_time)
            for client in self.clients
        ]
        await asyncio.gather(*sync_tasks)
        
        self.status = 'playing'
        
        # 실시간 동기화 모니터링 시작
        asyncio.create_task(self.monitor_synchronization())
        
    async def monitor_synchronization(self):
        """실시간 동기화 상태 모니터링"""
        while self.status == 'playing':
            sync_status = {}
            
            for client in self.clients:
                status = await client.get_playback_status()
                sync_status[client.id] = status
                
            # 동기화 이탈 감지 및 보정
            await self.check_and_correct_sync(sync_status)
            
            await asyncio.sleep(0.1)  # 100ms 간격
            
    async def pause_all(self):
        """모든 클라이언트 일시정지"""
        pause_tasks = [client.pause() for client in self.clients]
        await asyncio.gather(*pause_tasks)
        self.status = 'paused'
        
    async def seek_to_position(self, position_seconds):
        """특정 위치로 이동"""
        seek_tasks = [
            client.seek_to_time(position_seconds) for client in self.clients
        ]
        await asyncio.gather(*seek_tasks)
        self.current_position = position_seconds
```

#### 3.3.2 v2.2 프로젝터 연동
```python
class IntegratedMediaControl:
    def __init__(self):
        self.media_session = None
        self.projector_controller = ProjectorController()  # v2.2
        self.power_manager = PowerManager()  # v2.1
        
    async def start_integrated_session(self, media_file, projector_settings=None):
        """통합 미디어 세션 시작"""
        # 1. 시스템 전원 확인 및 켜기 (v2.1)
        await self.power_manager.ensure_all_clients_powered_on()
        
        # 2. 프로젝터 설정 적용 (v2.2)
        if projector_settings:
            await self.projector_controller.apply_settings(projector_settings)
            
        # 3. 미디어 세션 시작
        self.media_session = MediaSession(f"session_{int(time.time())}")
        await self.media_session.load_media(media_file)
        await self.media_session.start_synchronized_playback()
        
    async def create_media_preset(self, preset_config):
        """미디어 프리셋 생성 (모든 시스템 통합)"""
        return {
            'name': preset_config['name'],
            'media_file': preset_config['media_file'],
            'clients': preset_config['clients'],
            'projector_settings': {
                'brightness': preset_config.get('brightness', 80),
                'contrast': preset_config.get('contrast', 70),
                'input_source': preset_config.get('input_source', 'hdmi1')
            },
            'power_settings': {
                'auto_power_on': True,
                'auto_power_off': preset_config.get('auto_power_off', False)
            },
            'sync_settings': {
                'accuracy_mode': preset_config.get('accuracy_mode', 'high'),
                'buffer_size': preset_config.get('buffer_size', 30)
            }
        }
```

---

## 🎨 4. UI/UX 설계

### 4.1 통합 미디어 제어 대시보드

#### 4.1.1 메인 제어 화면
```jsx
// MediaControlDashboard.jsx
function MediaControlDashboard() {
  const [mediaSession, setMediaSession] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState('idle');
  const [syncAccuracy, setSyncAccuracy] = useState(null);
  
  return (
    <Container maxWidth="xl">
      
      {/* 통합 제어 패널 */}
      <Grid container spacing={3}>
        
        {/* 미디어 라이브러리 */}
        <Grid item xs={12} md={4}>
          <MediaLibraryPanel 
            onMediaSelect={handleMediaSelect}
            fileSystem={fileSystemAPI}  // v2.4 연동
          />
        </Grid>
        
        {/* 재생 제어 */}
        <Grid item xs={12} md={8}>
          <PlaybackControlPanel 
            session={mediaSession}
            status={playbackStatus}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
          />
        </Grid>
        
        {/* 동기화 상태 모니터링 */}
        <Grid item xs={12}>
          <SyncStatusPanel 
            clients={mediaSession?.clients || []}
            accuracy={syncAccuracy}
          />
        </Grid>
        
        {/* 시스템 통합 제어 */}
        <Grid item xs={12}>
          <IntegratedSystemPanel 
            powerManager={powerManager}      // v2.1
            projectorController={projectorController}  // v2.2
          />
        </Grid>
        
      </Grid>
    </Container>
  );
}
```

#### 4.1.2 동기화 상태 시각화
```jsx
// SyncStatusPanel.jsx
function SyncStatusPanel({ clients, accuracy }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        동기화 상태 모니터링
      </Typography>
      
      {/* 전체 동기화 정확도 */}
      <Box mb={3}>
        <Typography variant="subtitle2">
          전체 동기화 정확도
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <LinearProgress 
            variant="determinate" 
            value={accuracy?.overall || 0}
            sx={{ flexGrow: 1, height: 8 }}
            color={accuracy?.overall > 95 ? 'success' : 'warning'}
          />
          <Typography variant="body2" color="text.secondary">
            {accuracy?.overall?.toFixed(1)}%
          </Typography>
        </Box>
      </Box>
      
      {/* 개별 클라이언트 상태 */}
      <Grid container spacing={2}>
        {clients.map(client => (
          <Grid item xs={12} sm={6} md={4} key={client.id}>
            <ClientSyncCard client={client} />
          </Grid>
        ))}
      </Grid>
      
      {/* 실시간 동기화 그래프 */}
      <Box mt={3}>
        <Typography variant="subtitle2" gutterBottom>
          실시간 동기화 드리프트
        </Typography>
        <SyncDriftChart clients={clients} />
      </Box>
    </Paper>
  );
}

// ClientSyncCard.jsx
function ClientSyncCard({ client }) {
  const { status, drift, frameRate, currentTime } = client.syncStatus || {};
  
  const getDriftColor = (drift) => {
    const absDrift = Math.abs(drift || 0);
    if (absDrift < 8) return 'success';      // < 8ms
    if (absDrift < 16) return 'warning';     // < 16ms
    return 'error';                          // >= 16ms
  };
  
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2">{client.name}</Typography>
          <Chip 
            label={status || 'Unknown'} 
            size="small"
            color={status === 'playing' ? 'success' : 'default'}
          />
        </Box>
        
        <Box mb={2}>
          <Typography variant="caption" color="text.secondary">
            시간 드리프트
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              width={8}
              height={8}
              bgcolor={`${getDriftColor(drift)}.main`}
              borderRadius="50%"
            />
            <Typography variant="body2" fontFamily="monospace">
              {drift?.toFixed(2) || '0.00'}ms
            </Typography>
          </Box>
        </Box>
        
        <Typography variant="caption" color="text.secondary" display="block">
          프레임률: {frameRate || 'N/A'} fps
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          재생 시간: {currentTime?.toFixed(2) || '0.00'}s
        </Typography>
      </CardContent>
    </Card>
  );
}
```

#### 4.1.3 재생 제어 패널
```jsx
// PlaybackControlPanel.jsx
function PlaybackControlPanel({ session, status, onPlay, onPause, onSeek }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        재생 제어
      </Typography>
      
      {/* 미디어 정보 */}
      {session?.mediaFile && (
        <Box mb={3}>
          <Typography variant="subtitle1">{session.mediaFile.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {session.mediaFile.resolution} • {session.mediaFile.duration}s • {session.mediaFile.fps} fps
          </Typography>
        </Box>
      )}
      
      {/* 재생 진행률 */}
      <Box mb={3}>
        <Slider
          value={currentTime}
          max={duration}
          onChange={(_, value) => onSeek(value)}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value.toFixed(1)}s`}
          sx={{ mb: 1 }}
        />
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption">{formatTime(currentTime)}</Typography>
          <Typography variant="caption">{formatTime(duration)}</Typography>
        </Box>
      </Box>
      
      {/* 재생 버튼 */}
      <Box display="flex" gap={1} mb={3}>
        <IconButton 
          onClick={onPlay}
          disabled={status === 'playing'}
          color="primary"
          size="large"
        >
          <PlayArrowIcon />
        </IconButton>
        
        <IconButton 
          onClick={onPause}
          disabled={status !== 'playing'}
          size="large"
        >
          <PauseIcon />
        </IconButton>
        
        <IconButton 
          onClick={() => onSeek(0)}
          size="large"
        >
          <StopIcon />
        </IconButton>
        
        <Box flexGrow={1} />
        
        {/* 볼륨 제어 */}
        <Box display="flex" alignItems="center" gap={1} width={120}>
          <VolumeUpIcon />
          <Slider
            value={volume}
            onChange={(_, value) => setVolume(value)}
            size="small"
          />
        </Box>
      </Box>
      
      {/* 고급 제어 */}
      <Accordion>
        <AccordionSummary>
          <Typography variant="subtitle2">고급 제어</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>동기화 정확도</InputLabel>
                <Select defaultValue="high">
                  <MenuItem value="high">높음 (±8ms)</MenuItem>
                  <MenuItem value="medium">보통 (±16ms)</MenuItem>
                  <MenuItem value="low">낮음 (±33ms)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                size="small"
                label="재생 속도"
                type="number"
                defaultValue="1.0"
                step="0.1"
                inputProps={{ min: 0.1, max: 2.0 }}
                fullWidth
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}
```

### 4.2 미디어 프리셋 관리

#### 4.2.1 통합 프리셋 에디터
```jsx
// IntegratedPresetEditor.jsx
function IntegratedPresetEditor({ preset, onSave, onClose }) {
  const [presetData, setPresetData] = useState(preset || {
    name: '',
    mediaFile: null,
    clients: [],
    projectorSettings: {},
    powerSettings: {},
    syncSettings: {}
  });
  
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>통합 미디어 프리셋</DialogTitle>
      
      <DialogContent>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tab label="기본 설정" />
          <Tab label="클라이언트" />
          <Tab label="프로젝터" />
          <Tab label="동기화" />
        </Tabs>
        
        {/* 기본 설정 탭 */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="프리셋 이름"
                value={presetData.name}
                onChange={(e) => updatePresetData('name', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12}>
              <MediaFilePicker 
                selected={presetData.mediaFile}
                onChange={(file) => updatePresetData('mediaFile', file)}
                fileSystem={fileSystemAPI}  // v2.4 연동
              />
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* 클라이언트 선택 탭 */}
        <TabPanel value={activeTab} index={1}>
          <ClientSelector
            selected={presetData.clients}
            onChange={(clients) => updatePresetData('clients', clients)}
            showSyncGroups
          />
        </TabPanel>
        
        {/* 프로젝터 설정 탭 (v2.2 연동) */}
        <TabPanel value={activeTab} index={2}>
          <ProjectorSettingsPanel 
            settings={presetData.projectorSettings}
            onChange={(settings) => updatePresetData('projectorSettings', settings)}
          />
        </TabPanel>
        
        {/* 동기화 설정 탭 */}
        <TabPanel value={activeTab} index={3}>
          <SyncSettingsPanel
            settings={presetData.syncSettings}
            onChange={(settings) => updatePresetData('syncSettings', settings)}
          />
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={() => onSave(presetData)} variant="contained">
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

---

## 🔧 5. API 설계

### 5.1 미디어 세션 API

```javascript
// 미디어 세션 생성
POST /api/media/sessions
Body: {
  name: "Corporate Presentation",
  clients: ["client1", "client2", "client3"],
  settings: {
    syncAccuracy: "high",
    bufferSize: 30,
    autoRetry: true
  }
}

// 미디어 로드
POST /api/media/sessions/{sessionId}/load
Body: {
  mediaFile: "/media/presentation.mp4",
  preloadOnly: false
}

// 동기화 재생 시작  
POST /api/media/sessions/{sessionId}/play
Body: {
  startTime: "2024-01-15T14:30:05.000Z",  // 특정 시간 또는 null (즉시)
  position: 0  // 시작 위치 (초)
}

// 재생 제어
POST /api/media/sessions/{sessionId}/pause
POST /api/media/sessions/{sessionId}/resume  
POST /api/media/sessions/{sessionId}/stop
POST /api/media/sessions/{sessionId}/seek
Body: { position: 120.5 }  // 초 단위

// 재생 상태 조회
GET /api/media/sessions/{sessionId}/status
Response: {
  status: "playing",
  currentTime: 45.23,
  duration: 300.0,
  clients: [
    {
      id: "client1",
      status: "playing", 
      currentTime: 45.25,
      drift: 0.02,  // ms
      frameRate: 60
    }
  ],
  syncAccuracy: 98.5
}
```

### 5.2 동기화 엔진 API

```javascript
// 동기화 정확도 측정
POST /api/sync/measure-latency
Body: {
  clients: ["client1", "client2", "client3"],
  iterations: 10
}

// 동기화 보정 적용
POST /api/sync/apply-correction
Body: {
  sessionId: "session123",
  corrections: [
    { clientId: "client1", type: "speed_adjust", value: 1.001 },
    { clientId: "client2", type: "frame_skip", value: 1 }
  ]
}

// 동기화 설정 조정
PUT /api/sync/settings
Body: {
  accuracyTarget: 8,  // ms
  correctionThreshold: 16,  // ms
  monitoringInterval: 100,  // ms
  adaptiveCorrection: true
}
```

### 5.3 통합 프리셋 API

```javascript
// 통합 프리셋 생성
POST /api/presets/integrated
Body: {
  name: "Morning Presentation",
  type: "media",
  mediaSettings: {
    file: "/media/morning_brief.mp4",
    clients: ["display1", "display2"],
    syncAccuracy: "high"
  },
  projectorSettings: {  // v2.2 연동
    brightness: 85,
    contrast: 75,
    inputSource: "hdmi1"
  },
  powerSettings: {  // v2.1 연동
    autoWakeClients: true,
    autoWakeProjectors: true
  }
}

// 통합 프리셋 실행
POST /api/presets/integrated/{presetId}/execute
Body: {
  scheduledTime: "2024-01-15T09:00:00Z",  // 예약 실행
  warmupTime: 30  // 시작 전 준비 시간 (초)
}
```

---

## 📊 6. 성능 최적화

### 6.1 메모리 최적화

#### 6.1.1 스마트 버퍼링
```python
class SmartBufferManager:
    def __init__(self):
        self.buffer_size_base = 30  # 기본 30프레임
        self.memory_threshold = 0.8  # 80% 메모리 사용 시 조정
        self.current_buffer_size = self.buffer_size_base
        
    def adjust_buffer_size(self):
        """시스템 메모리 상황에 따른 버퍼 크기 조정"""
        memory_usage = psutil.virtual_memory().percent / 100
        
        if memory_usage > self.memory_threshold:
            # 메모리 부족 시 버퍼 크기 감소
            self.current_buffer_size = max(10, self.current_buffer_size - 5)
        elif memory_usage < 0.5:
            # 메모리 여유 시 버퍼 크기 증가
            self.current_buffer_size = min(60, self.current_buffer_size + 5)
            
    def optimize_frame_format(self, frame):
        """프레임 데이터 최적화"""
        # 불필요한 색상 채널 제거 (필요에 따라)
        # 압축 적용 (메모리 절약)
        # GPU 메모리 사용 (가능한 경우)
        return optimized_frame
```

#### 6.1.2 프레임 예측 로딩
```python
class PredictiveFrameLoader:
    def __init__(self):
        self.seek_history = []
        self.prediction_enabled = True
        
    def predict_next_access(self, current_position):
        """사용자 패턴 기반 다음 액세스 예측"""
        if len(self.seek_history) < 3:
            return None
            
        # 최근 패턴 분석
        recent_seeks = self.seek_history[-5:]
        
        # 순차 재생인지 점프인지 판단
        if self.is_sequential_playback(recent_seeks):
            return current_position + 30  # 30초 후 미리 로드
        else:
            return self.predict_jump_target(recent_seeks)
            
    async def preload_predicted_frames(self, predicted_position):
        """예측된 위치의 프레임 미리 로드"""
        if predicted_position:
            await self.load_frames_around_position(predicted_position, range_seconds=5)
```

### 6.2 네트워크 최적화

#### 6.2.1 명령 우선순위 시스템
```python
class PriorityCommandQueue:
    def __init__(self):
        self.queues = {
            'critical': queue.PriorityQueue(),    # 동기화 명령
            'normal': queue.PriorityQueue(),      # 일반 제어
            'background': queue.PriorityQueue()   # 상태 업데이트
        }
        
    async def send_command(self, command, priority='normal'):
        """우선순위에 따른 명령 전송"""
        timestamp = time.time()
        
        if command['type'] in ['sync_play', 'sync_pause', 'sync_seek']:
            priority = 'critical'
            
        await self.queues[priority].put((timestamp, command))
        
    async def process_command_queue(self):
        """우선순위 큐 처리"""
        while True:
            # Critical 명령 우선 처리
            if not self.queues['critical'].empty():
                _, command = await self.queues['critical'].get()
                await self.execute_command_immediately(command)
            
            # Normal 명령 처리
            elif not self.queues['normal'].empty():
                _, command = await self.queues['normal'].get()
                await self.execute_command(command)
                
            # Background 명령 처리
            elif not self.queues['background'].empty():
                _, command = await self.queues['background'].get()
                await self.execute_command_with_delay(command)
                
            await asyncio.sleep(0.001)  # 1ms 간격
```

---

## 🧪 7. 테스트 및 검증

### 7.1 동기화 정확도 테스트

#### 7.1.1 자동화된 동기화 테스트
```python
class SyncAccuracyTest:
    def __init__(self):
        self.test_video = "sync_test_pattern.mp4"  # 타임코드 포함 테스트 비디오
        self.reference_client = None
        self.accuracy_threshold = 16  # ms
        
    async def run_accuracy_test(self, clients):
        """동기화 정확도 자동 테스트"""
        results = {}
        
        # 테스트 비디오로 세션 시작
        session = await self.create_test_session(clients)
        await session.load_media(self.test_video)
        
        # 여러 시나리오 테스트
        scenarios = [
            {'name': 'normal_playback', 'duration': 60},
            {'name': 'seek_test', 'seeks': [10, 30, 45]},
            {'name': 'pause_resume', 'pauses': [15, 35]},
            {'name': 'network_stress', 'stress_level': 'high'}
        ]
        
        for scenario in scenarios:
            result = await self.test_scenario(session, scenario)
            results[scenario['name']] = result
            
        return self.analyze_results(results)
        
    async def test_scenario(self, session, scenario):
        """개별 시나리오 테스트"""
        if scenario['name'] == 'normal_playback':
            return await self.test_normal_playback(session, scenario['duration'])
        elif scenario['name'] == 'seek_test':
            return await self.test_seek_accuracy(session, scenario['seeks'])
        # ... 다른 시나리오들
        
    async def capture_frame_timestamps(self, clients):
        """각 클라이언트의 실제 프레임 타임스탬프 수집"""
        timestamps = {}
        
        for client in clients:
            # 화면 캡처를 통한 타임코드 읽기
            screenshot = await client.capture_screen()
            timecode = self.extract_timecode_from_image(screenshot)
            timestamps[client.id] = timecode
            
        return timestamps
        
    def calculate_sync_accuracy(self, timestamps):
        """타임스탬프 기반 동기화 정확도 계산"""
        if len(timestamps) < 2:
            return 100.0
            
        timecodes = list(timestamps.values())
        reference = timecodes[0]
        
        drifts = [abs(tc - reference) * 1000 for tc in timecodes[1:]]  # ms 단위
        max_drift = max(drifts) if drifts else 0
        
        # 정확도 계산 (16ms 이하는 100%, 33ms 이상은 0%)
        if max_drift <= 16:
            return 100.0
        elif max_drift >= 33:
            return 0.0
        else:
            return 100.0 - ((max_drift - 16) / 17) * 100
```

#### 7.1.2 성능 벤치마크
```python
class PerformanceBenchmark:
    async def run_full_benchmark(self):
        """전체 성능 벤치마크"""
        results = {}
        
        # 1. 동기화 지연시간 측정
        results['sync_latency'] = await self.measure_sync_latency()
        
        # 2. 프레임 드롭 측정
        results['frame_drops'] = await self.measure_frame_drops()
        
        # 3. 리소스 사용량 측정
        results['resource_usage'] = await self.measure_resource_usage()
        
        # 4. 확장성 테스트
        results['scalability'] = await self.test_scalability()
        
        return results
        
    async def test_scalability(self):
        """클라이언트 수에 따른 확장성 테스트"""
        client_counts = [2, 5, 10, 20, 50]
        scalability_results = {}
        
        for count in client_counts:
            clients = await self.create_test_clients(count)
            
            start_time = time.time()
            success_rate = await self.test_sync_session(clients)
            duration = time.time() - start_time
            
            scalability_results[count] = {
                'setup_time': duration,
                'success_rate': success_rate,
                'max_drift': await self.measure_max_drift(clients)
            }
            
        return scalability_results
```

---

## 📅 8. 개발 일정

### Week 1-2: 기반 기술 개발
- [ ] 고정밀 시간 동기화 시스템 구현
- [ ] 네트워크 지연 측정 및 보상 알고리즘
- [ ] 기본 미디어 재생 엔진 구현
- [ ] GPU 가속 지원 및 최적화

### Week 3: 동기화 엔진 완성
- [ ] 적응형 동기화 보정 시스템
- [ ] 실시간 드리프트 모니터링
- [ ] 다양한 해상도/프레임률 지원
- [ ] 동기화 정확도 자동 테스트 시스템

### Week 4: 통합 시스템 개발
- [ ] v2.1, v2.2, v2.4 시스템과의 통합
- [ ] 통합 미디어 세션 관리
- [ ] 미디어 프리셋 시스템
- [ ] 통합 API 구현

### Week 5: UI/UX 개발
- [ ] 통합 미디어 제어 대시보드
- [ ] 실시간 동기화 상태 시각화
- [ ] 미디어 라이브러리 연동
- [ ] 모바일 원격 제어 인터페이스

### Week 6: 최적화 및 테스트
- [ ] 성능 최적화 (메모리, CPU, 네트워크)
- [ ] 대규모 환경 테스트 (20대 이상)
- [ ] 안정성 테스트 및 에러 처리
- [ ] 종합 벤치마크 및 문서화

---

## 🎯 9. 성공 기준

### 9.1 동기화 정확도
- [ ] **±8ms 이내 동기화 정확도** (60fps 기준 0.5프레임)
- [ ] 10대 클라이언트에서 95% 이상 정확도 유지
- [ ] 네트워크 지연 100ms 환경에서도 정상 동작
- [ ] 1시간 연속 재생 시 드리프트 누적 ±50ms 이내

### 9.2 성능 요구사항
- [ ] 4K 60fps 비디오 동시 재생 (10대)
- [ ] 동기화 명령 전달 지연시간 5ms 이내
- [ ] 메모리 사용량 클라이언트당 1GB 이하
- [ ] CPU 사용량 70% 이하 (재생 중)

### 9.3 시스템 통합성
- [ ] v2.1-v2.4 기능과 완전 연동
- [ ] 통합 프리셋으로 원클릭 실행
- [ ] 프로젝터 설정 자동 적용
- [ ] 전원 관리 자동 연동

### 9.4 사용성
- [ ] 미디어 업로드부터 재생까지 5분 이내
- [ ] 실시간 동기화 상태 직관적 표시
- [ ] 네트워크 문제 시 자동 복구
- [ ] 모바일에서 원격 제어 가능

---

## 🔮 10. 독립 기술화 가능성

### 10.1 SyncEngine SDK 구상
```javascript
// 독립적으로 사용 가능한 동기화 엔진
import { SyncEngine } from 'switchboard-sync-engine';

const engine = new SyncEngine({
  precision: 'frame-perfect',  // 'frame-perfect', 'millisecond', 'second'
  adaptiveCorrection: true,
  maxClients: 50
});

// 다양한 플랫폼에서 사용 가능
await engine.addClient({
  id: 'client1',
  platform: 'windows',  // 'windows', 'linux', 'android', 'ios'
  capabilities: ['video', 'audio', 'lighting']
});

await engine.syncPlay({
  content: 'media.mp4',
  startTime: Date.now() + 5000,
  loops: 3
});
```

### 10.2 시장 확장 가능성

#### 10.2.1 타겟 시장
- **디지털 사이니지**: 연결된 광고 화면 동기화
- **이벤트/전시**: 대형 미디어 월 운영
- **교육**: 멀티스크린 강의 시스템
- **방송**: 스튜디오 배경 화면 동기화
- **게임/VR**: 멀티 디스플레이 게임 환경

#### 10.2.2 기술 라이선싱
- **Basic**: 3대 이하 무료
- **Professional**: 10대 이하 월 구독
- **Enterprise**: 무제한 + 기술지원
- **OEM**: 하드웨어 제조사 라이선스

---

## 🚨 11. 위험 요소 및 대응

### 11.1 기술적 위험
- **동기화 정확도 미달**: 하드웨어 동기화 신호 추가 고려
- **성능 한계**: GPU 클러스터 활용 방안 연구
- **호환성 문제**: 다양한 하드웨어 환경 대응 전략

### 11.2 개발 위험
- **복잡성 증가**: 단계적 개발로 위험 분산
- **통합 문제**: v2.1-v2.4와의 인터페이스 사전 정의
- **테스트 환경**: 실제 멀티 PC 환경 구축 필요

### 11.3 대응 전략
- **프로토타입 우선**: 핵심 동기화 기술 먼저 검증
- **점진적 확장**: 2대 → 5대 → 10대 순차 확장
- **외부 협력**: 전문 미디어 기술 업체와 협력 고려

---

*이 문서는 v2.5 개발 과정에서 기술 검증 결과에 따라 지속적으로 업데이트됩니다.*