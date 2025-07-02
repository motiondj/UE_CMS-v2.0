const fs = require('fs');

// app.js 파일 읽기
const content = fs.readFileSync('app.js', 'utf8');

// JOIN 쿼리 수정
const oldQuery = `LEFT JOIN client_power_info cpi ON c.id = cpi.client_id`;
const newQuery = `LEFT JOIN (
      SELECT client_id, mac_address, updated_at 
      FROM client_power_info cpi1 
      WHERE updated_at = (
        SELECT MAX(updated_at) 
        FROM client_power_info cpi2 
        WHERE cpi2.client_id = cpi1.client_id
      )
    ) cpi ON c.id = cpi.client_id`;

const newContent = content.replace(oldQuery, newQuery);

// 파일 저장
fs.writeFileSync('app.js', newContent);

console.log('✅ MAC 주소 쿼리 수정 완료');
console.log('이제 각 클라이언트의 가장 최근 MAC 주소만 가져옵니다.'); 