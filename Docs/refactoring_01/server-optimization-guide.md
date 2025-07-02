# Switchboard Plus 서버 코드 최적화 - 완전한 구현 가이드

## 📁 새로운 파일 구조

```
server/
├── app.js
├── config/
│   ├── database.js
│   └── server.js
├── db/
│   ├── index.js
│   └── migrations.js
├── models/
│   ├── index.js
│   ├── Client.js
│   ├── Group.js
│   ├── Preset.js
│   └── Execution.js
├── controllers/
│   ├── clientController.js
│   ├── groupController.js
│   ├── presetController.js
│   └── executionController.js
├── services/
│   ├── socketService.js
│   ├── clientService.js
│   └── executionService.js
├── routes/
│   ├── index.js
│   ├── clients.js
│   ├── groups.js
│   ├── presets.js
│   └── executions.js
├── middleware/
│   ├── errorHandler.js
│   └── validation.js
└── utils/
    ├── logger.js
    └── helpers.js
```

## 📝 각 파일의 완전한 코드

### 1. config/server.js
```javascript
module.exports = {
  // 서버 설정
  server: {
    port: process.env.PORT || 8000,
    host: process.env.HOST || 'localhost'
  },
  
  // CORS 설정
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  
  // Socket.IO 설정
  socket: {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ['websocket', 'polling']
  },
  
  // 데이터베이스 설정
  database: {
    filename: process.env.DB_FILE || './ue_cms.db',
    busyTimeout: 5000,
    verbose: process.env.NODE_ENV === 'development'
  },
  
  // 모니터링 설정
  monitoring: {
    healthCheckInterval: 15000,    // 15초
    offlineTimeout: 60000,         // 60초
    connectionCheckInterval: 15000, // 15초
    processCheckInterval: 10000    // 10초
  },
  
  // 로깅 설정
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filename: 'logs/app.log',
    errorFilename: 'logs/error.log',
    maxSize: '10m',
    maxFiles: '7d'
  }
};
```

### 2. config/database.js
```javascript
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const path = require('path');
const config = require('./server');

class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    const dbPath = path.resolve(config.database.filename);
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('데이터베이스 연결 실패:', err);
          reject(err);
        } else {
          console.log('✅ SQLite 데이터베이스 연결 성공');
          this.setupPromisifiedMethods();
          this.optimizeDatabase();
          this.isInitialized = true;
          resolve();
        }
      });
    });
  }

  setupPromisifiedMethods() {
    this.run = promisify(this.db.run.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));
    this.exec = promisify(this.db.exec.bind(this.db));
  }

  async optimizeDatabase() {
    try {
      await this.run('PRAGMA journal_mode = WAL');
      await this.run('PRAGMA synchronous = NORMAL');
      await this.run('PRAGMA cache_size = 10000');
      await this.run('PRAGMA temp_store = MEMORY');
      await this.run('PRAGMA mmap_size = 30000000000');
      console.log('✅ 데이터베이스 최적화 완료');
    } catch (error) {
      console.error('데이터베이스 최적화 실패:', error);
    }
  }

  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ 데이터베이스 연결 종료');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  // 헬퍼 메서드들
  async exists(table, conditions) {
    const keys = Object.keys(conditions);
    const where = keys.map(k => `${k} = ?`).join(' AND ');
    const values = keys.map(k => conditions[k]);
    
    const result = await this.get(
      `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`,
      values
    );
    
    return result.count > 0;
  }

  async insert(table, data) {
    const keys = Object.keys(data);
    const values = keys.map(k => data[k]);
    const placeholders = keys.map(() => '?').join(', ');
    
    const result = await this.run(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return result.lastID;
  }

  async update(table, data, conditions) {
    const dataKeys = Object.keys(data);
    const setClause = dataKeys.map(k => `${k} = ?`).join(', ');
    const dataValues = dataKeys.map(k => data[k]);
    
    const condKeys = Object.keys(conditions);
    const whereClause = condKeys.map(k => `${k} = ?`).join(' AND ');
    const condValues = condKeys.map(k => conditions[k]);
    
    const result = await this.run(
      `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
      [...dataValues, ...condValues]
    );
    
    return result.changes;
  }

  async delete(table, conditions) {
    const keys = Object.keys(conditions);
    const where = keys.map(k => `${k} = ?`).join(' AND ');
    const values = keys.map(k => conditions[k]);
    
    const result = await this.run(
      `DELETE FROM ${table} WHERE ${where}`,
      values
    );
    
    return result.changes;
  }
}

module.exports = new Database();
```

### 3. db/migrations.js
```javascript
const db = require('../config/database');

const migrations = [
  // 클라이언트 테이블
  `CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 8081,
    status TEXT DEFAULT 'offline',
    last_seen DATETIME,
    current_preset_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_preset_id) REFERENCES presets (id)
  )`,
  
  // 그룹 테이블
  `CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // 그룹-클라이언트 관계
  `CREATE TABLE IF NOT EXISTS group_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
    UNIQUE(group_id, client_id)
  )`,
  
  // 프리셋 테이블
  `CREATE TABLE IF NOT EXISTS presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    target_group_id INTEGER,
    client_commands TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_group_id) REFERENCES groups (id) ON DELETE SET NULL
  )`,
  
  // 실행 히스토리
  `CREATE TABLE IF NOT EXISTS execution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id INTEGER,
    client_id INTEGER,
    status TEXT,
    result TEXT,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (preset_id) REFERENCES presets (id),
    FOREIGN KEY (client_id) REFERENCES clients (id)
  )`,
  
  // 클라이언트 전원 정보
  `CREATE TABLE IF NOT EXISTS client_power_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER UNIQUE,
    mac_address VARCHAR(17),
    is_manual BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
  )`,
  
  // IP-MAC 히스토리
  `CREATE TABLE IF NOT EXISTS ip_mac_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    mac_address VARCHAR(17) NOT NULL,
    is_manual BOOLEAN DEFAULT false,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // IP-이름 히스토리
  `CREATE TABLE IF NOT EXISTS ip_name_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    user_modified_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // 인덱스들
  `CREATE INDEX IF NOT EXISTS idx_clients_ip ON clients(ip_address)`,
  `CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)`,
  `CREATE INDEX IF NOT EXISTS idx_ip_mac_history_ip ON ip_mac_history(ip_address)`,
  `CREATE INDEX IF NOT EXISTS idx_ip_mac_history_mac ON ip_mac_history(mac_address)`,
  `CREATE INDEX IF NOT EXISTS idx_ip_name_history_ip ON ip_name_history(ip_address)`,
  `CREATE INDEX IF NOT EXISTS idx_execution_history_time ON execution_history(executed_at)`
];

async function runMigrations() {
  console.log('🔄 데이터베이스 마이그레이션 시작...');
  
  try {
    for (const migration of migrations) {
      await db.run(migration);
    }
    
    console.log('✅ 데이터베이스 마이그레이션 완료');
    
    // 무결성 검사
    await checkDatabaseIntegrity();
  } catch (error) {
    console.error('❌ 데이터베이스 마이그레이션 실패:', error);
    throw error;
  }
}

async function checkDatabaseIntegrity() {
  console.log('🔍 데이터베이스 무결성 검사 중...');
  
  try {
    // 존재하지 않는 클라이언트를 참조하는 그룹 연결 정리
    const result1 = await db.run(`
      DELETE FROM group_clients 
      WHERE client_id NOT IN (SELECT id FROM clients)
    `);
    if (result1.changes > 0) {
      console.log(`✅ ${result1.changes}개의 무효한 그룹-클라이언트 연결 정리됨`);
    }
    
    // 존재하지 않는 그룹을 참조하는 프리셋 정리
    const result2 = await db.run(`
      UPDATE presets 
      SET target_group_id = NULL 
      WHERE target_group_id NOT IN (SELECT id FROM groups)
    `);
    if (result2.changes > 0) {
      console.log(`✅ ${result2.changes}개의 무효한 프리셋 그룹 참조 정리됨`);
    }
    
    console.log('✅ 데이터베이스 무결성 검사 완료');
  } catch (error) {
    console.error('❌ 무결성 검사 실패:', error);
  }
}

module.exports = { runMigrations, checkDatabaseIntegrity };
```

### 4. models/Client.js
```javascript
const db = require('../config/database');

class ClientModel {
  // 모든 클라이언트 조회 (MAC 주소 포함)
  static async findAll() {
    const query = `
      SELECT 
        c.*,
        cpi.mac_address,
        cpi.is_manual as mac_is_manual
      FROM clients c
      LEFT JOIN (
        SELECT client_id, mac_address, is_manual, updated_at 
        FROM client_power_info cpi1 
        WHERE updated_at = (
          SELECT MAX(updated_at) 
          FROM client_power_info cpi2 
          WHERE cpi2.client_id = cpi1.client_id
        )
      ) cpi ON c.id = cpi.client_id
      ORDER BY c.id
    `;
    
    return await db.all(query);
  }

  // ID로 클라이언트 조회
  static async findById(id) {
    return await db.get('SELECT * FROM clients WHERE id = ?', [id]);
  }

  // 이름으로 클라이언트 조회
  static async findByName(name) {
    return await db.get('SELECT * FROM clients WHERE name = ?', [name]);
  }

  // IP로 클라이언트 조회
  static async findByIP(ip) {
    return await db.get('SELECT * FROM clients WHERE ip_address = ?', [ip]);
  }

  // 클라이언트 생성
  static async create(data) {
    const { name, ip_address, port = 8081 } = data;
    
    return await db.transaction(async () => {
      // 같은 이름의 기존 클라이언트 삭제
      await db.run('DELETE FROM clients WHERE name = ?', [name]);
      
      // 새 클라이언트 생성
      const result = await db.run(
        'INSERT INTO clients (name, ip_address, port, status) VALUES (?, ?, ?, ?)',
        [name, ip_address, port, 'online']
      );
      
      return await this.findById(result.lastID);
    });
  }

  // 클라이언트 업데이트
  static async update(id, data) {
    const { name, ip_address, port } = data;
    
    // 기존 클라이언트 조회
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('클라이언트를 찾을 수 없습니다.');
    }

    // 업데이트
    await db.run(
      'UPDATE clients SET name = ?, ip_address = ?, port = ? WHERE id = ?',
      [name, ip_address, port, id]
    );

    // 이름이 변경된 경우 히스토리 저장
    if (name !== existing.name) {
      await db.run(
        'INSERT OR REPLACE INTO ip_name_history (ip_address, user_modified_name, original_name, last_used) VALUES (?, ?, ?, datetime("now"))',
        [ip_address, name, existing.name]
      );
    }

    return await this.findById(id);
  }

  // 클라이언트 삭제
  static async delete(id) {
    return await db.transaction(async () => {
      const client = await this.findById(id);
      if (!client) {
        throw new Error('클라이언트를 찾을 수 없습니다.');
      }

      // 관련 데이터 삭제 (CASCADE 설정으로 자동 처리)
      const result = await db.run('DELETE FROM clients WHERE id = ?', [id]);
      
      return result.changes > 0;
    });
  }

  // 상태 업데이트
  static async updateStatus(id, status) {
    const result = await db.run(
      'UPDATE clients SET status = ?, last_seen = datetime("now") WHERE id = ?',
      [status, id]
    );
    
    return result.changes > 0;
  }

  // 하트비트 업데이트
  static async updateHeartbeat(name, ip_address, port = 8081) {
    // 기존 클라이언트 확인
    let client = await this.findByName(name) || await this.findByIP(ip_address);
    
    if (client) {
      // 기존 클라이언트 업데이트
      await db.run(
        'UPDATE clients SET ip_address = ?, port = ?, status = ?, last_seen = datetime("now") WHERE id = ?',
        [ip_address, port, 'online', client.id]
      );
      return await this.findById(client.id);
    } else {
      // 새 클라이언트 자동 등록
      return await this.create({ name, ip_address, port });
    }
  }

  // MAC 주소 업데이트
  static async updateMacAddress(id, macAddress, isManual = false) {
    // 기존 MAC 주소 정보 확인
    const existing = await db.get(
      'SELECT mac_address, is_manual FROM client_power_info WHERE client_id = ?',
      [id]
    );
    
    // 수동 입력된 MAC 주소가 있으면 자동 수집으로 덮어쓰지 않음
    if (existing && existing.is_manual && !isManual) {
      return {
        success: false,
        message: '수동 입력된 MAC 주소가 있어 자동 수집 MAC 주소를 무시합니다.',
        mac_address: existing.mac_address,
        is_manual: true
      };
    }
    
    // MAC 주소 저장 또는 업데이트
    await db.run(
      'INSERT OR REPLACE INTO client_power_info (client_id, mac_address, updated_at, is_manual) VALUES (?, ?, datetime("now"), ?)',
      [id, macAddress, isManual ? 1 : 0]
    );
    
    // IP 주소 히스토리에도 저장
    const client = await this.findById(id);
    if (client) {
      await db.run(
        'INSERT OR REPLACE INTO ip_mac_history (ip_address, mac_address, is_manual, last_used) VALUES (?, ?, ?, datetime("now"))',
        [client.ip_address, macAddress, isManual ? 1 : 0]
      );
    }
    
    return {
      success: true,
      message: 'MAC 주소가 업데이트되었습니다.',
      mac_address: macAddress,
      is_manual: isManual
    };
  }

  // 온라인 클라이언트 조회
  static async findOnlineClients() {
    return await db.all(
      'SELECT * FROM clients WHERE status IN ("online", "running") ORDER BY name'
    );
  }

  // 오프라인 처리
  static async markOfflineByTimeout(timeoutMs = 60000) {
    const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();
    
    const result = await db.run(
      'UPDATE clients SET status = "offline" WHERE status = "online" AND last_seen < ?',
      [cutoffTime]
    );
    
    return result.changes;
  }
}

module.exports = ClientModel;
```

### 5. models/Group.js
```javascript
const db = require('../config/database');

class GroupModel {
  // 모든 그룹 조회 (클라이언트 정보 포함)
  static async findAll() {
    const groups = await db.all('SELECT * FROM groups ORDER BY created_at DESC');
    
    // 각 그룹의 클라이언트 정보 조회
    for (const group of groups) {
      group.clients = await this.getGroupClients(group.id);
    }
    
    return groups;
  }

  // ID로 그룹 조회
  static async findById(id) {
    const group = await db.get('SELECT * FROM groups WHERE id = ?', [id]);
    if (group) {
      group.clients = await this.getGroupClients(id);
    }
    return group;
  }

  // 그룹의 클라이언트 조회
  static async getGroupClients(groupId) {
    const query = `
      SELECT c.id, c.name, c.ip_address, c.status, c.last_seen
      FROM group_clients gc
      JOIN clients c ON gc.client_id = c.id
      WHERE gc.group_id = ?
      ORDER BY c.name
    `;
    
    return await db.all(query, [groupId]);
  }

  // 그룹 생성
  static async create(data) {
    const { name, description, client_ids = [] } = data;
    
    return await db.transaction(async () => {
      // 그룹 생성
      const result = await db.run(
        'INSERT INTO groups (name, description) VALUES (?, ?)',
        [name, description]
      );
      
      const groupId = result.lastID;
      
      // 클라이언트 연결
      for (const clientId of client_ids) {
        await db.run(
          'INSERT INTO group_clients (group_id, client_id) VALUES (?, ?)',
          [groupId, clientId]
        );
      }
      
      return await this.findById(groupId);
    });
  }

  // 그룹 업데이트
  static async update(id, data) {
    const { name, description, client_ids = [] } = data;
    
    return await db.transaction(async () => {
      // 그룹 정보 업데이트
      await db.run(
        'UPDATE groups SET name = ?, description = ? WHERE id = ?',
        [name, description, id]
      );
      
      // 기존 클라이언트 연결 삭제
      await db.run('DELETE FROM group_clients WHERE group_id = ?', [id]);
      
      // 새 클라이언트 연결 추가
      for (const clientId of client_ids) {
        await db.run(
          'INSERT INTO group_clients (group_id, client_id) VALUES (?, ?)',
          [id, clientId]
        );
      }
      
      return await this.findById(id);
    });
  }

  // 그룹 삭제
  static async delete(id) {
    return await db.transaction(async () => {
      // 그룹-클라이언트 연결 삭제
      await db.run('DELETE FROM group_clients WHERE group_id = ?', [id]);
      
      // 그룹 삭제
      const result = await db.run('DELETE FROM groups WHERE id = ?', [id]);
      
      return result.changes > 0;
    });
  }

  // 클라이언트가 속한 그룹들 조회
  static async findByClientId(clientId) {
    const query = `
      SELECT g.*
      FROM groups g
      JOIN group_clients gc ON g.id = gc.group_id
      WHERE gc.client_id = ?
      ORDER BY g.name
    `;
    
    return await db.all(query, [clientId]);
  }
}

module.exports = GroupModel;
```

### 6. models/Preset.js
```javascript
const db = require('../config/database');

class PresetModel {
  // 모든 프리셋 조회
  static async findAll() {
    const query = `
      SELECT p.*, g.name as group_name 
      FROM presets p
      LEFT JOIN groups g ON p.target_group_id = g.id
      ORDER BY p.created_at DESC
    `;
    
    const presets = await db.all(query);
    
    // client_commands JSON 파싱
    return presets.map(preset => ({
      ...preset,
      client_commands: preset.client_commands ? JSON.parse(preset.client_commands) : {}
    }));
  }

  // ID로 프리셋 조회
  static async findById(id) {
    const query = `
      SELECT p.*, g.name as group_name 
      FROM presets p
      LEFT JOIN groups g ON p.target_group_id = g.id
      WHERE p.id = ?
    `;
    
    const preset = await db.get(query, [id]);
    
    if (preset) {
      preset.client_commands = preset.client_commands ? 
        JSON.parse(preset.client_commands) : {};
    }
    
    return preset;
  }

  // 프리셋 생성
  static async create(data) {
    const { name, description, target_group_id, client_commands } = data;
    
    const clientCommandsJson = JSON.stringify(client_commands);
    
    const result = await db.run(
      'INSERT INTO presets (name, description, target_group_id, client_commands) VALUES (?, ?, ?, ?)',
      [name, description, target_group_id, clientCommandsJson]
    );
    
    return await this.findById(result.lastID);
  }

  // 프리셋 업데이트
  static async update(id, data) {
    const { name, description, target_group_id, client_commands } = data;
    
    const clientCommandsJson = JSON.stringify(client_commands);
    
    const result = await db.run(
      'UPDATE presets SET name = ?, description = ?, target_group_id = ?, client_commands = ? WHERE id = ?',
      [name, description, target_group_id, clientCommandsJson, id]
    );
    
    if (result.changes === 0) {
      throw new Error('프리셋을 찾을 수 없습니다.');
    }
    
    return await this.findById(id);
  }

  // 프리셋 삭제
  static async delete(id) {
    const result = await db.run('DELETE FROM presets WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // 프리셋 대상 클라이언트 조회
  static async getTargetClients(id) {
    const preset = await this.findById(id);
    if (!preset || !preset.target_group_id) {
      return [];
    }
    
    const query = `
      SELECT c.*
      FROM clients c
      JOIN group_clients gc ON c.id = gc.client_id
      WHERE gc.group_id = ?
    `;
    
    return await db.all(query, [preset.target_group_id]);
  }

  // 프리셋 실행 이력 추가
  static async addExecutionHistory(presetId, clientId, status) {
    await db.run(
      'INSERT INTO execution_history (preset_id, client_id, status) VALUES (?, ?, ?)',
      [presetId, clientId, status]
    );
  }
}

module.exports = PresetModel;
```

### 7. models/Execution.js
```javascript
const db = require('../config/database');

class ExecutionModel {
  // 실행 이력 조회
  static async findAll(limit = 50) {
    const query = `
      SELECT 
        eh.id,
        eh.status,
        eh.executed_at,
        p.name as preset_name,
        c.name as client_name
      FROM execution_history eh
      LEFT JOIN presets p ON eh.preset_id = p.id
      LEFT JOIN clients c ON eh.client_id = c.id
      ORDER BY eh.executed_at DESC
      LIMIT ?
    `;
    
    return await db.all(query, [limit]);
  }

  // 프리셋별 실행 이력
  static async findByPresetId(presetId, limit = 100) {
    const query = `
      SELECT eh.*, c.name as client_name
      FROM execution_history eh
      JOIN clients c ON eh.client_id = c.id
      WHERE eh.preset_id = ?
      ORDER BY eh.executed_at DESC
      LIMIT ?
    `;
    
    return await db.all(query, [presetId, limit]);
  }

  // 클라이언트별 실행 이력
  static async findByClientId(clientId, limit = 100) {
    const query = `
      SELECT eh.*, p.name as preset_name
      FROM execution_history eh
      JOIN presets p ON eh.preset_id = p.id
      WHERE eh.client_id = ?
      ORDER BY eh.executed_at DESC
      LIMIT ?
    `;
    
    return await db.all(query, [clientId, limit]);
  }

  // 실행 기록 생성
  static async create(presetId, clientId, status) {
    const result = await db.run(
      'INSERT INTO execution_history (preset_id, client_id, status) VALUES (?, ?, ?)',
      [presetId, clientId, status]
    );
    
    return result.lastID;
  }

  // 실행 상태 업데이트
  static async updateStatus(id, status, result = null) {
    await db.run(
      'UPDATE execution_history SET status = ?, result = ? WHERE id = ?',
      [status, result, id]
    );
  }

  // 통계 조회
  static async getStatistics() {
    const stats = {};
    
    // 전체 실행 수
    const totalResult = await db.get(
      'SELECT COUNT(*) as total FROM execution_history'
    );
    stats.total = totalResult.total;
    
    // 상태별 실행 수
    const statusResult = await db.all(`
      SELECT status, COUNT(*) as count 
      FROM execution_history 
      GROUP BY status
    `);
    stats.byStatus = statusResult.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});
    
    // 최근 24시간 실행 수
    const recentResult = await db.get(`
      SELECT COUNT(*) as recent 
      FROM execution_history 
      WHERE executed_at > datetime('now', '-24 hours')
    `);
    stats.recent24Hours = recentResult.recent;
    
    return stats;
  }
}

module.exports = ExecutionModel;
```

### 8. controllers/clientController.js
```javascript
const ClientModel = require('../models/Client');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

class ClientController {
  // 모든 클라이언트 조회
  static async getAll(req, res, next) {
    try {
      const clients = await ClientModel.findAll();
      res.json(clients);
    } catch (error) {
      logger.error('클라이언트 조회 실패:', error);
      next(error);
    }
  }

  // 클라이언트 생성
  static async create(req, res, next) {
    try {
      const { name, ip_address, port } = req.body;
      
      // 유효성 검사
      if (!name || !ip_address) {
        return res.status(400).json({ 
          error: '이름과 IP 주소는 필수입니다.' 
        });
      }

      const client = await ClientModel.create({ name, ip_address, port });
      
      // Socket.IO 이벤트 전송
      socketService.emit('client_added', client);
      
      logger.info(`새 클라이언트 등록: ${name} (${ip_address})`);
      res.status(201).json(client);
    } catch (error) {
      logger.error('클라이언트 생성 실패:', error);
      next(error);
    }
  }

  // 클라이언트 업데이트
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, ip_address, port } = req.body;
      
      if (!name || !ip_address) {
        return res.status(400).json({ 
          error: '이름과 IP 주소는 필수입니다.' 
        });
      }

      const client = await ClientModel.update(id, { name, ip_address, port });
      
      // Socket.IO 이벤트 전송
      socketService.emit('client_updated', client);
      
      logger.info(`클라이언트 업데이트: ${name} (ID: ${id})`);
      res.json(client);
    } catch (error) {
      if (error.message === '클라이언트를 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('클라이언트 업데이트 실패:', error);
      next(error);
    }
  }

  // 클라이언트 삭제
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      const success = await ClientModel.delete(id);
      
      if (!success) {
        return res.status(404).json({ 
          error: '클라이언트를 찾을 수 없습니다.' 
        });
      }

      // Socket.IO 이벤트 전송
      socketService.emit('client_deleted', { id: parseInt(id) });
      
      logger.info(`클라이언트 삭제: ID ${id}`);
      res.json({ message: '클라이언트가 삭제되었습니다.' });
    } catch (error) {
      logger.error('클라이언트 삭제 실패:', error);
      next(error);
    }
  }

  // MAC 주소 업데이트
  static async updateMacAddress(req, res, next) {
    try {
      const { id } = req.params;
      const { mac_address, is_manual = false } = req.body;
      
      if (!mac_address) {
        return res.status(400).json({ 
          error: 'MAC 주소는 필수입니다.' 
        });
      }

      const result = await ClientModel.updateMacAddress(id, mac_address, is_manual);
      
      if (result.success) {
        // Socket.IO 이벤트 전송
        socketService.emit('mac_address_updated', {
          clientId: parseInt(id),
          macAddress: mac_address,
          isManual: is_manual
        });
      }
      
      res.json(result);
    } catch (error) {
      logger.error('MAC 주소 업데이트 실패:', error);
      next(error);
    }
  }

  // 하트비트 처리
  static async heartbeat(req, res, next) {
    try {
      const { clientName, ip_address, port = 8081 } = req.body;
      
      if (!clientName || !ip_address) {
        return res.status(400).json({ 
          error: '클라이언트 이름과 IP 주소는 필수입니다.' 
        });
      }

      const client = await ClientModel.updateHeartbeat(clientName, ip_address, port);
      
      // Socket.IO 이벤트 전송
      socketService.emit('client_status_changed', {
        id: client.id,
        name: clientName,
        status: 'online',
        ip_address: ip_address
      });
      
      res.json({ 
        success: true, 
        message: '하트비트 처리 완료',
        clientId: client.id
      });
    } catch (error) {
      logger.error('하트비트 처리 실패:', error);
      next(error);
    }
  }
}

module.exports = ClientController;
```

### 9. controllers/groupController.js
```javascript
const GroupModel = require('../models/Group');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

class GroupController {
  // 모든 그룹 조회
  static async getAll(req, res, next) {
    try {
      const groups = await GroupModel.findAll();
      res.json(groups);
    } catch (error) {
      logger.error('그룹 조회 실패:', error);
      next(error);
    }
  }

  // 그룹 생성
  static async create(req, res, next) {
    try {
      const { name, description, client_ids } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          error: '그룹 이름은 필수입니다.' 
        });
      }
      
      if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json({ 
          error: '최소 한 개의 클라이언트를 그룹에 포함해야 합니다.' 
        });
      }

      const group = await GroupModel.create({ name, description, client_ids });
      
      // Socket.IO 이벤트 전송
      socketService.emit('group_added', group);
      
      logger.info(`새 그룹 생성: ${name}`);
      res.status(201).json(group);
    } catch (error) {
      logger.error('그룹 생성 실패:', error);
      next(error);
    }
  }

  // 그룹 업데이트
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, client_ids } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          error: '그룹 이름은 필수입니다.' 
        });
      }
      
      if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json({ 
          error: '최소 한 개의 클라이언트를 그룹에 포함해야 합니다.' 
        });
      }

      const group = await GroupModel.update(id, { name, description, client_ids });
      
      // Socket.IO 이벤트 전송
      socketService.emit('group_updated', group);
      
      logger.info(`그룹 업데이트: ${name} (ID: ${id})`);
      res.json(group);
    } catch (error) {
      logger.error('그룹 업데이트 실패:', error);
      next(error);
    }
  }

  // 그룹 삭제
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      const success = await GroupModel.delete(id);
      
      if (!success) {
        return res.status(404).json({ 
          error: '그룹을 찾을 수 없습니다.' 
        });
      }

      // Socket.IO 이벤트 전송
      socketService.emit('group_deleted', { id: parseInt(id) });
      
      logger.info(`그룹 삭제: ID ${id}`);
      res.json({ message: '그룹이 삭제되었습니다.' });
    } catch (error) {
      logger.error('그룹 삭제 실패:', error);
      next(error);
    }
  }
}

module.exports = GroupController;
```

### 10. controllers/presetController.js
```javascript
const PresetModel = require('../models/Preset');
const ExecutionService = require('../services/executionService');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

class PresetController {
  // 모든 프리셋 조회
  static async getAll(req, res, next) {
    try {
      const presets = await PresetModel.findAll();
      res.json(presets);
    } catch (error) {
      logger.error('프리셋 조회 실패:', error);
      next(error);
    }
  }

  // 프리셋 생성
  static async create(req, res, next) {
    try {
      const { name, description, target_group_id, client_commands } = req.body;
      
      // 유효성 검사
      if (!name || !target_group_id || !client_commands || Object.keys(client_commands).length === 0) {
        return res.status(400).json({ 
          error: '프리셋 이름, 대상 그룹, 명령어는 필수입니다.' 
        });
      }

      const preset = await PresetModel.create({
        name, description, target_group_id, client_commands
      });
      
      // Socket.IO 이벤트 전송
      socketService.emit('preset_added', preset);
      
      logger.info(`새 프리셋 생성: ${name}`);
      res.status(201).json(preset);
    } catch (error) {
      logger.error('프리셋 생성 실패:', error);
      next(error);
    }
  }

  // 프리셋 업데이트
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, target_group_id, client_commands } = req.body;
      
      if (!name || !target_group_id || !client_commands || Object.keys(client_commands).length === 0) {
        return res.status(400).json({ 
          error: '프리셋 이름, 대상 그룹, 명령어는 필수입니다.' 
        });
      }

      const preset = await PresetModel.update(id, {
        name, description, target_group_id, client_commands
      });
      
      // Socket.IO 이벤트 전송
      socketService.emit('preset_updated', preset);
      
      logger.info(`프리셋 업데이트: ${name} (ID: ${id})`);
      res.json(preset);
    } catch (error) {
      if (error.message === '프리셋을 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('프리셋 업데이트 실패:', error);
      next(error);
    }
  }

  // 프리셋 삭제
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      const success = await PresetModel.delete(id);
      
      if (!success) {
        return res.status(404).json({ 
          error: '프리셋을 찾을 수 없습니다.' 
        });
      }

      // Socket.IO 이벤트 전송
      socketService.emit('preset_deleted', { id: parseInt(id) });
      
      logger.info(`프리셋 삭제: ID ${id}`);
      res.json({ message: '프리셋이 삭제되었습니다.' });
    } catch (error) {
      logger.error('프리셋 삭제 실패:', error);
      next(error);
    }
  }

  // 프리셋 실행
  static async execute(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await ExecutionService.executePreset(id);
      
      logger.info(`프리셋 실행: ID ${id}, 성공 ${result.summary.successful}개, 실패 ${result.summary.failed}개`);
      res.json(result);
    } catch (error) {
      if (error.message === '프리셋을 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('프리셋 실행 실패:', error);
      next(error);
    }
  }

  // 프리셋 정지
  static async stop(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await ExecutionService.stopPreset(id);
      
      logger.info(`프리셋 정지: ID ${id}, 정지 ${result.summary.stopped}개`);
      res.json(result);
    } catch (error) {
      if (error.message === '프리셋을 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('프리셋 정지 실패:', error);
      next(error);
    }
  }

  // 프리셋 상태 조회
  static async getStatus(req, res, next) {
    try {
      const { id } = req.params;
      
      const status = await ExecutionService.getPresetStatus(id);
      
      res.json(status);
    } catch (error) {
      if (error.message === '프리셋을 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('프리셋 상태 조회 실패:', error);
      next(error);
    }
  }
}

module.exports = PresetController;
```

### 11. services/socketService.js
```javascript
const socketIo = require('socket.io');
const ClientModel = require('../models/Client');
const logger = require('../utils/logger');
const config = require('../config/server');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.clientTimeouts = new Map();
  }

  initialize(server) {
    this.io = socketIo(server, config.socket);
    
    this.io.on('connection', (socket) => {
      logger.info(`소켓 연결: ${socket.id}`);
      this.handleConnection(socket);
    });
    
    // 주기적인 상태 확인
    this.startHealthCheck();
    this.startOfflineCheck();
    
    logger.info('Socket.IO 서비스 초기화 완료');
  }

  handleConnection(socket) {
    // 클라이언트 등록
    socket.on('register_client', (data) => this.handleRegister(socket, data));
    
    // 하트비트
    socket.on('heartbeat', (data) => this.handleHeartbeat(socket, data));
    
    // 프로세스 상태
    socket.on('current_process_status', (data) => this.handleProcessStatus(socket, data));
    socket.on('process_status', (data) => this.handleProcessStatusUpdate(socket, data));
    
    // 실행 결과
    socket.on('execution_result', (data) => this.handleExecutionResult(socket, data));
    socket.on('stop_result', (data) => this.handleStopResult(socket, data));
    
    // 연결 확인 응답
    socket.on('connection_check_response', (data) => this.handleConnectionCheckResponse(socket, data));
    
    // 연결 해제
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  async handleRegister(socket, data) {
    try {
      const { name, clientType = 'python', ip_address } = data;
      const clientIP = ip_address || this.normalizeIP(socket.handshake.address || '127.0.0.1');
      
      socket.clientType = clientType;
      socket.clientName = name;
      
      // 기존 클라이언트 찾기
      let client = await ClientModel.findByIP(clientIP);
      
      if (client) {
        socket.clientName = client.name;
        logger.info(`기존 클라이언트 발견: ${client.name} (ID: ${client.id})`);
      } else {
        // 새 클라이언트 등록
        client = await ClientModel.create({ name, ip_address: clientIP });
        logger.info(`새 클라이언트 등록: ${name} (ID: ${client.id})`);
      }
      
      // 소켓 연결 관리
      this.registerSocket(client.name, socket);
      
      // 상태 업데이트
      await ClientModel.updateStatus(client.id, 'online');
      this.emit('client_status_changed', { 
        id: client.id, 
        name: client.name, 
        status: 'online' 
      });
      
    } catch (error) {
      logger.error('클라이언트 등록 실패:', error);
      socket.emit('registration_failed', { reason: error.message });
    }
  }

  async handleHeartbeat(socket, data) {
    try {
      const { clientName, ip_address, timestamp } = data;
      const clientIP = ip_address || this.normalizeIP(socket.handshake.address || '127.0.0.1');
      
      // 클라이언트 정보 업데이트
      const client = await ClientModel.updateHeartbeat(clientName, clientIP);
      
      if (client) {
        // 소켓 연결 관리
        this.registerSocket(client.name, socket);
        socket.clientName = client.name;
        
        // 상태 업데이트
        await ClientModel.updateStatus(client.id, 'online');
        this.emit('client_status_changed', { 
          id: client.id, 
          name: client.name, 
          status: 'online' 
        });
        
        // 하트비트 응답
        socket.emit('heartbeat_response', {
          status: 'ok',
          timestamp: new Date().toISOString(),
          message: '하트비트 수신 완료'
        });
      }
    } catch (error) {
      logger.error('하트비트 처리 실패:', error);
    }
  }

  async handleProcessStatus(socket, data) {
    const { clientName, running_process_count, running_processes, status } = data;
    logger.info(`프로세스 상태: ${clientName} - ${running_process_count}개 실행 중`);
    
    try {
      const client = await ClientModel.findByName(clientName);
      if (client) {
        const newStatus = running_process_count > 0 ? 'running' : 'online';
        await ClientModel.updateStatus(client.id, newStatus);
        
        this.emit('client_status_changed', {
          id: client.id,
          name: clientName,
          status: newStatus,
          running_process_count,
          running_processes
        });
      }
    } catch (error) {
      logger.error('프로세스 상태 처리 실패:', error);
    }
  }

  async handleExecutionResult(socket, data) {
    const { executionId, clientName, status, result } = data;
    logger.info(`실행 결과: ${clientName} - ${status}`);
    
    // 실행 히스토리 업데이트
    if (executionId) {
      const ExecutionModel = require('../models/Execution');
      await ExecutionModel.updateStatus(executionId, status, result);
      this.emit('execution_updated', { executionId, status, result });
    }
    
    // 클라이언트 상태 업데이트
    if (clientName) {
      const client = await ClientModel.findByName(clientName);
      if (client) {
        await ClientModel.updateStatus(client.id, 'online');
        this.emit('client_status_changed', { 
          name: clientName, 
          status: 'online',
          reason: '명령 실행 완료'
        });
      }
    }
  }

  handleDisconnect(socket) {
    const clientType = socket.clientType || 'Unknown';
    const clientName = socket.clientName || 'Unknown';
    
    logger.info(`소켓 연결 해제: ${clientName} (${clientType})`);
    
    if (socket.clientName) {
      // 연결 해제 처리
      this.handleClientDisconnect(socket.clientName);
    }
  }

  handleClientDisconnect(clientName) {
    const currentSocket = this.connectedClients.get(clientName);
    if (currentSocket && currentSocket.id === socket.id) {
      this.connectedClients.delete(clientName);
      
      // 타임아웃 설정 (재연결 대기)
      const timeout = setTimeout(async () => {
        const checkSocket = this.connectedClients.get(clientName);
        if (!checkSocket || !checkSocket.connected) {
          const client = await ClientModel.findByName(clientName);
          if (client) {
            await ClientModel.updateStatus(client.id, 'offline');
            this.emit('client_status_changed', { 
              name: clientName, 
              status: 'offline' 
            });
          }
        }
      }, 5000); // 5초 대기
      
      this.clientTimeouts.set(clientName, timeout);
    }
  }

  registerSocket(clientName, socket) {
    // 기존 소켓 정리
    this.cleanupSocket(clientName);
    
    // 새 소켓 등록
    this.connectedClients.set(clientName, socket);
    socket.clientName = clientName;
    
    // 타임아웃 클리어
    this.clearTimeout(clientName);
  }

  cleanupSocket(clientName) {
    const oldSocket = this.connectedClients.get(clientName);
    if (oldSocket && oldSocket.connected && oldSocket.id !== socket.id) {
      oldSocket.disconnect();
    }
  }

  clearTimeout(clientName) {
    const timeout = this.clientTimeouts.get(clientName);
    if (timeout) {
      clearTimeout(timeout);
      this.clientTimeouts.delete(clientName);
    }
  }

  normalizeIP(ip) {
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    if (ip === '::1') {
      return '127.0.0.1';
    }
    return ip;
  }

  // 외부 호출용 메서드
  emit(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  emitToClient(clientName, event, data) {
    const socket = this.connectedClients.get(clientName);
    if (socket && socket.connected) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }

  getConnectedClients() {
    return Array.from(this.connectedClients.keys());
  }

  isClientConnected(clientName) {
    const socket = this.connectedClients.get(clientName);
    return socket && socket.connected;
  }

  // 주기적인 상태 확인
  startHealthCheck() {
    setInterval(async () => {
      const onlineClients = await ClientModel.findOnlineClients();
      
      for (const client of onlineClients) {
        const socket = this.connectedClients.get(client.name);
        if (socket && socket.connected) {
          socket.emit('connection_check', {
            clientName: client.name,
            timestamp: new Date().toISOString()
          });
        } else {
          // 소켓이 없으면 오프라인 처리
          await ClientModel.updateStatus(client.id, 'offline');
          this.emit('client_status_changed', { 
            name: client.name, 
            status: 'offline' 
          });
        }
      }
    }, config.monitoring.connectionCheckInterval);
  }

  // 오프라인 처리
  startOfflineCheck() {
    setInterval(async () => {
      const offlineCount = await ClientModel.markOfflineByTimeout(config.monitoring.offlineTimeout);
      
      if (offlineCount > 0) {
        logger.info(`${offlineCount}개 클라이언트를 오프라인으로 변경`);
        this.emit('clients_offline_updated');
      }
    }, config.monitoring.offlineTimeout);
  }
}

module.exports = new SocketService();
```

### 12. services/executionService.js
```javascript
const PresetModel = require('../models/Preset');
const ClientModel = require('../models/Client');
const socketService = require('./socketService');
const logger = require('../utils/logger');

class ExecutionService {
  // 프리셋 실행
  static async executePreset(presetId) {
    logger.info(`프리셋 실행 시작: ID ${presetId}`);
    
    // 프리셋 정보 조회
    const preset = await PresetModel.findById(presetId);
    if (!preset) {
      throw new Error('프리셋을 찾을 수 없습니다.');
    }
    
    // 대상 클라이언트 조회
    const clients = await PresetModel.getTargetClients(presetId);
    const onlineClients = clients.filter(c => c.status !== 'offline');
    
    if (onlineClients.length === 0) {
      throw new Error('실행 가능한 온라인 클라이언트가 없습니다.');
    }
    
    // 실행 결과 수집
    const executionResults = [];
    const warnings = [];
    
    // 각 클라이언트에 명령 전송
    for (const client of clients) {
      const command = preset.client_commands[client.id] || preset.client_commands[client.name];
      
      if (!command) {
        warnings.push(`클라이언트 ${client.name}에 대한 명령어가 설정되지 않았습니다.`);
        continue;
      }
      
      const sent = socketService.emitToClient(client.name, 'execute_command', {
        clientName: client.name,
        command: command,
        presetId: preset.id
      });
      
      if (sent) {
        // 상태 업데이트
        await ClientModel.update(client.id, { 
          status: 'running',
          current_preset_id: preset.id
        });
        
        // 실행 히스토리 기록
        await PresetModel.addExecutionHistory(preset.id, client.id, 'executing');
        
        executionResults.push({
          clientId: client.id,
          clientName: client.name,
          status: 'running'
        });
      } else {
        warnings.push(`클라이언트 ${client.name}가 연결되지 않았습니다.`);
        await PresetModel.addExecutionHistory(preset.id, client.id, 'failed_offline');
      }
    }
    
    // Socket.IO 이벤트 전송
    socketService.emit('preset_executed', {
      presetId: preset.id,
      presetName: preset.name,
      clients: executionResults,
      warnings: warnings
    });
    
    return {
      message: '프리셋이 실행되었습니다.',
      preset: preset,
      clients: executionResults,
      summary: {
        total: clients.length,
        online: onlineClients.length,
        offline: clients.length - onlineClients.length,
        executed: executionResults.length
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // 프리셋 정지
  static async stopPreset(presetId) {
    logger.info(`프리셋 정지 시작: ID ${presetId}`);
    
    // 프리셋 정보 조회
    const preset = await PresetModel.findById(presetId);
    if (!preset) {
      throw new Error('프리셋을 찾을 수 없습니다.');
    }
    
    // 대상 클라이언트 조회
    const clients = await PresetModel.getTargetClients(presetId);
    const stopResults = [];
    
    // 각 클라이언트에 정지 명령 전송
    for (const client of clients) {
      const sent = socketService.emitToClient(client.name, 'stop_command', {
        clientName: client.name,
        presetId: preset.id
      });
      
      if (sent) {
        // 상태 업데이트
        await ClientModel.update(client.id, { 
          status: 'online',
          current_preset_id: null
        });
        
        stopResults.push({
          clientId: client.id,
          clientName: client.name,
          status: 'stopping'
        });
      }
    }
    
    // Socket.IO 이벤트 전송
    socketService.emit('preset_stopped', {
      presetId: preset.id,
      presetName: preset.name,
      clients: stopResults
    });
    
    return {
      message: '프리셋 정지 요청이 전송되었습니다.',
      preset: preset,
      clients: stopResults,
      summary: {
        total: clients.length,
        stopped: stopResults.length
      }
    };
  }

  // 프리셋 상태 조회
  static async getPresetStatus(presetId) {
    const preset = await PresetModel.findById(presetId);
    if (!preset) {
      throw new Error('프리셋을 찾을 수 없습니다.');
    }
    
    const clients = await PresetModel.getTargetClients(presetId);
    
    // 각 클라이언트의 상태 판정
    let runningCount = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    
    for (const client of clients) {
      if (client.status === 'running' && client.current_preset_id == presetId) {
        runningCount++;
      } else if (client.status === 'online') {
        onlineCount++;
      } else {
        offlineCount++;
      }
    }
    
    // 프리셋 상태 판정
    let status = 'stopped';
    let statusColor = 'gray';
    
    if (runningCount > 0) {
      if (runningCount === clients.length) {
        status = 'running';
        statusColor = 'green';
      } else {
        status = 'partial';
        statusColor = 'yellow';
      }
    } else if (offlineCount === clients.length) {
      status = 'offline';
      statusColor = 'red';
    } else if (onlineCount > 0) {
      status = 'ready';
      statusColor = 'blue';
    }
    
    return {
      presetId: presetId,
      presetName: preset.name,
      status: status,
      statusColor: statusColor,
      summary: {
        total: clients.length,
        running: runningCount,
        online: onlineCount,
        offline: offlineCount
      },
      clients: clients.map(client => ({
        id: client.id,
        name: client.name,
        status: client.status,
        current_preset_id: client.current_preset_id,
        isRunningThisPreset: client.status === 'running' && client.current_preset_id == presetId
      }))
    };
  }
}

module.exports = ExecutionService;
```

### 13. routes/index.js
```javascript
const express = require('express');
const router = express.Router();

// 라우트 모듈들
const clientRoutes = require('./clients');
const groupRoutes = require('./groups');
const presetRoutes = require('./presets');
const executionRoutes = require('./executions');

// 헬스 체크
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'UE CMS Server v2.0'
  });
});

// 라우트 등록
router.use('/clients', clientRoutes);
router.use('/groups', groupRoutes);
router.use('/presets', presetRoutes);
router.use('/executions', executionRoutes);

// 프로세스 상태 조회
router.get('/process-status', (req, res) => {
  try {
    const processStatus = global.processStatus || new Map();
    const statusData = {};
    
    for (const [clientName, status] of processStatus) {
      statusData[clientName] = status;
    }
    
    res.json({
      success: true,
      data: statusData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 특정 클라이언트의 프로세스 상태 조회
router.get('/process-status/:clientName', (req, res) => {
  try {
    const { clientName } = req.params;
    const processStatus = global.processStatus || new Map();
    
    if (processStatus.has(clientName)) {
      res.json({
        success: true,
        data: processStatus.get(clientName),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: '클라이언트의 프로세스 상태를 찾을 수 없습니다.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
```

### 14. routes/clients.js
```javascript
const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/clientController');
const asyncHandler = require('../middleware/asyncHandler');

// 클라이언트 목록 조회
router.get('/', asyncHandler(ClientController.getAll));

// 클라이언트 생성
router.post('/', asyncHandler(ClientController.create));

// 클라이언트 수정
router.put('/:id', asyncHandler(ClientController.update));

// 클라이언트 삭제
router.delete('/:id', asyncHandler(ClientController.delete));

// MAC 주소 업데이트 (ID로)
router.put('/:id/mac-address', asyncHandler(ClientController.updateMacAddress));

// 하트비트
router.post('/heartbeat', asyncHandler(ClientController.heartbeat));

module.exports = router;
```

### 15. routes/groups.js
```javascript
const express = require('express');
const router = express.Router();
const GroupController = require('../controllers/groupController');
const asyncHandler = require('../middleware/asyncHandler');

// 그룹 목록 조회
router.get('/', asyncHandler(GroupController.getAll));

// 그룹 생성
router.post('/', asyncHandler(GroupController.create));

// 그룹 수정
router.put('/:id', asyncHandler(GroupController.update));

// 그룹 삭제
router.delete('/:id', asyncHandler(GroupController.delete));

module.exports = router;
```

### 16. routes/presets.js
```javascript
const express = require('express');
const router = express.Router();
const PresetController = require('../controllers/presetController');
const asyncHandler = require('../middleware/asyncHandler');

// 프리셋 목록 조회
router.get('/', asyncHandler(PresetController.getAll));

// 프리셋 생성
router.post('/', asyncHandler(PresetController.create));

// 프리셋 수정
router.put('/:id', asyncHandler(PresetController.update));

// 프리셋 삭제
router.delete('/:id', asyncHandler(PresetController.delete));

// 프리셋 실행
router.post('/:id/execute', asyncHandler(PresetController.execute));

// 프리셋 정지
router.post('/:id/stop', asyncHandler(PresetController.stop));

// 프리셋 상태 조회
router.get('/:id/status', asyncHandler(PresetController.getStatus));

module.exports = router;
```

### 17. routes/executions.js
```javascript
const express = require('express');
const router = express.Router();
const ExecutionController = require('../controllers/executionController');
const asyncHandler = require('../middleware/asyncHandler');

// 실행 이력 조회
router.get('/', asyncHandler(ExecutionController.getAll));

// 실행 통계 조회
router.get('/statistics', asyncHandler(ExecutionController.getStatistics));

module.exports = router;
```

### 18. controllers/executionController.js
```javascript
const ExecutionModel = require('../models/Execution');
const logger = require('../utils/logger');

class ExecutionController {
  // 실행 이력 조회
  static async getAll(req, res, next) {
    try {
      const { limit = 50 } = req.query;
      const executions = await ExecutionModel.findAll(parseInt(limit));
      res.json(executions);
    } catch (error) {
      logger.error('실행 이력 조회 실패:', error);
      next(error);
    }
  }

  // 실행 통계 조회
  static async getStatistics(req, res, next) {
    try {
      const stats = await ExecutionModel.getStatistics();
      res.json(stats);
    } catch (error) {
      logger.error('실행 통계 조회 실패:', error);
      next(error);
    }
  }
}

module.exports = ExecutionController;
```

### 19. middleware/asyncHandler.js
```javascript
// 비동기 함수 래퍼
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
```

### 20. middleware/errorHandler.js
```javascript
const logger = require('../utils/logger');

// 커스텀 에러 클래스
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 에러 핸들러
const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message } = err;
  
  // 로깅
  if (statusCode >= 500) {
    logger.error('서버 에러:', err);
  } else {
    logger.warn('클라이언트 에러:', err.message);
  }
  
  // 개발 환경에서는 에러 스택 포함
  const response = {
    success: false,
    error: message
  };
  
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
};

// 404 핸들러
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Cannot find ${req.originalUrl}`, 404);
  next(error);
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler
};
```

### 21. utils/logger.js
```javascript
const winston = require('winston');
const path = require('path');
const config = require('../config/server');

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// 콘솔 출력 포맷
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// 로거 생성
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // 에러 로그 파일
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // 전체 로그 파일
    new winston.transports.File({
      filename: path.join('logs', 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// 개발 환경에서는 콘솔 출력 추가
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

module.exports = logger;
```

### 22. 새로운 app.js (메인 파일)
```javascript
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');

// 설정 및 유틸리티
const config = require('./config/server');
const database = require('./config/database');
const logger = require('./utils/logger');

// 미들웨어
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// 서비스
const socketService = require('./services/socketService');

// 라우트
const routes = require('./routes');

// 데이터베이스 마이그레이션
const { runMigrations } = require('./db/migrations');

// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트
app.use('/api', routes);

// 기본 라우트 - 웹 UI 서빙
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 핸들러
app.use(notFoundHandler);

// 에러 핸들러
app.use(errorHandler);

// 서버 생성
const server = http.createServer(app);

// 서버 시작
async function startServer() {
  try {
    // 데이터베이스 초기화
    await database.initialize();
    
    // 마이그레이션 실행
    await runMigrations();
    
    // Socket.IO 초기화
    socketService.initialize(server);
    
    // 서버 시작
    server.listen(config.server.port, () => {
      logger.info(`🚀 UE CMS Server 시작됨`);
      logger.info(`📱 웹 인터페이스: http://localhost:${config.server.port}`);
      logger.info(`🔌 Socket.IO 활성화됨`);
    });
    
  } catch (error) {
    logger.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('서버 종료 시작...');
  
  try {
    // 서버 종료
    server.close();
    
    // 데이터베이스 연결 종료
    await database.close();
    
    logger.info('서버 정상 종료됨');
    process.exit(0);
  } catch (error) {
    logger.error('서버 종료 중 오류:', error);
    process.exit(1);
  }
});

// 처리되지 않은 에러 핸들링
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// 서버 시작
startServer();
```

### 23. package.json 업데이트
```json
{
  "name": "switchboard-plus-server",
  "version": "2.0.0",
  "description": "Switchboard Plus v2 Server",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest",
    "lint": "eslint .",
    "db:check": "node scripts/check_db.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "socket.io": "^4.6.1",
    "cors": "^2.8.5",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "eslint": "^8.54.0",
    "jest": "^29.7.0"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
```

### 24. .env 파일 (환경 변수)
```env
# 서버 설정
PORT=8000
HOST=localhost
NODE_ENV=development

# 데이터베이스
DB_FILE=./ue_cms.db

# 로깅
LOG_LEVEL=info

# CORS
CORS_ORIGIN=*
```

### 25. 마이그레이션 스크립트
```bash
#!/bin/bash
# migrate.sh

echo "🔄 데이터베이스 백업 중..."
cp ue_cms.db ue_cms.db.backup.$(date +%Y%m%d_%H%M%S)

echo "📦 의존성 설치 중..."
npm install

echo "🚀 서버 시작..."
npm start
```

## 📝 적용 가이드

### 1단계: 백업
```bash
# 현재 코드와 데이터베이스 백업
cp -r server server_backup
cp server/ue_cms.db server/ue_cms.db.backup
```

### 2단계: 새 구조 생성
```bash
cd server
mkdir -p config db models controllers services routes middleware utils logs
```

### 3단계: 파일 복사
위의 각 파일을 해당 경로에 생성하고 내용을 복사합니다.

### 4단계: package.json 업데이트
```bash
npm install winston dotenv
```

### 5단계: 테스트
```bash
# 개발 모드로 실행
npm run dev

# 로그 확인
tail -f logs/app.log
```

### 6단계: 점진적 마이그레이션
기존 app.js를 app.old.js로 이름 변경 후, 새 app.js로 교체합니다.

## ✅ 최적화 효과

1. **코드 가독성**: 3000줄 → 기능별 100~300줄 파일로 분리
2. **유지보수성**: 각 기능이 독립적으로 관리됨
3. **성능 향상**: 비동기 처리, 트랜잭션, DB 최적화
4. **안정성**: 체계적인 에러 처리, 로깅 시스템
5. **확장성**: 새 기능 추가가 매우 용이함

이제 각 파일을 복사해서 사용하시면 됩니다!