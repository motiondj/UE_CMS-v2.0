const db = require('./config/database');

async function fixExecutingStatus() {
  try {
    console.log('🔄 데이터베이스 초기화 중...');
    await db.initialize();
    
    console.log('🔄 running 상태를 executing으로 변경 중...');
    
    const result = await db.run(
      'UPDATE execution_history SET status = ? WHERE status = ?',
      ['executing', 'running']
    );
    
    console.log(`✅ ${result.changes}개의 레코드가 업데이트되었습니다.`);
    
    // 변경된 레코드 확인
    const rows = await db.all('SELECT * FROM execution_history WHERE status = ?', ['executing']);
    console.log('📊 현재 executing 상태 레코드:', rows.length);
    
  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    process.exit();
  }
}

fixExecutingStatus(); 