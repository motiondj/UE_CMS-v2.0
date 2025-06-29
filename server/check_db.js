const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('ue_cms.db');

console.log('=== 데이터베이스 내용 확인 ===');

// clients 테이블 확인
db.all('SELECT * FROM clients', (err, rows) => {
  if (err) {
    console.error('clients 테이블 조회 오류:', err);
  } else {
    console.log('\n📋 clients 테이블:');
    console.table(rows);
  }
});

// client_power_info 테이블 확인
db.all('SELECT * FROM client_power_info', (err, rows) => {
  if (err) {
    console.error('client_power_info 테이블 조회 오류:', err);
    return;
  }
  console.log('\n🔌 client_power_info 테이블:');
  console.table(rows);
  
  // JOIN 결과 확인 (수정된 쿼리)
  const joinQuery = `
    SELECT 
      c.id,
      c.name,
      cpi.mac_address
    FROM clients c
    LEFT JOIN (
      SELECT client_id, mac_address, updated_at 
      FROM client_power_info cpi1 
      WHERE updated_at = (
        SELECT MAX(updated_at) 
        FROM client_power_info cpi2 
        WHERE cpi2.client_id = cpi1.client_id
      )
    ) cpi ON c.id = cpi.client_id
    ORDER BY c.id
  `;
  
  db.all(joinQuery, (err, joinRows) => {
    if (err) {
      console.error('JOIN 쿼리 오류:', err);
      return;
    }
    console.log('\n🔗 JOIN 결과 (수정된 쿼리):');
    console.table(joinRows);
  });
});

// JOIN 쿼리로 확인
db.all(`
  SELECT 
    c.id,
    c.name,
    cpi.mac_address
  FROM clients c
  LEFT JOIN client_power_info cpi ON c.id = cpi.client_id
`, (err, rows) => {
  if (err) {
    console.error('JOIN 쿼리 오류:', err);
  } else {
    console.log('\n🔗 JOIN 결과:');
    console.table(rows);
  }
  
  // 데이터베이스 연결 종료
  db.close();
}); 