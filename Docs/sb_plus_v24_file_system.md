# Switchboard Plus v2.4 - 파일 전송/관리 시스템

## 📋 1. 개요

**버전**: v2.4  
**목적**: 멀티 Display PC 환경에서 파일 전송, 동기화, 관리 시스템 구축  
**전제 조건**: v2.0-v2.3 완성 (nDisplay 제어, 전원 관리, 프로젝터 제어)  
**개발 기간**: 3-4주  

> 🎯 **핵심 목표**: v2.5 동영상 재생 시스템의 기반 구축 + 독립적인 파일 관리 가치 제공

---

## 🎯 2. 핵심 기능

### 2.1 파일 전송 시스템
```
📤 업로드 (서버 → 클라이언트)
├── 단일 파일 전송
├── 폴더 전체 전송  
├── 선택적 전송 (특정 클라이언트만)
└── 일괄 전송 (모든 클라이언트)

📥 다운로드 (클라이언트 → 서버)
├── 로그 파일 수집
├── 스크린샷 수집
├── 설정 파일 백업
└── 에러 리포트 수집
```

### 2.2 파일 동기화 시스템
```
🔄 실시간 동기화
├── 특정 폴더 모니터링
├── 파일 변경 감지
├── 자동 동기화 실행
└── 충돌 해결 전략

📋 동기화 프로필
├── 미디어 폴더 동기화
├── 설정 파일 동기화
├── 언리얼 프로젝트 동기화
└── 사용자 정의 프로필
```

### 2.3 파일 관리 시스템
```
📁 중앙 관리
├── 파일 목록 조회
├── 디스크 사용량 모니터링
├── 파일 검색 및 필터링
└── 중복 파일 관리

🗂️ 버전 관리
├── 파일 버전 추적
├── 롤백 기능
├── 변경 이력 조회
└── 백업 관리
```

---

## 🏗️ 3. 기술 아키텍처

### 3.1 전송 프로토콜 설계

#### 3.1.1 프로토콜 선택
```javascript
// HTTP 멀티파트 (기본)
POST /api/files/upload
Content-Type: multipart/form-data

// 대용량 파일용 청크 전송
POST /api/files/upload/chunk
{
  "fileId": "uuid",
  "chunkIndex": 0,
  "totalChunks": 100,
  "data": "base64_chunk_data"
}

// 실시간 진행률 (WebSocket)
{
  "type": "file_transfer_progress", 
  "fileId": "uuid",
  "progress": 65.5,
  "speed": "2.3 MB/s",
  "eta": "00:02:15"
}
```

#### 3.1.2 전송 최적화
```javascript
// 병렬 전송 관리
class TransferManager {
  constructor() {
    this.maxConcurrentTransfers = 3;  // 동시 전송 수 제한
    this.chunkSize = 1024 * 1024;     // 1MB 청크
    this.retryAttempts = 3;           // 실패 시 재시도
  }
  
  async transferFile(file, targets) {
    // 1. 파일 해시 계산 (중복 전송 방지)
    const fileHash = await this.calculateHash(file);
    
    // 2. 대상 클라이언트에서 파일 존재 여부 확인
    const missingTargets = await this.checkFileExists(fileHash, targets);
    
    // 3. 필요한 클라이언트에만 전송
    return await this.parallelTransfer(file, missingTargets);
  }
}
```

### 3.2 데이터베이스 설계

#### 3.2.1 파일 추적 테이블
```sql
-- 파일 메타데이터
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    filename VARCHAR(255),
    filepath VARCHAR(500),
    filesize BIGINT,
    file_hash VARCHAR(64),        -- SHA-256 해시
    mime_type VARCHAR(100),
    created_at DATETIME,
    updated_at DATETIME
);

-- 파일 분산 상태
CREATE TABLE file_distribution (
    id INTEGER PRIMARY KEY,
    file_id INTEGER,
    client_id INTEGER,
    local_path VARCHAR(500),
    status VARCHAR(20),           -- 'synced', 'pending', 'error'
    last_sync DATETIME,
    version INTEGER DEFAULT 1,
    FOREIGN KEY (file_id) REFERENCES files(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- 전송 작업 큐
CREATE TABLE transfer_jobs (
    id INTEGER PRIMARY KEY,
    job_type VARCHAR(20),         -- 'upload', 'download', 'sync'
    file_id INTEGER,
    source_client_id INTEGER,
    target_client_ids JSON,      -- 대상 클라이언트 배열
    priority INTEGER DEFAULT 5,
    status VARCHAR(20),          -- 'pending', 'running', 'completed', 'failed'
    progress DECIMAL(5,2),
    error_message TEXT,
    created_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (file_id) REFERENCES files(id)
);
```

#### 3.2.2 동기화 프로필 테이블
```sql
-- 동기화 프로필
CREATE TABLE sync_profiles (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100),
    description TEXT,
    source_path VARCHAR(500),    -- 소스 폴더 경로
    target_path VARCHAR(500),    -- 대상 폴더 경로  
    sync_mode VARCHAR(20),       -- 'mirror', 'backup', 'bidirectional'
    auto_sync BOOLEAN DEFAULT false,
    file_filters JSON,           -- 파일 필터 조건
    exclude_patterns JSON,       -- 제외할 패턴들
    client_groups JSON,          -- 적용할 클라이언트 그룹
    schedule_cron VARCHAR(50),   -- 스케줄 (cron 표현식)
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME
);

-- 동기화 이력
CREATE TABLE sync_history (
    id INTEGER PRIMARY KEY,
    profile_id INTEGER,
    files_added INTEGER,
    files_updated INTEGER,
    files_deleted INTEGER,
    total_size BIGINT,
    duration_seconds INTEGER,
    status VARCHAR(20),
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (profile_id) REFERENCES sync_profiles(id)
);
```

### 3.3 클라이언트 확장

#### 3.3.1 Python 클라이언트 파일 모듈
```python
# client/file_manager.py
import os
import hashlib
import requests
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class FileManager:
    def __init__(self, config):
        self.config = config
        self.server_url = config['server_url']
        self.base_path = config.get('file_base_path', './files')
        self.temp_path = config.get('temp_path', './temp')
        
    async def download_file(self, file_info, target_path):
        """서버에서 파일 다운로드"""
        file_id = file_info['id']
        url = f"{self.server_url}/api/files/{file_id}/download"
        
        with requests.get(url, stream=True) as response:
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            
            with open(target_path, 'wb') as file:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        file.write(chunk)
                        downloaded += len(chunk)
                        
                        # 진행률 보고
                        progress = (downloaded / total_size) * 100
                        await self.report_progress(file_id, progress)
    
    async def upload_file(self, local_path, remote_path):
        """서버로 파일 업로드"""
        file_hash = self.calculate_file_hash(local_path)
        
        # 서버에 이미 있는지 확인
        if await self.file_exists_on_server(file_hash):
            return await self.register_existing_file(file_hash, remote_path)
        
        # 청크 단위로 업로드
        return await self.upload_in_chunks(local_path, remote_path)
    
    def calculate_file_hash(self, filepath):
        """파일 SHA-256 해시 계산"""
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

class SyncManager:
    def __init__(self, file_manager):
        self.file_manager = file_manager
        self.observers = {}
        
    def start_folder_watch(self, folder_path, profile_config):
        """폴더 변경 감지 시작"""
        event_handler = SyncEventHandler(self.file_manager, profile_config)
        observer = Observer()
        observer.schedule(event_handler, folder_path, recursive=True)
        observer.start()
        
        self.observers[folder_path] = observer
        
    def stop_folder_watch(self, folder_path):
        """폴더 변경 감지 중단"""
        if folder_path in self.observers:
            self.observers[folder_path].stop()
            del self.observers[folder_path]

class SyncEventHandler(FileSystemEventHandler):
    def __init__(self, file_manager, profile_config):
        self.file_manager = file_manager
        self.profile_config = profile_config
        
    def on_modified(self, event):
        if not event.is_directory:
            # 파일 변경 감지 시 서버에 동기화 요청
            asyncio.create_task(
                self.file_manager.sync_file(event.src_path, self.profile_config)
            )
```

---

## 🎨 4. UI/UX 설계

### 4.1 파일 관리 대시보드

#### 4.1.1 메인 화면 구성
```jsx
// FileManagerDashboard.jsx
function FileManagerDashboard() {
  return (
    <Container>
      <Grid container spacing={3}>
        
        {/* 파일 업로드 영역 */}
        <Grid item xs={12}>
          <FileUploadZone 
            onFilesSelected={handleFileUpload}
            maxSize="500MB"
            acceptedTypes={['.mp4', '.jpg', '.png', '.pdf', '.zip']}
          />
        </Grid>
        
        {/* 전송 상태 모니터링 */}
        <Grid item xs={12} md={8}>
          <TransferStatusPanel />
        </Grid>
        
        {/* 디스크 사용량 */}
        <Grid item xs={12} md={4}>
          <DiskUsagePanel />
        </Grid>
        
        {/* 파일 브라우저 */}
        <Grid item xs={12}>
          <FileBrowser />
        </Grid>
        
      </Grid>
    </Container>
  );
}
```

#### 4.1.2 파일 업로드 컴포넌트
```jsx
// FileUploadZone.jsx
function FileUploadZone({ onFilesSelected, maxSize, acceptedTypes }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState([]);
  
  const handleDrop = (files) => {
    const validFiles = files.filter(file => 
      acceptedTypes.includes(path.extname(file.name).toLowerCase())
    );
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles, selectedTargets);
    }
  };
  
  return (
    <Paper sx={{ p: 3, border: isDragOver ? '2px dashed #1976d2' : '2px dashed #ccc' }}>
      <Box textAlign="center">
        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6">파일을 드래그하거나 클릭하여 업로드</Typography>
        <Typography variant="body2" color="text.secondary">
          지원 형식: {acceptedTypes.join(', ')} | 최대 크기: {maxSize}
        </Typography>
        
        {/* 대상 클라이언트 선택 */}
        <Box mt={2}>
          <ClientSelector 
            selected={selectedTargets}
            onChange={setSelectedTargets}
            label="전송 대상 선택"
          />
        </Box>
        
        <input
          type="file"
          multiple
          hidden
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleDrop(Array.from(e.target.files))}
        />
      </Box>
    </Paper>
  );
}
```

### 4.2 전송 상태 모니터링

#### 4.2.1 실시간 진행률 표시
```jsx
// TransferStatusPanel.jsx
function TransferStatusPanel() {
  const [activeTransfers, setActiveTransfers] = useState([]);
  const [completedTransfers, setCompletedTransfers] = useState([]);
  
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        파일 전송 상태
      </Typography>
      
      {/* 진행 중인 전송 */}
      {activeTransfers.map(transfer => (
        <TransferItem 
          key={transfer.id}
          transfer={transfer}
          type="active"
        />
      ))}
      
      {/* 완료된 전송 */}
      <Accordion>
        <AccordionSummary>
          <Typography>완료된 전송 ({completedTransfers.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {completedTransfers.map(transfer => (
            <TransferItem 
              key={transfer.id}
              transfer={transfer}
              type="completed"
            />
          ))}
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}

// TransferItem.jsx
function TransferItem({ transfer, type }) {
  return (
    <Box sx={{ mb: 2, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="subtitle2">{transfer.filename}</Typography>
          <Typography variant="caption" color="text.secondary">
            {transfer.targets.join(', ')} ({transfer.fileSize})
          </Typography>
        </Box>
        
        {type === 'active' && (
          <Box>
            <CircularProgress 
              variant="determinate" 
              value={transfer.progress} 
              size={24}
            />
            <Typography variant="caption" sx={{ ml: 1 }}>
              {transfer.progress.toFixed(1)}%
            </Typography>
          </Box>
        )}
        
        {type === 'completed' && (
          <Chip 
            label={transfer.status} 
            color={transfer.status === 'success' ? 'success' : 'error'}
            size="small"
          />
        )}
      </Box>
      
      {type === 'active' && (
        <Box mt={1}>
          <LinearProgress 
            variant="determinate" 
            value={transfer.progress} 
          />
          <Typography variant="caption" color="text.secondary">
            {transfer.speed} • ETA: {transfer.eta}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
```

### 4.3 동기화 프로필 관리

#### 4.3.1 프로필 설정 화면
```jsx
// SyncProfileModal.jsx
function SyncProfileModal({ open, profile, onSave, onClose }) {
  const [formData, setFormData] = useState(profile || {
    name: '',
    sourcePath: '',
    targetPath: '',
    syncMode: 'mirror',
    autoSync: false,
    fileFilters: [],
    excludePatterns: [],
    clientGroups: [],
    scheduleCron: ''
  });
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {profile ? '동기화 프로필 편집' : '새 동기화 프로필'}
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={2}>
          
          {/* 기본 정보 */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="프로필 이름"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>동기화 모드</InputLabel>
              <Select
                value={formData.syncMode}
                onChange={(e) => setFormData({...formData, syncMode: e.target.value})}
              >
                <MenuItem value="mirror">미러링 (덮어쓰기)</MenuItem>
                <MenuItem value="backup">백업 (추가만)</MenuItem>
                <MenuItem value="bidirectional">양방향 동기화</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {/* 경로 설정 */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="소스 경로"
              value={formData.sourcePath}
              onChange={(e) => setFormData({...formData, sourcePath: e.target.value})}
              placeholder="C:/Source/Media"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="대상 경로"
              value={formData.targetPath}
              onChange={(e) => setFormData({...formData, targetPath: e.target.value})}
              placeholder="C:/SwitchboardMedia"
            />
          </Grid>
          
          {/* 대상 클라이언트 */}
          <Grid item xs={12}>
            <ClientGroupSelector
              selected={formData.clientGroups}
              onChange={(groups) => setFormData({...formData, clientGroups: groups})}
              label="동기화 대상"
            />
          </Grid>
          
          {/* 파일 필터 */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="포함할 파일 패턴"
              value={formData.fileFilters.join(', ')}
              onChange={(e) => setFormData({
                ...formData, 
                fileFilters: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="*.mp4, *.jpg, *.png"
              helperText="쉼표로 구분하여 입력"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="제외할 파일 패턴"
              value={formData.excludePatterns.join(', ')}
              onChange={(e) => setFormData({
                ...formData, 
                excludePatterns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="*.tmp, *.log, temp/*"
              helperText="쉼표로 구분하여 입력"
            />
          </Grid>
          
          {/* 자동 동기화 설정 */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.autoSync}
                  onChange={(e) => setFormData({...formData, autoSync: e.target.checked})}
                />
              }
              label="자동 동기화 활성화"
            />
          </Grid>
          
          {formData.autoSync && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="스케줄 (Cron 표현식)"
                value={formData.scheduleCron}
                onChange={(e) => setFormData({...formData, scheduleCron: e.target.value})}
                placeholder="0 */1 * * * (매시간)"
                helperText="Cron 표현식으로 스케줄 설정"
              />
            </Grid>
          )}
          
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={() => onSave(formData)} variant="contained">
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

---

## 🔧 5. API 설계

### 5.1 파일 전송 API

```javascript
// 파일 업로드
POST /api/files/upload
Content-Type: multipart/form-data
Body: {
  files: [File1, File2...],
  targets: ["client1", "client2"],
  targetPath: "/media/videos",
  overwrite: true
}

// 청크 업로드 (대용량 파일)
POST /api/files/upload/chunk
Body: {
  fileId: "uuid",
  chunkIndex: 0,
  totalChunks: 100,
  chunkData: "base64_data"
}

// 파일 다운로드
GET /api/files/{fileId}/download?client={clientId}

// 파일 목록 조회
GET /api/files?path={path}&client={clientId}&type={fileType}

// 파일 삭제
DELETE /api/files/{fileId}?targets=["client1","client2"]

// 파일 이동/복사
POST /api/files/{fileId}/copy
Body: {
  targetPath: "/new/path",
  clients: ["client1", "client2"],
  operation: "copy" // or "move"
}
```

### 5.2 동기화 API

```javascript
// 동기화 프로필 생성
POST /api/sync/profiles
Body: {
  name: "Media Sync",
  sourcePath: "/source/media",
  targetPath: "/target/media", 
  syncMode: "mirror",
  autoSync: true,
  fileFilters: ["*.mp4", "*.jpg"],
  excludePatterns: ["*.tmp"],
  clientGroups: ["group1"],
  scheduleCron: "0 */1 * * *"
}

// 동기화 실행
POST /api/sync/profiles/{profileId}/execute
Body: {
  dryRun: false,  // true면 시뮬레이션만
  force: false    // 강제 동기화
}

// 동기화 상태 조회
GET /api/sync/profiles/{profileId}/status

// 동기화 이력 조회
GET /api/sync/profiles/{profileId}/history?page=1&limit=10
```

### 5.3 시스템 정보 API

```javascript
// 디스크 사용량 조회
GET /api/system/disk-usage?clients=["client1","client2"]

// 파일 시스템 탐색
GET /api/system/browse?path={path}&client={clientId}

// 네트워크 상태 조회
GET /api/system/network-status
```

---

## 📊 6. 성능 및 보안

### 6.1 성능 최적화

#### 6.1.1 전송 최적화
```javascript
// 중복 제거 (Deduplication)
class DeduplicationManager {
  async checkDuplicates(fileHash, targets) {
    // 이미 같은 파일을 가진 클라이언트 찾기
    const existingClients = await this.findClientsWithFile(fileHash);
    
    // 전송 불필요한 대상 제거
    const uniqueTargets = targets.filter(t => !existingClients.includes(t));
    
    return uniqueTargets;
  }
}

// 대역폭 제한
class BandwidthManager {
  constructor() {
    this.maxBandwidth = 100 * 1024 * 1024; // 100MB/s
    this.activeTransfers = new Map();
  }
  
  async throttleTransfer(transferId, data) {
    const currentUsage = this.getCurrentBandwidthUsage();
    
    if (currentUsage > this.maxBandwidth * 0.8) {
      // 80% 이상 사용 시 대기
      await this.waitForBandwidth();
    }
    
    return data;
  }
}
```

#### 6.1.2 캐싱 전략
```javascript
// 파일 메타데이터 캐싱
class FileCache {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5분
  }
  
  async getFileInfo(clientId, filepath) {
    const cacheKey = `${clientId}:${filepath}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const fileInfo = await this.fetchFileInfo(clientId, filepath);
    this.cache.set(cacheKey, {
      data: fileInfo,
      timestamp: Date.now()
    });
    
    return fileInfo;
  }
}
```

### 6.2 보안 고려사항

#### 6.2.1 파일 업로드 보안
```javascript
// 파일 검증
class FileValidator {
  constructor() {
    this.allowedTypes = ['.mp4', '.jpg', '.png', '.pdf', '.zip'];
    this.maxFileSize = 500 * 1024 * 1024; // 500MB
    this.scanVirusEnabled = true;
  }
  
  async validateFile(file) {
    // 1. 파일 크기 검증
    if (file.size > this.maxFileSize) {
      throw new Error('File too large');
    }
    
    // 2. 파일 형식 검증
    const ext = path.extname(file.name).toLowerCase();
    if (!this.allowedTypes.includes(ext)) {
      throw new Error('File type not allowed');
    }
    
    // 3. MIME 타입 검증 (실제 파일 내용)
    const realMimeType = await this.detectMimeType(file);
    if (!this.isValidMimeType(ext, realMimeType)) {
      throw new Error('File content does not match extension');
    }
    
    // 4. 바이러스 스캔 (선택적)
    if (this.scanVirusEnabled) {
      await this.scanForVirus(file);
    }
    
    return true;
  }
}
```

#### 6.2.2 경로 보안
```javascript
// 경로 검증 (Path Traversal 방지)
class PathValidator {
  constructor() {
    this.allowedBasePaths = [
      '/media',
      '/content',
      '/config',
      '/temp'
    ];
  }
  
  validatePath(requestedPath) {
    // 상위 디렉토리 접근 방지
    const normalizedPath = path.normalize(requestedPath);
    
    if (normalizedPath.includes('..')) {
      throw new Error('Path traversal not allowed');
    }
    
    // 허용된 기본 경로 확인
    const isAllowed = this.allowedBasePaths.some(basePath => 
      normalizedPath.startsWith(basePath)
    );
    
    if (!isAllowed) {
      throw new Error('Access to this path is not allowed');
    }
    
    return normalizedPath;
  }
}
```

---

## 🧪 7. 테스트 전략

### 7.1 성능 테스트

#### 7.1.1 전송 속도 테스트
```javascript
// 전송 성능 측정
class TransferPerformanceTest {
  async testTransferSpeed() {
    const testFiles = [
      { size: '1MB', count: 10 },
      { size: '10MB', count: 5 },
      { size: '100MB', count: 2 },
      { size: '500MB', count: 1 }
    ];
    
    for (const test of testFiles) {
      const startTime = Date.now();
      
      await this.transferTestFiles(test.size, test.count);
      
      const duration = Date.now() - startTime;
      const totalSize = this.calculateTotalSize(test);
      const speed = totalSize / (duration / 1000); // bytes per second
      
      console.log(`${test.size} × ${test.count}: ${this.formatSpeed(speed)}`);
    }
  }
}
```

#### 7.1.2 동시 전송 테스트
```javascript
// 동시 전송 처리 능력 테스트
class ConcurrentTransferTest {
  async testConcurrentTransfers() {
    const concurrentLevels = [1, 3, 5, 10, 20];
    
    for (const level of concurrentLevels) {
      const transfers = Array(level).fill().map(() => 
        this.createTestTransfer()
      );
      
      const startTime = Date.now();
      await Promise.all(transfers);
      const duration = Date.now() - startTime;
      
      console.log(`${level} concurrent transfers: ${duration}ms`);
    }
  }
}
```

### 7.2 신뢰성 테스트

#### 7.2.1 네트워크 장애 시뮬레이션
```javascript
// 네트워크 장애 상황 테스트
class NetworkFailureTest {
  async testNetworkResilience() {
    // 1. 전송 중 연결 끊김
    await this.simulateConnectionDrop();
    
    // 2. 간헐적 네트워크 지연
    await this.simulateNetworkLatency();
    
    // 3. 대역폭 급격한 변화
    await this.simulateBandwidthChange();
    
    // 4. 패킷 손실
    await this.simulatePacketLoss();
  }
}
```

---

## 📅 8. 개발 일정

### Week 1: 기반 구조
- [ ] 데이터베이스 스키마 설계 및 생성
- [ ] 기본 API 엔드포인트 구현
- [ ] 파일 업로드/다운로드 기본 기능
- [ ] 클라이언트 파일 관리 모듈 개발

### Week 2: 핵심 기능
- [ ] 청크 기반 대용량 파일 전송
- [ ] 실시간 진행률 모니터링
- [ ] 파일 중복 제거 시스템
- [ ] 기본 UI 컴포넌트 구현

### Week 3: 동기화 시스템
- [ ] 동기화 프로필 관리
- [ ] 폴더 모니터링 및 자동 동기화
- [ ] 충돌 해결 로직
- [ ] 스케줄링 시스템

### Week 4: 최적화 및 테스트
- [ ] 성능 최적화
- [ ] 보안 강화
- [ ] 종합 테스트
- [ ] 문서화 및 사용자 가이드

---

## 🎯 9. 성공 기준

### 9.1 기능 요구사항
- [ ] 500MB 파일을 10대 클라이언트에 5분 내 전송
- [ ] 전송 중 99% 신뢰성 (재시도 포함)
- [ ] 실시간 진행률 표시 (1초 간격 업데이트)
- [ ] 동시 전송 최대 20개 처리

### 9.2 성능 요구사항  
- [ ] 네트워크 대역폭 효율성 80% 이상
- [ ] 파일 중복 제거로 전송량 50% 절약
- [ ] UI 응답성 3초 이내
- [ ] 메모리 사용량 서버 1GB 이하

### 9.3 사용성 요구사항
- [ ] 드래그 앤 드롭으로 직관적 업로드  
- [ ] 실시간 전송 상태 모니터링
- [ ] 실패 시 자동 재시도 및 에러 알림
- [ ] 동기화 프로필 5분 내 설정 가능

---

## 🔮 10. v2.5 연계 고려사항

### 10.1 미디어 파일 특화 기능
```javascript
// 미디어 파일 메타데이터 추출
class MediaFileProcessor {
  async processMediaFile(file) {
    const metadata = await this.extractMetadata(file);
    
    return {
      ...file,
      duration: metadata.duration,
      resolution: metadata.resolution,
      frameRate: metadata.frameRate,
      bitrate: metadata.bitrate,
      codec: metadata.codec
    };
  }
}
```

### 10.2 동기화 그룹 설정
```javascript
// v2.5에서 사용할 미디어 그룹 프리셋
const mediaGroupPresets = {
  '4K_Content': {
    clients: ['Display_01', 'Display_02', 'Display_03'],
    syncPath: '/media/4k',
    filters: ['*.mp4', '*.mov'],
    autoSync: true
  },
  'Interactive_Media': {
    clients: ['Touch_Display_01', 'Touch_Display_02'], 
    syncPath: '/media/interactive',
    filters: ['*.mp4', '*.jpg', '*.png'],
    autoSync: true
  }
};
```

---

*이 문서는 v2.4 개발 과정에서 지속적으로 업데이트됩니다.*