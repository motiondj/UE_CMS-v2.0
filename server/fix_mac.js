const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('ue_cms.db');

console.log('=== MAC 주소 수정 ===');

// 현재 클라이언트 정보 확인
db.get('SELECT * FROM clients WHERE name = ?', ['motiondjHome'], (err, client) => {
  if (err) {
    console.error('클라이언트 조회 오류:', err);
    db.close();
    return;
  }
  
  if (!client) {
    console.error('클라이언트를 찾을 수 없습니다.');
    db.close();
    return;
  }
  
  console.log('현재 클라이언트:', client);
  
  // 기존 MAC 주소 정보 확인
  db.get('SELECT * FROM client_power_info WHERE client_id = ?', [client.id], (err, powerInfo) => {
    if (err) {
      console.error('MAC 주소 조회 오류:', err);
      db.close();
      return;
    }
    
    console.log('현재 MAC 주소 정보:', powerInfo);
    
    // MAC 주소가 없으면 이전 ID에서 가져와서 현재 ID에 저장
    if (!powerInfo) {
      db.get('SELECT * FROM client_power_info WHERE mac_address = ?', ['60-83-E7-30-14-24'], (err, oldPowerInfo) => {
        if (err) {
          console.error('이전 MAC 주소 조회 오류:', err);
          db.close();
          return;
        }
        
        if (oldPowerInfo) {
          console.log('이전 MAC 주소 정보:', oldPowerInfo);
          
          // 현재 클라이언트 ID에 MAC 주소 저장
          db.run(
            'INSERT OR REPLACE INTO client_power_info (client_id, mac_address, updated_at, is_manual) VALUES (?, ?, datetime("now"), ?)',
            [client.id, oldPowerInfo.mac_address, oldPowerInfo.is_manual],
            function(err) {
              if (err) {
                console.error('MAC 주소 저장 오류:', err);
              } else {
                console.log(`✅ MAC 주소 수정 완료: 클라이언트 ID ${client.id}에 MAC 주소 ${oldPowerInfo.mac_address} 저장`);
              }
              db.close();
            }
          );
        } else {
          console.log('이전 MAC 주소 정보를 찾을 수 없습니다.');
          db.close();
        }
      });
    } else {
      console.log('MAC 주소가 이미 올바르게 설정되어 있습니다.');
      db.close();
    }
  });
}); 