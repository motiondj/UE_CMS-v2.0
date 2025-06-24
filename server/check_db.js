const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'switchboard.db');
const db = new sqlite3.Database(dbPath);

console.log('=== Switchboard Plus v2.0 Database Check ===\n');

// 테이블 목록 확인
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('테이블 목록 조회 실패:', err);
    return;
  }
  
  console.log('📋 데이터베이스 테이블 목록:');
  tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });
  console.log('');

  // 클라이언트 정보 확인
  db.all("SELECT * FROM clients ORDER BY id", (err, clients) => {
    if (err) {
      console.error('클라이언트 조회 실패:', err);
      return;
    }
    
    console.log('🖥️ 클라이언트 정보:');
    clients.forEach(client => {
      console.log(`  ID: ${client.id}, 이름: ${client.name}, IP: ${client.ip_address}, 상태: ${client.status}`);
      console.log(`  마지막 접속: ${client.last_seen || '없음'}`);
      console.log('');
    });

    // 그룹 정보 확인
    db.all("SELECT * FROM groups ORDER BY id", (err, groups) => {
      if (err) {
        console.error('그룹 조회 실패:', err);
        return;
      }
      
      console.log('👥 그룹 정보:');
      groups.forEach(group => {
        console.log(`  ID: ${group.id}, 이름: ${group.name}`);
      });
      console.log('');

      // 그룹-클라이언트 연결 확인
      db.all(`
        SELECT g.name as group_name, c.name as client_name, c.status as client_status
        FROM group_clients gc
        JOIN groups g ON gc.group_id = g.id
        JOIN clients c ON gc.client_id = c.id
        ORDER BY g.id, c.id
      `, (err, groupClients) => {
        if (err) {
          console.error('그룹-클라이언트 연결 조회 실패:', err);
          return;
        }
        
        console.log('🔗 그룹-클라이언트 연결:');
        groupClients.forEach(row => {
          console.log(`  그룹: ${row.group_name} -> 클라이언트: ${row.client_name} (상태: ${row.client_status})`);
        });
        console.log('');

        // 프리셋 정보 확인
        db.all("SELECT * FROM presets ORDER BY id", (err, presets) => {
          if (err) {
            console.error('프리셋 조회 실패:', err);
            return;
          }
          
          console.log('🎯 프리셋 정보:');
          presets.forEach(preset => {
            console.log(`  ID: ${preset.id}, 이름: ${preset.name}, 타겟 그룹 ID: ${preset.target_group_id}`);
            console.log(`  설명: ${preset.description || '없음'}`);
            console.log(`  활성화: ${preset.is_active ? '예' : '아니오'}`);
            console.log('');
          });

          // 프리셋별 클라이언트 상태 확인
          presets.forEach(preset => {
            if (preset.target_group_id) {
              db.all(`
                SELECT c.name as client_name, c.status as client_status
                FROM clients c
                JOIN group_clients gc ON c.id = gc.client_id
                WHERE gc.group_id = ?
                ORDER BY c.id
              `, [preset.target_group_id], (err, presetClients) => {
                if (err) {
                  console.error(`프리셋 ${preset.name} 클라이언트 조회 실패:`, err);
                  return;
                }
                
                console.log(`🎯 프리셋 "${preset.name}" 클라이언트 상태:`);
                if (presetClients.length === 0) {
                  console.log('  연결된 클라이언트 없음');
                } else {
                  presetClients.forEach(client => {
                    console.log(`  - ${client.client_name}: ${client.client_status}`);
                  });
                }
                console.log('');
              });
            }
          });

          // 3초 후 데이터베이스 연결 종료
          setTimeout(() => {
            db.close();
            console.log('✅ 데이터베이스 연결 종료');
          }, 3000);
        });
      });
    });
  });
}); 