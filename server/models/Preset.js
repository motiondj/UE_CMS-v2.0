const db = require('../config/database');

class PresetModel {
  // 모든 프리셋 조회
  static async findAll() {
    const query = `
      SELECT p.*, g.name as group_name 
      FROM presets p
      LEFT JOIN groups g ON p.target_group_id = g.id
      ORDER BY p.created_at DESC
    `;
    
    const presets = await db.all(query);
    
    // client_commands JSON 파싱
    return presets.map(preset => ({
      ...preset,
      client_commands: preset.client_commands ? JSON.parse(preset.client_commands) : {}
    }));
  }

  // ID로 프리셋 조회
  static async findById(id) {
    const query = `
      SELECT p.*, g.name as group_name 
      FROM presets p
      LEFT JOIN groups g ON p.target_group_id = g.id
      WHERE p.id = ?
    `;
    
    const preset = await db.get(query, [id]);
    
    if (preset) {
      preset.client_commands = preset.client_commands ? 
        JSON.parse(preset.client_commands) : {};
    }
    
    return preset;
  }

  // 프리셋 생성
  static async create(data) {
    const { name, description, target_group_id, client_commands } = data;
    
    const clientCommandsJson = JSON.stringify(client_commands);
    
    const result = await db.run(
      'INSERT INTO presets (name, description, target_group_id, client_commands) VALUES (?, ?, ?, ?)',
      [name, description, target_group_id, clientCommandsJson]
    );
    
    return await this.findById(result.lastID);
  }

  // 프리셋 업데이트
  static async update(id, data) {
    const { name, description, target_group_id, client_commands } = data;
    
    const clientCommandsJson = JSON.stringify(client_commands);
    
    const result = await db.run(
      'UPDATE presets SET name = ?, description = ?, target_group_id = ?, client_commands = ? WHERE id = ?',
      [name, description, target_group_id, clientCommandsJson, id]
    );
    
    if (result.changes === 0) {
      throw new Error('프리셋을 찾을 수 없습니다.');
    }
    
    return await this.findById(id);
  }

  // 프리셋 삭제
  static async delete(id) {
    const result = await db.run('DELETE FROM presets WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // 프리셋 대상 클라이언트 조회
  static async getTargetClients(id) {
    const preset = await this.findById(id);
    if (!preset || !preset.target_group_id) {
      return [];
    }
    
    const query = `
      SELECT c.*
      FROM clients c
      JOIN group_clients gc ON c.id = gc.client_id
      WHERE gc.group_id = ?
    `;
    
    return await db.all(query, [preset.target_group_id]);
  }

  // 프리셋 실행 이력 추가
  static async addExecutionHistory(presetId, clientId, status) {
    await db.run(
      'INSERT INTO execution_history (preset_id, client_id, status) VALUES (?, ?, ?)',
      [presetId, clientId, status]
    );
  }
}

module.exports = PresetModel; 