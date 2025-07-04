const db = require('./config/database');

async function debugClients() {
  try {
    console.log('=== 클라이언트 디버그 시작 ===');
    
    // 1. 현재 클라이언트 목록 조회
    const clients = await new Promise((resolve, reject) => {
      db.all('SELECT id, name, status, ip_address FROM clients', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('현재 클라이언트 목록:');
    console.table(clients);
    
    // 2. MS01 클라이언트를 대문자로 업데이트
    console.log('\n=== MS01 클라이언트 이름 수정 ===');
    
    const updateResult = await new Promise((resolve, reject) => {
      db.run('UPDATE clients SET name = ? WHERE LOWER(name) = ?', ['MS01', 'ms01'], function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
    
    console.log(`업데이트된 행 수: ${updateResult.changes}`);
    
    // 3. 업데이트 후 클라이언트 목록 다시 조회
    const updatedClients = await new Promise((resolve, reject) => {
      db.all('SELECT id, name, status, ip_address FROM clients', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('\n업데이트 후 클라이언트 목록:');
    console.table(updatedClients);
    
    // 4. 대소문자 구분 없이 MS01 찾기 테스트
    console.log('\n=== 대소문자 구분 없이 MS01 찾기 테스트 ===');
    
    const testNames = ['MS01', 'ms01', 'Ms01', 'mS01'];
    
    for (const testName of testNames) {
      const found = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM clients WHERE LOWER(name) = LOWER(?)', [testName], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      console.log(`"${testName}" 검색 결과:`, found ? `찾음 (ID: ${found.id})` : '찾을 수 없음');
    }
    
    console.log('\n=== 디버그 완료 ===');
    
  } catch (error) {
    console.error('디버그 중 오류:', error);
  } finally {
    db.close();
  }
}

debugClients(); 