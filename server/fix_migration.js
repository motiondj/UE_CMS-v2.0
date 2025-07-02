const database = require('./config/database');
const { runMigrations } = require('./db/migrations');

async function fixMigration() {
  try {
    console.log('🔄 데이터베이스 초기화 중...');
    await database.initialize();
    
    console.log('🔄 마이그레이션 실행 중...');
    await runMigrations();
    console.log('✅ 마이그레이션 완료');
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
  }
}

fixMigration(); 