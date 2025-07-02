const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const path = require('path');
const config = require('./server');

class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    const dbPath = path.resolve(config.database.filename);
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('데이터베이스 연결 실패:', err);
          reject(err);
        } else {
          console.log('✅ SQLite 데이터베이스 연결 성공');
          this.setupPromisifiedMethods();
          this.optimizeDatabase();
          this.isInitialized = true;
          resolve();
        }
      });
    });
  }

  setupPromisifiedMethods() {
    // run 메서드를 직접 Promise로 감싸서 Statement 객체 반환
    this.run = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this); // Statement 객체 반환 (lastID, changes 포함)
          }
        });
      });
    };
    
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));
    this.exec = promisify(this.db.exec.bind(this.db));
  }

  async optimizeDatabase() {
    try {
      await this.run('PRAGMA journal_mode = WAL');
      await this.run('PRAGMA synchronous = NORMAL');
      await this.run('PRAGMA cache_size = 10000');
      await this.run('PRAGMA temp_store = MEMORY');
      await this.run('PRAGMA mmap_size = 30000000000');
      console.log('✅ 데이터베이스 최적화 완료');
    } catch (error) {
      console.error('데이터베이스 최적화 실패:', error);
    }
  }

  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ 데이터베이스 연결 종료');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  // 헬퍼 메서드들
  async exists(table, conditions) {
    const keys = Object.keys(conditions);
    const where = keys.map(k => `${k} = ?`).join(' AND ');
    const values = keys.map(k => conditions[k]);
    
    const result = await this.get(
      `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`,
      values
    );
    
    return result.count > 0;
  }

  async insert(table, data) {
    const keys = Object.keys(data);
    const values = keys.map(k => data[k]);
    const placeholders = keys.map(() => '?').join(', ');
    
    const result = await this.run(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );
    
    return result.lastID;
  }

  async update(table, data, conditions) {
    const dataKeys = Object.keys(data);
    const setClause = dataKeys.map(k => `${k} = ?`).join(', ');
    const dataValues = dataKeys.map(k => data[k]);
    
    const condKeys = Object.keys(conditions);
    const whereClause = condKeys.map(k => `${k} = ?`).join(' AND ');
    const condValues = condKeys.map(k => conditions[k]);
    
    const result = await this.run(
      `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
      [...dataValues, ...condValues]
    );
    
    return result.changes;
  }

  async delete(table, conditions) {
    const keys = Object.keys(conditions);
    const where = keys.map(k => `${k} = ?`).join(' AND ');
    const values = keys.map(k => conditions[k]);
    
    const result = await this.run(
      `DELETE FROM ${table} WHERE ${where}`,
      values
    );
    
    return result.changes;
  }
}

module.exports = new Database(); 