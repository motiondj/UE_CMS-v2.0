const db = require('../config/database');

class GroupModel {
  // 모든 그룹 조회 (클라이언트 정보 포함)
  static async findAll() {
    const groups = await db.all('SELECT * FROM groups ORDER BY created_at DESC');
    
    // 각 그룹의 클라이언트 정보 조회
    for (const group of groups) {
      group.clients = await this.getGroupClients(group.id);
    }
    
    return groups;
  }

  // ID로 그룹 조회
  static async findById(id) {
    const group = await db.get('SELECT * FROM groups WHERE id = ?', [id]);
    if (group) {
      group.clients = await this.getGroupClients(id);
    }
    return group;
  }

  // 그룹의 클라이언트 조회
  static async getGroupClients(groupId) {
    const query = `
      SELECT c.id, c.name, c.ip_address, c.status, c.last_seen
      FROM group_clients gc
      JOIN clients c ON gc.client_id = c.id
      WHERE gc.group_id = ?
      ORDER BY c.name
    `;
    
    return await db.all(query, [groupId]);
  }

  // 그룹 생성
  static async create(data) {
    const { name, description, client_ids = [] } = data;
    
    return await db.transaction(async () => {
      // 그룹 생성
      const result = await db.run(
        'INSERT INTO groups (name, description) VALUES (?, ?)',
        [name, description]
      );
      
      const groupId = result.lastID;
      
      // 클라이언트 연결
      for (const clientId of client_ids) {
        await db.run(
          'INSERT INTO group_clients (group_id, client_id) VALUES (?, ?)',
          [groupId, clientId]
        );
      }
      
      return await this.findById(groupId);
    });
  }

  // 그룹 업데이트
  static async update(id, data) {
    const { name, description, client_ids = [] } = data;
    
    return await db.transaction(async () => {
      // 그룹 정보 업데이트
      await db.run(
        'UPDATE groups SET name = ?, description = ? WHERE id = ?',
        [name, description, id]
      );
      
      // 기존 클라이언트 연결 삭제
      await db.run('DELETE FROM group_clients WHERE group_id = ?', [id]);
      
      // 새 클라이언트 연결 추가
      for (const clientId of client_ids) {
        await db.run(
          'INSERT INTO group_clients (group_id, client_id) VALUES (?, ?)',
          [id, clientId]
        );
      }
      
      return await this.findById(id);
    });
  }

  // 그룹 삭제
  static async delete(id) {
    return await db.transaction(async () => {
      // 그룹-클라이언트 연결 삭제
      await db.run('DELETE FROM group_clients WHERE group_id = ?', [id]);
      
      // 그룹 삭제
      const result = await db.run('DELETE FROM groups WHERE id = ?', [id]);
      
      return result.changes > 0;
    });
  }

  // 클라이언트가 속한 그룹들 조회
  static async findByClientId(clientId) {
    const query = `
      SELECT g.*
      FROM groups g
      JOIN group_clients gc ON g.id = gc.group_id
      WHERE gc.client_id = ?
      ORDER BY g.name
    `;
    
    return await db.all(query, [clientId]);
  }
}

module.exports = GroupModel; 