const db = require('../config/database');

const migrations = [
  // 클라이언트 테이블 (기본 구조)
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
  
  // 기본 인덱스들
  `CREATE INDEX IF NOT EXISTS idx_clients_ip ON clients(ip_address)`,
  `CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)`,
  `CREATE INDEX IF NOT EXISTS idx_ip_mac_history_ip ON ip_mac_history(ip_address)`,
  `CREATE INDEX IF NOT EXISTS idx_ip_mac_history_mac ON ip_mac_history(mac_address)`,
  `CREATE INDEX IF NOT EXISTS idx_ip_name_history_ip ON ip_name_history(ip_address)`,
  `CREATE INDEX IF NOT EXISTS idx_execution_history_time ON execution_history(executed_at)`
];

// 추가 마이그레이션 (컬럼 추가)
const additionalMigrations = [
  // 기존 테이블에 컬럼 추가
  `ALTER TABLE clients ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
  `ALTER TABLE clients ADD COLUMN status_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
  
  // 추가 인덱스들
  `CREATE INDEX IF NOT EXISTS idx_clients_updated_at ON clients(updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_clients_status_changed_at ON clients(status_changed_at)`
];

async function runMigrations() {
  console.log('🔄 데이터베이스 마이그레이션 시작...');
  
  try {
    // 기본 마이그레이션 실행
    for (const migration of migrations) {
      await db.run(migration);
    }
    
    console.log('✅ 기본 마이그레이션 완료');
    
    // 추가 마이그레이션 실행 (실패해도 무시)
    for (const migration of additionalMigrations) {
      try {
        await db.run(migration);
      } catch (error) {
        // ALTER TABLE이나 인덱스 생성 실패는 무시
        if (error.code === 'SQLITE_ERROR') {
          console.log('ℹ️ 이미 존재함:', migration);
        } else {
          console.log('⚠️ 마이그레이션 경고:', error.message);
        }
      }
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