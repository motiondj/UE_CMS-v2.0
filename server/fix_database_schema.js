const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 데이터베이스 파일 경로
const dbPath = path.join(__dirname, 'db', 'ue_cms.db');

console.log('🔧 데이터베이스 스키마 수정 시작...');
console.log(`📁 데이터베이스 경로: ${dbPath}`);

// 데이터베이스 파일 존재 확인
if (!fs.existsSync(dbPath)) {
    console.error('❌ 데이터베이스 파일을 찾을 수 없습니다:', dbPath);
    process.exit(1);
}

// 데이터베이스 연결
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 데이터베이스 연결 실패:', err.message);
        process.exit(1);
    }
    console.log('✅ 데이터베이스 연결 성공');
});

// 테이블 스키마 수정 함수
async function fixDatabaseSchema() {
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
            
            // 누락된 컬럼 추가
            const addColumnPromises = missingColumns.map(columnName => {
                return new Promise((resolveCol, rejectCol) => {
                    let sql;
                    let defaultValue;
                    
                    if (columnName === 'updated_at') {
                        sql = "ALTER TABLE clients ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP";
                    } else if (columnName === 'status_changed_at') {
                        sql = "ALTER TABLE clients ADD COLUMN status_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP";
                    }
                    
                    console.log(`  ➕ ${columnName} 컬럼 추가: ${sql}`);
                    
                    db.run(sql, (err) => {
                        if (err) {
                            console.error(`❌ ${columnName} 컬럼 추가 실패:`, err.message);
                            rejectCol(err);
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
                    
                    // 기존 데이터에 대해 기본값 설정
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
                            
                            // 최종 확인
                            console.log('\n📋 수정된 테이블 구조 확인...');
                            db.all("PRAGMA table_info(clients)", (err, finalColumns) => {
                                if (err) {
                                    console.error('❌ 최종 확인 실패:', err.message);
                                    reject(err);
                                    return;
                                }
                                
                                console.log('📊 최종 clients 테이블 컬럼:');
                                finalColumns.forEach(col => {
                                    console.log(`  - ${col.name} (${col.type})`);
                                });
                                
                                console.log('\n🎉 데이터베이스 스키마 수정 완료!');
                                resolve();
                            });
                        }
                    });
                })
                .catch(reject);
        });
    });
}

// 실행
fixDatabaseSchema()
    .then(() => {
        console.log('\n✅ 스키마 수정이 성공적으로 완료되었습니다.');
        console.log('🔄 서버를 재시작해주세요.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ 스키마 수정 중 오류 발생:', err.message);
        process.exit(1);
    })
    .finally(() => {
        db.close((err) => {
            if (err) {
                console.error('❌ 데이터베이스 연결 종료 실패:', err.message);
            } else {
                console.log('🔌 데이터베이스 연결 종료');
            }
        });
    }); 