const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./ue_cms.db', (err) => {
  if (err) {
    console.error('데이터베이스 연결 오류:', err.message);
    return;
  }
  console.log('SQLite 데이터베이스에 연결되었습니다.');
});

// 테이블 목록 확인
db.all('SELECT name FROM sqlite_master WHERE type="table"', (err, tables) => {
  if (err) {
    console.error('테이블 목록 조회 오류:', err.message);
  } else {
    console.log('테이블 목록:', tables.map(t => t.name));
  }
  
  // execution_history 테이블 구조 확인
  db.all("PRAGMA table_info(execution_history)", (err, columns) => {
    if (err) {
      console.error('execution_history 테이블 구조 조회 오류:', err.message);
    } else {
      console.log('execution_history 테이블 구조:', columns);
    }
    
    // 데이터 확인
    db.all('SELECT * FROM execution_history LIMIT 5', (err, rows) => {
      if (err) {
        console.error('execution_history 데이터 조회 오류:', err.message);
      } else {
        console.log('execution_history 데이터:', rows);
      }
      db.close();
    });
  });
}); 