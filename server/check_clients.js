const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ue_cms.db');
const db = new sqlite3.Database(dbPath);

console.log('데이터베이스 연결...');

db.all('SELECT id, name, status FROM clients', [], (err, rows) => {
  if (err) {
    console.error('오류:', err);
  } else {
    console.log('클라이언트 목록:');
    console.table(rows);
  }
  
  db.close();
}); 