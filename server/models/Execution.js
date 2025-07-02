const db = require('../config/database');

class ExecutionModel {
  // 실행 이력 조회
  static async findAll(limit = 50) {
    const query = `
      SELECT 
        eh.id,
        eh.status,
        eh.executed_at,
        p.name as preset_name,
        c.name as client_name
      FROM execution_history eh
      LEFT JOIN presets p ON eh.preset_id = p.id
      LEFT JOIN clients c ON eh.client_id = c.id
      ORDER BY eh.executed_at DESC
      LIMIT ?
    `;
    
    return await db.all(query, [limit]);
  }

  // 프리셋별 실행 이력
  static async findByPresetId(presetId, limit = 100) {
    const query = `
      SELECT eh.*, c.name as client_name
      FROM execution_history eh
      JOIN clients c ON eh.client_id = c.id
      WHERE eh.preset_id = ?
      ORDER BY eh.executed_at DESC
      LIMIT ?
    `;
    
    return await db.all(query, [presetId, limit]);
  }

  // 클라이언트별 실행 이력
  static async findByClientId(clientId, limit = 100) {
    const query = `
      SELECT eh.*, p.name as preset_name
      FROM execution_history eh
      JOIN presets p ON eh.preset_id = p.id
      WHERE eh.client_id = ?
      ORDER BY eh.executed_at DESC
      LIMIT ?
    `;
    
    return await db.all(query, [clientId, limit]);
  }

  // 실행 기록 생성
  static async create(presetId, clientId, status) {
    const result = await db.run(
      'INSERT INTO execution_history (preset_id, client_id, status) VALUES (?, ?, ?)',
      [presetId, clientId, status]
    );
    
    return result.lastID;
  }

  // 실행 상태 업데이트
  static async updateStatus(id, status, result = null) {
    await db.run(
      'UPDATE execution_history SET status = ?, result = ? WHERE id = ?',
      [status, result, id]
    );
  }

  // 통계 조회
  static async getStatistics() {
    const stats = {};
    
    // 전체 실행 수
    const totalResult = await db.get(
      'SELECT COUNT(*) as total FROM execution_history'
    );
    stats.total = totalResult.total;
    
    // 상태별 실행 수
    const statusResult = await db.all(`
      SELECT status, COUNT(*) as count 
      FROM execution_history 
      GROUP BY status
    `);
    stats.byStatus = statusResult.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});
    
    // 최근 24시간 실행 수
    const recentResult = await db.get(`
      SELECT COUNT(*) as recent 
      FROM execution_history 
      WHERE executed_at > datetime('now', '-24 hours')
    `);
    stats.recent24Hours = recentResult.recent;
    
    return stats;
  }
}

module.exports = ExecutionModel; 