const db = require('../config/database');

class ClientModel {
  // 모든 클라이언트 조회 (MAC 주소 포함)
  static async findAll() {
    const query = `
      SELECT 
        c.*,
        cpi.mac_address,
        cpi.is_manual as mac_is_manual
      FROM clients c
      LEFT JOIN (
        SELECT client_id, mac_address, is_manual, updated_at 
        FROM client_power_info cpi1 
        WHERE updated_at = (
          SELECT MAX(updated_at) 
          FROM client_power_info cpi2 
          WHERE cpi2.client_id = cpi1.client_id
        )
      ) cpi ON c.id = cpi.client_id
      ORDER BY c.id
    `;
    
    return await db.all(query);
  }

  // ID로 클라이언트 조회
  static async findById(id) {
    return await db.get('SELECT * FROM clients WHERE id = ?', [id]);
  }

  // 이름으로 클라이언트 조회
  static async findByName(name) {
    return await db.get('SELECT * FROM clients WHERE name = ?', [name]);
  }

  // IP로 클라이언트 조회
  static async findByIP(ip) {
    return await db.get('SELECT * FROM clients WHERE ip_address = ?', [ip]);
  }

  // 클라이언트 생성
  static async create(data) {
    const { name, ip_address, port = 8081 } = data;
    
    return await db.transaction(async () => {
      // 같은 이름의 기존 클라이언트 삭제
      await db.run('DELETE FROM clients WHERE name = ?', [name]);
      
      // 새 클라이언트 생성
      const result = await db.run(
        'INSERT INTO clients (name, ip_address, port, status) VALUES (?, ?, ?, ?)',
        [name, ip_address, port, 'online']
      );
      
      if (result && result.lastID) {
        return await this.findById(result.lastID);
      } else {
        throw new Error('클라이언트 생성 실패: lastID를 가져올 수 없습니다.');
      }
    });
  }

  // 클라이언트 업데이트
  static async update(id, data) {
    const { name, ip_address, port } = data;
    
    // 기존 클라이언트 조회
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('클라이언트를 찾을 수 없습니다.');
    }

    // 업데이트
    await db.run(
      'UPDATE clients SET name = ?, ip_address = ?, port = ? WHERE id = ?',
      [name, ip_address, port, id]
    );

    // 이름이 변경된 경우 히스토리 저장
    if (name !== existing.name) {
      await db.run(
        'INSERT OR REPLACE INTO ip_name_history (ip_address, user_modified_name, original_name, last_used) VALUES (?, ?, ?, datetime("now"))',
        [ip_address, name, existing.name]
      );
    }

    return await this.findById(id);
  }

  // 클라이언트 삭제
  static async delete(id) {
    return await db.transaction(async () => {
      const client = await this.findById(id);
      if (!client) {
        throw new Error('클라이언트를 찾을 수 없습니다.');
      }

      // 관련 데이터 삭제 (CASCADE 설정으로 자동 처리)
      const result = await db.run('DELETE FROM clients WHERE id = ?', [id]);
      
      return result.changes > 0;
    });
  }

  // 상태 업데이트
  static async updateStatus(id, status) {
    const result = await db.run(
      'UPDATE clients SET status = ?, last_seen = datetime("now") WHERE id = ?',
      [status, id]
    );
    
    return result.changes > 0;
  }

  // 하트비트 업데이트
  static async updateHeartbeat(name, ip_address, port = 8081) {
    // 기존 클라이언트 확인
    let client = await this.findByName(name) || await this.findByIP(ip_address);
    
    if (client) {
      // 기존 클라이언트 업데이트
      await db.run(
        'UPDATE clients SET ip_address = ?, port = ?, status = ?, last_seen = datetime("now") WHERE id = ?',
        [ip_address, port, 'online', client.id]
      );
      return await this.findById(client.id);
    } else {
      // 새 클라이언트 자동 등록
      return await this.create({ name, ip_address, port });
    }
  }

  // MAC 주소 업데이트
  static async updateMacAddress(id, macAddress, isManual = false) {
    // 기존 MAC 주소 정보 확인
    const existing = await db.get(
      'SELECT mac_address, is_manual FROM client_power_info WHERE client_id = ?',
      [id]
    );
    
    // 수동 입력된 MAC 주소가 있으면 자동 수집으로 덮어쓰지 않음
    if (existing && existing.is_manual && !isManual) {
      return {
        success: false,
        message: '수동 입력된 MAC 주소가 있어 자동 수집 MAC 주소를 무시합니다.',
        mac_address: existing.mac_address,
        is_manual: true
      };
    }
    
    // MAC 주소 저장 또는 업데이트
    await db.run(
      'INSERT OR REPLACE INTO client_power_info (client_id, mac_address, updated_at, is_manual) VALUES (?, ?, datetime("now"), ?)',
      [id, macAddress, isManual ? 1 : 0]
    );
    
    // IP 주소 히스토리에도 저장
    const client = await this.findById(id);
    if (client) {
      await db.run(
        'INSERT OR REPLACE INTO ip_mac_history (ip_address, mac_address, is_manual, last_used) VALUES (?, ?, ?, datetime("now"))',
        [client.ip_address, macAddress, isManual ? 1 : 0]
      );
    }
    
    return {
      success: true,
      message: 'MAC 주소가 업데이트되었습니다.',
      mac_address: macAddress,
      is_manual: isManual
    };
  }

  // 온라인 클라이언트 조회
  static async findOnlineClients() {
    return await db.all(
      'SELECT * FROM clients WHERE status IN ("online", "running") ORDER BY name'
    );
  }

  // 오프라인 처리 (문서 4번 정확히 따름)
  static async markOfflineByTimeout(timeoutMs = 300000) {  // 5분으로 증가
    const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();
    
    // 더 엄격한 조건으로 변경 - 정말 오래된 것만 오프라인 처리
    const result = await db.run(
      `UPDATE clients 
       SET status = "offline" 
       WHERE status = "online" 
       AND last_seen < ? 
       AND last_seen IS NOT NULL`,  // NULL 체크 추가
      [cutoffTime]
    );
    
    logger.info(`하트비트 타임아웃으로 ${result.changes}개 클라이언트 오프라인 처리`);
    return result.changes;
  }
}

module.exports = ClientModel; 