const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('ue_cms.db');

console.log('🔧 데이터베이스 스키마 수정 및 확인 시작...');

// 데이터베이스 스키마 수정 함수
function fixDatabaseSchema() {
  return new Promise((resolve, reject) => {
    console.log('\n📋 현재 테이블 구조 확인 중...');
    
    // clients 테이블 구조 확인
    db.all("PRAGMA table_info(clients)", (err, columns) => {
      if (err) {
        console.error('❌ 테이블 정보 조회 실패:', err.message);
        reject(err);
        return;
      }
      
      console.log('📊 clients 테이블 컬럼:');
      columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
      });
      
      const columnNames = columns.map(col => col.name);
      const missingColumns = [];
      
      // 누락된 컬럼 확인
      if (!columnNames.includes('updated_at')) {
        missingColumns.push('updated_at');
      }
      if (!columnNames.includes('status_changed_at')) {
        missingColumns.push('status_changed_at');
      }
      
      if (missingColumns.length === 0) {
        console.log('✅ 모든 필요한 컬럼이 이미 존재합니다.');
        resolve();
        return;
      }
      
      console.log(`\n🔧 누락된 컬럼 발견: ${missingColumns.join(', ')}`);
      console.log('📝 컬럼 추가 중...');
      
      // 누락된 컬럼 추가 (DEFAULT 없이)
      const addColumnPromises = missingColumns.map(columnName => {
        return new Promise((resolveCol, rejectCol) => {
          let sql;
          if (columnName === 'updated_at') {
            sql = "ALTER TABLE clients ADD COLUMN updated_at DATETIME";
          } else if (columnName === 'status_changed_at') {
            sql = "ALTER TABLE clients ADD COLUMN status_changed_at DATETIME";
          }
          console.log(`  ➕ ${columnName} 컬럼 추가: ${sql}`);
          db.run(sql, (err) => {
            if (err) {
              // 이미 컬럼이 있으면 무시
              if (err.message && err.message.includes('duplicate column name')) {
                console.log(`⚠️ ${columnName} 컬럼이 이미 존재합니다. (무시)`);
                resolveCol();
              } else {
                console.error(`❌ ${columnName} 컬럼 추가 실패:`, err.message);
                rejectCol(err);
              }
            } else {
              console.log(`✅ ${columnName} 컬럼 추가 완료`);
              resolveCol();
            }
          });
        });
      });
      
      Promise.all(addColumnPromises)
        .then(() => {
          console.log('\n✅ 모든 컬럼 추가 완료');
          // 기존 데이터에 대해 CURRENT_TIMESTAMP로 값 입력
          console.log('🔄 기존 데이터 업데이트 중...');
          const updateSql = `
            UPDATE clients 
            SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP),
                status_changed_at = COALESCE(status_changed_at, CURRENT_TIMESTAMP)
            WHERE updated_at IS NULL OR status_changed_at IS NULL
          `;
          db.run(updateSql, function(err) {
            if (err) {
              console.error('❌ 기존 데이터 업데이트 실패:', err.message);
              reject(err);
            } else {
              console.log(`✅ ${this.changes}개 행 업데이트 완료`);
              resolve();
            }
          });
        })
        .catch(reject);
    });
  });
}

// 메인 실행 함수
async function main() {
  try {
    // 스키마 수정
    await fixDatabaseSchema();
    
    console.log('\n=== 데이터베이스 내용 확인 ===');

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
      
      // 최종 확인
      console.log('\n📋 수정된 테이블 구조 확인...');
      db.all("PRAGMA table_info(clients)", (err, finalColumns) => {
        if (err) {
          console.error('❌ 최종 확인 실패:', err.message);
          return;
        }
        
        console.log('📊 최종 clients 테이블 컬럼:');
        finalColumns.forEach(col => {
          console.log(`  - ${col.name} (${col.type})`);
        });
        
        console.log('\n🎉 데이터베이스 스키마 수정 완료!');
        console.log('🔄 서버를 재시작해주세요.');
        
        // 데이터베이스 연결 종료
        db.close();
      });
    });
    
  } catch (error) {
    console.error('\n❌ 스키마 수정 중 오류 발생:', error.message);
    db.close();
  }
}

// 실행
main(); 