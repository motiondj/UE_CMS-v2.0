const db = require('./config/database');

async function fixClientNames() {
  try {
    console.log('클라이언트 이름 정규화 시작...');
    
    // 현재 클라이언트 목록 조회
    const clients = await new Promise((resolve, reject) => {
      db.all('SELECT id, name FROM clients', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('현재 클라이언트 목록:', clients);
    
    // 각 클라이언트의 이름을 대문자로 업데이트
    for (const client of clients) {
      if (client.name) {
        const normalizedName = client.name.toUpperCase();
        
        if (normalizedName !== client.name) {
          console.log(`클라이언트 이름 업데이트: ${client.name} -> ${normalizedName}`);
          
          await new Promise((resolve, reject) => {
            db.run('UPDATE clients SET name = ? WHERE id = ?', [normalizedName, client.id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }
    }
    
    // 업데이트 후 클라이언트 목록 다시 조회
    const updatedClients = await new Promise((resolve, reject) => {
      db.all('SELECT id, name FROM clients', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('업데이트 후 클라이언트 목록:', updatedClients);
    console.log('클라이언트 이름 정규화 완료!');
    
  } catch (error) {
    console.error('클라이언트 이름 정규화 실패:', error);
  } finally {
    db.close();
  }
}

fixClientNames(); 