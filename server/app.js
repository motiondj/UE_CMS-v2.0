const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 데이터베이스 초기화
const db = new sqlite3.Database('./switchboard.db', (err) => {
  if (err) {
    console.error('데이터베이스 연결 오류:', err.message);
  } else {
    console.log('SQLite 데이터베이스에 연결되었습니다.');
    initializeDatabase();
    checkDatabaseIntegrity();
  }
});

// 데이터베이스 테이블 초기화
function initializeDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      port INTEGER DEFAULT 8081,
      status TEXT DEFAULT 'offline',
      current_preset_id INTEGER DEFAULT NULL,
      last_seen DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_preset_id) REFERENCES presets (id)
    )`,
    `CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS group_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
      UNIQUE(group_id, client_id)
    )`,
    `CREATE TABLE IF NOT EXISTS presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      target_group_id INTEGER,
      client_commands TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_group_id) REFERENCES groups (id)
    )`,
    `CREATE TABLE IF NOT EXISTS execution_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preset_id INTEGER,
      client_id INTEGER,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preset_id) REFERENCES presets (id),
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )`,
    `CREATE TABLE IF NOT EXISTS client_group_backup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      group_ids TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  tables.forEach(table => {
    db.run(table, (err) => {
      if (err) {
        console.error('테이블 생성 오류:', err.message);
      }
    });
  });
}

// 데이터베이스 무결성 검사 및 복구
function checkDatabaseIntegrity() {
  console.log('🔍 데이터베이스 무결성 검사 중...');
  
  // 1. 존재하지 않는 클라이언트를 참조하는 그룹 연결 정리
  db.run(`
    DELETE FROM group_clients 
    WHERE client_id NOT IN (SELECT id FROM clients)
  `, function(err) {
    if (err) {
      console.error('❌ 그룹-클라이언트 연결 정리 실패:', err.message);
    } else if (this.changes > 0) {
      console.log(`✅ ${this.changes}개의 무효한 그룹-클라이언트 연결 정리됨`);
    }
  });
  
  // 2. 존재하지 않는 그룹을 참조하는 프리셋 정리
  db.run(`
    UPDATE presets 
    SET target_group_id = NULL 
    WHERE target_group_id NOT IN (SELECT id FROM groups)
  `, function(err) {
    if (err) {
      console.error('❌ 프리셋 그룹 참조 정리 실패:', err.message);
    } else if (this.changes > 0) {
      console.log(`✅ ${this.changes}개의 무효한 프리셋 그룹 참조 정리됨`);
    }
  });
  
  // 3. 존재하지 않는 클라이언트를 참조하는 실행 히스토리 정리
  db.run(`
    DELETE FROM execution_history 
    WHERE client_id NOT IN (SELECT id FROM clients)
  `, function(err) {
    if (err) {
      console.error('❌ 실행 히스토리 정리 실패:', err.message);
    } else if (this.changes > 0) {
      console.log(`✅ ${this.changes}개의 무효한 실행 히스토리 정리됨`);
    }
  });
  
  console.log('✅ 데이터베이스 무결성 검사 완료');
}

// 헬스 체크 API
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'Switchboard Plus Server v2.0'
  });
});

// 클라이언트 관리 API
app.get('/api/clients', (req, res) => {
  db.all('SELECT * FROM clients ORDER BY id', (err, clients) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(clients);
  });
});

app.post('/api/clients', (req, res) => {
  const { name, ip_address, port = 8081 } = req.body;
  
  if (!name || !ip_address) {
    res.status(400).json({ error: '이름과 IP 주소는 필수입니다.' });
    return;
  }

  db.run(
    'INSERT INTO clients (name, ip_address, port) VALUES (?, ?, ?)',
    [name, ip_address, port],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 새로 생성된 클라이언트 정보 조회
      db.get('SELECT * FROM clients WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        io.emit('client_added', row);
        res.json(row);
      });
    }
  );
});

app.put('/api/clients/:id', (req, res) => {
  const { id } = req.params;
  const { name, ip_address, port } = req.body;

  if (!name || !ip_address) {
    res.status(400).json({ error: '이름과 IP 주소는 필수입니다.' });
    return;
  }

  db.run(
    'UPDATE clients SET name = ?, ip_address = ?, port = ? WHERE id = ?',
    [name, ip_address, port, id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.get('SELECT * FROM clients WHERE id = ?', [id], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        io.emit('client_updated', row);
        res.json(row);
      });
    }
  );
});

app.delete('/api/clients/:id', (req, res) => {
  const { id } = req.params;
  
  // 트랜잭션으로 클라이언트 삭제와 그룹 연결 제거를 함께 처리
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // 1. 먼저 클라이언트 정보 조회 (삭제 전에 필요)
    db.get('SELECT * FROM clients WHERE id = ?', [id], (err, client) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      
      if (!client) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: '클라이언트를 찾을 수 없습니다.' });
      }
      
      // 3. 그룹-클라이언트 연결에서 해당 클라이언트 제거
      db.run('DELETE FROM group_clients WHERE client_id = ?', [id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: `그룹 연결 제거 실패: ${err.message}` });
        }
      });
      
      // 4. 클라이언트 삭제
      db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: '클라이언트를 찾을 수 없습니다.' });
        }
        
        // 5. 트랜잭션 커밋
        db.run('COMMIT', (err) => {
          if (err) {
            return res.status(500).json({ error: `트랜잭션 커밋 실패: ${err.message}` });
          }
          
          console.log(`🗑️ 클라이언트 삭제 완료: ${client.name} (ID: ${id})`);
          io.emit('client_deleted', { id: parseInt(id) });
          res.json({ message: '클라이언트가 삭제되었습니다.' });
        });
      });
    });
  });
});

// 그룹 관리 API
app.get('/api/groups', (req, res) => {
  const query = `
    SELECT 
      g.id, 
      g.name, 
      g.created_at,
      (
        SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'ip_address', c.ip_address, 'status', c.status, 'last_seen', c.last_seen))
        FROM group_clients gc
        JOIN clients c ON gc.client_id = c.id
        WHERE gc.group_id = g.id
        ORDER BY c.name
      ) as clients
    FROM groups g
    ORDER BY g.created_at DESC
  `;

  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // SQLite가 JSON을 문자열로 반환하므로, 파싱해줍니다.
    const groups = rows.map(row => ({
      ...row,
      clients: row.clients ? JSON.parse(row.clients) : []
    }));
    
    res.json(groups);
  });
});

app.post('/api/groups', (req, res) => {
  const { name, client_ids } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '그룹 이름은 필수입니다.' });
    return;
  }
  if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
    res.status(400).json({ error: '최소 한 개의 클라이언트를 그룹에 포함해야 합니다.' });
    return;
  }

  db.run('INSERT INTO groups (name) VALUES (?)', [name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const groupId = this.lastID;
    const stmt = db.prepare('INSERT INTO group_clients (group_id, client_id) VALUES (?, ?)');
    
    client_ids.forEach(clientId => {
      stmt.run(groupId, clientId);
    });
    
    stmt.finalize((err) => {
      if (err) {
        res.status(500).json({ error: `그룹 멤버 저장 실패: ${err.message}` });
        return;
      }

      db.get('SELECT * FROM groups WHERE id = ?', [groupId], (err, group) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 실시간 업데이트를 위해 클라이언트 정보도 함께 조회해서 보냅니다.
        const clientsQuery = `
          SELECT c.id, c.name, c.ip_address, c.status
          FROM group_clients gc
          JOIN clients c ON gc.client_id = c.id
          WHERE gc.group_id = ?
        `;
        db.all(clientsQuery, [groupId], (err, clients) => {
          if (err) {
            // 실패해도 그룹 자체는 생성되었으므로 일단 성공으로 응답합니다.
            io.emit('group_added', { ...group, clients: [] });
            res.json({ ...group, clients: [] });
            return;
          }
          io.emit('group_added', { ...group, clients: clients });
          res.json({ ...group, clients: clients });
        });
      });
    });
  });
});

app.put('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  const { name, client_ids } = req.body;

  if (!name) {
    return res.status(400).json({ error: '그룹 이름은 필수입니다.' });
  }
  if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
    return res.status(400).json({ error: '최소 한 개의 클라이언트를 그룹에 포함해야 합니다.' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // 1. 그룹 이름 업데이트
    db.run('UPDATE groups SET name = ? WHERE id = ?', [name, id], (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: `그룹 이름 업데이트 실패: ${err.message}` });
      }
    });

    // 2. 기존 그룹-클라이언트 연결 삭제
    db.run('DELETE FROM group_clients WHERE group_id = ?', [id], (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: `기존 그룹 멤버 삭제 실패: ${err.message}` });
      }
    });

    // 3. 새 그룹-클라이언트 연결 추가
    const stmt = db.prepare('INSERT INTO group_clients (group_id, client_id) VALUES (?, ?)');
    client_ids.forEach(clientId => {
      stmt.run(id, clientId);
    });
    stmt.finalize((err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: `새 그룹 멤버 저장 실패: ${err.message}` });
      }

      db.run('COMMIT', async (err) => {
        if (err) {
          return res.status(500).json({ error: `최종 커밋 실패: ${err.message}` });
        }

        // 4. 업데이트된 전체 그룹 정보 조회 후 전송
        const updatedGroupQuery = `
          SELECT g.id, g.name, g.created_at,
                 (SELECT json_group_array(json_object('id', c.id, 'name', c.name, 'ip_address', c.ip_address, 'status', c.status))
                  FROM group_clients gc JOIN clients c ON gc.client_id = c.id
                  WHERE gc.group_id = g.id) as clients
          FROM groups g
          WHERE g.id = ?
        `;
        
        db.get(updatedGroupQuery, [id], (err, row) => {
          if (err) {
            return res.status(500).json({ error: `업데이트된 그룹 정보 조회 실패: ${err.message}` });
          }
          const group = {
            ...row,
            clients: row.clients ? JSON.parse(row.clients) : []
          };
          io.emit('group_updated', group);
          res.json(group);
        });
      });
    });
  });
});

app.delete('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  
  db.serialize(() => {
    // 그룹-클라이언트 연결 먼저 삭제
    db.run('DELETE FROM group_clients WHERE group_id = ?', id);
    // 그 다음 그룹 삭제
    db.run('DELETE FROM groups WHERE id = ?', id, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
      }
      io.emit('group_deleted', { id: parseInt(id) });
      res.json({ message: '그룹이 삭제되었습니다.' });
    });
  });
});

// 실행 이력 API
app.get('/api/executions', (req, res) => {
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
    LIMIT 50
  `;
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 프리셋 API
app.get('/api/presets', (req, res) => {
  db.all(`
    SELECT p.*, g.name as group_name 
    FROM presets p
    LEFT JOIN groups g ON p.target_group_id = g.id
    ORDER BY p.id DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/presets', (req, res) => {
  console.log('[/api/presets] Received request body:', JSON.stringify(req.body, null, 2));
  const { name, description, target_group_id, client_commands } = req.body;

  if (!name || !target_group_id || !client_commands || Object.keys(client_commands).length === 0) {
    return res.status(400).json({ error: '프리셋 이름, 대상 그룹, 명령어는 필수입니다.' });
  }

  const clientCommandsJson = JSON.stringify(client_commands);

  db.run(
    'INSERT INTO presets (name, description, target_group_id, client_commands) VALUES (?, ?, ?, ?)',
    [name, description, target_group_id, clientCommandsJson],
    function (err) {
      if (err) {
        console.error('DATABASE INSERT ERROR:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ error: `이미 존재하는 프리셋 이름입니다: "${name}"` });
        }
        return res.status(500).json({ error: `프리셋 생성 실패: ${err.message}` });
      }
      const newPresetId = this.lastID;
      db.get(`
        SELECT p.*, g.name as group_name
        FROM presets p
        LEFT JOIN groups g ON p.target_group_id = g.id
        WHERE p.id = ?
      `, [newPresetId], (err, newPreset) => {
        if (err) {
          console.error('새 프리셋 조회 실패:', err);
          return res.status(201).json({ id: newPresetId, name, description, target_group_id, client_commands });
        }
        io.emit('preset_added', { ...newPreset, client_commands: JSON.parse(newPreset.client_commands || '{}') });
        res.status(201).json({ ...newPreset, client_commands: JSON.parse(newPreset.client_commands || '{}') });
      });
    }
  );
});

app.put('/api/presets/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, target_group_id, client_commands } = req.body;

  if (!name || !target_group_id || !client_commands || Object.keys(client_commands).length === 0) {
    return res.status(400).json({ error: '프리셋 이름, 대상 그룹, 명령어는 필수입니다.' });
  }

  const clientCommandsJson = JSON.stringify(client_commands);

  db.run(
    'UPDATE presets SET name = ?, description = ?, target_group_id = ?, client_commands = ? WHERE id = ?',
    [name, description, target_group_id, clientCommandsJson, id],
    function (err) {
      if (err) {
        console.error('DATABASE UPDATE ERROR:', err);
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(409).json({ error: `이미 존재하는 프리셋 이름입니다: "${name}"` });
        }
        return res.status(500).json({ error: `프리셋 업데이트 실패: ${err.message}` });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
      }
      db.get(`
        SELECT p.*, g.name as group_name
        FROM presets p
        LEFT JOIN groups g ON p.target_group_id = g.id
        WHERE p.id = ?
      `, [id], (err, updatedPreset) => {
        if (err) {
          console.error('수정된 프리셋 조회 실패:', err);
          return res.json({ message: '프리셋이 업데이트되었습니다.' });
        }
        io.emit('preset_updated', { ...updatedPreset, client_commands: JSON.parse(updatedPreset.client_commands || '{}') });
        res.json({ ...updatedPreset, client_commands: JSON.parse(updatedPreset.client_commands || '{}') });
      });
    }
  );
});

app.delete('/api/presets/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM presets WHERE id = ?', id, function(err) {
    if (err) {
      return res.status(500).json({ error: `프리셋 삭제 실패: ${err.message}` });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
    }
    io.emit('preset_deleted', { id: parseInt(id) });
    res.json({ message: '프리셋이 삭제되었습니다.' });
  });
});

// 프리셋 실행 API
app.post('/api/presets/:id/execute', (req, res) => {
  const { id } = req.params;
  console.log(`🚀 프리셋 실행 요청: ID ${id}`);
  
  // 프리셋 정보 조회
  db.get('SELECT * FROM presets WHERE id = ?', [id], (err, preset) => {
    if (err) {
      console.error(`❌ 프리셋 조회 실패: ${err.message}`);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!preset) {
      console.error(`❌ 프리셋을 찾을 수 없음: ID ${id}`);
      res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
      return;
    }
    
    console.log(`📋 프리셋 정보: ${preset.name}, 그룹 ID: ${preset.target_group_id}`);
    
    // 타겟 그룹의 클라이언트들 조회
    let query = 'SELECT c.* FROM clients c';
    let params = [];
    
    if (preset.target_group_id) {
      query += ' JOIN group_clients gc ON c.id = gc.client_id WHERE gc.group_id = ?';
      params.push(preset.target_group_id);
    }
    
    console.log(`🔍 클라이언트 조회 쿼리: ${query}, 파라미터: ${params}`);
    
    db.all(query, params, (err, clients) => {
      if (err) {
        console.error(`❌ 클라이언트 조회 실패: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      console.log(`👥 조회된 클라이언트: ${clients.length}개`);
      clients.forEach(client => {
        console.log(`  - ${client.name} (ID: ${client.id}, 상태: ${client.status})`);
      });
      
      // client_commands JSON 파싱
      let clientCommands = {};
      try {
        if (preset.client_commands) {
          clientCommands = JSON.parse(preset.client_commands);
          console.log(`📝 파싱된 명령어:`, clientCommands);
        }
      } catch (e) {
        console.error('❌ client_commands JSON 파싱 실패:', e);
        res.status(500).json({ error: '클라이언트 명령어 파싱 실패' });
        return;
      }
      
      // 클라이언트 상태 분석
      const onlineClients = clients.filter(c => c.status === 'online' || c.status === 'running');
      const offlineClients = clients.filter(c => c.status === 'offline');
      
      console.log(`📊 클라이언트 상태: 온라인 ${onlineClients.length}개, 오프라인 ${offlineClients.length}개`);
      
      // 각 클라이언트에 명령 전송
      const executionResults = [];
      const warnings = [];
      
      clients.forEach(client => {
        // 해당 클라이언트의 명령어 가져오기 (clientId를 우선적으로 사용)
        const command = clientCommands[client.id] || clientCommands[client.name] || '';
        
        console.log(`🔍 클라이언트 ${client.name} (ID: ${client.id}) 명령어 검색:`, {
          byId: clientCommands[client.id],
          byName: clientCommands[client.name],
          finalCommand: command
        });
        
        if (!command) {
          warnings.push(`클라이언트 ${client.name}에 대한 명령어가 설정되지 않았습니다.`);
          console.log(`⚠️ 클라이언트 ${client.name}에 명령어 없음`);
          return;
        }
        
        // Socket.io를 통해 클라이언트에 명령 전송
        const clientSocket = connectedClients.get(client.name);
        console.log(`🔌 클라이언트 ${client.name} 소켓 검색:`, {
          found: !!clientSocket,
          connected: clientSocket ? clientSocket.connected : false,
          socketId: clientSocket ? clientSocket.id : 'N/A'
        });
        
        if (clientSocket && clientSocket.connected) {
          clientSocket.emit('execute_command', {
            clientId: client.id,
            clientName: client.name,
            command: command,
            presetId: preset.id
          });
          console.log(`📤 클라이언트 ${client.name}에 명령 전송: ${command}`);
          
          // 클라이언트 상태를 running으로 업데이트
          db.run(
            'UPDATE clients SET status = "running", current_preset_id = ? WHERE id = ?',
            [preset.id, client.id],
            (err) => {
              if (!err) {
                console.log(`🔄 클라이언트 ${client.name} 상태를 running으로 업데이트 (프리셋 ID: ${preset.id})`);
                io.emit('client_status_changed', { 
                  name: client.name, 
                  status: 'running',
                  current_preset_id: preset.id,
                  reason: '프리셋 실행 중'
                });
              }
            }
          );
        } else {
          // 오프라인 클라이언트는 명령을 전송하지 않고 경고만 추가
          warnings.push(`클라이언트 ${client.name}가 연결되지 않았습니다.`);
          console.log(`⚠️ 오프라인 클라이언트 ${client.name} - 명령 전송 건너뜀`);
        }
        
        // 실행 히스토리 기록 (상태를 정확히 기록)
        const executionStatus = (clientSocket && clientSocket.connected) ? 'executing' : 'failed_offline';
        db.run(
          'INSERT INTO execution_history (preset_id, client_id, status) VALUES (?, ?, ?)',
          [preset.id, client.id, executionStatus],
          function(err) {
            if (!err) {
              executionResults.push({
                clientId: client.id,
                clientName: client.name,
                status: (clientSocket && clientSocket.connected) ? 'running' : 'offline',
                executionId: this.lastID
              });
            }
          }
        );
      });
      
      // 응답 데이터 구성
      const responseData = {
        message: '프리셋이 실행되었습니다.',
        preset: preset,
        clients: executionResults,
        summary: {
          total: clients.length,
          online: onlineClients.length,
          offline: offlineClients.length,
          executed: executionResults.length
        }
      };
      
      // 경고가 있으면 추가
      if (warnings.length > 0) {
        responseData.warnings = warnings;
      }
      
      // 오프라인 클라이언트가 있으면 경고 추가
      if (offlineClients.length > 0) {
        responseData.warning = `⚠️ ${offlineClients.length}개 클라이언트가 오프라인 상태입니다.`;
      }
      
      console.log(`✅ 프리셋 실행 완료: ${executionResults.length}개 클라이언트에 명령 전송`);
      
      io.emit('preset_executed', {
        presetId: preset.id,
        presetName: preset.name,
        clients: executionResults,
        warnings: warnings
      });
      
      res.json(responseData);
    });
  });
});

// 프리셋 정지 API
app.post('/api/presets/:id/stop', (req, res) => {
  const { id } = req.params;
  console.log(`🛑 프리셋 정지 요청: ID ${id}`);
  
  // 프리셋 정보 조회
  db.get('SELECT * FROM presets WHERE id = ?', [id], (err, preset) => {
    if (err) {
      console.error(`❌ 프리셋 조회 실패: ${err.message}`);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!preset) {
      console.error(`❌ 프리셋을 찾을 수 없음: ID ${id}`);
      res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
      return;
    }
    
    console.log(`📋 프리셋 정지: ${preset.name}, 그룹 ID: ${preset.target_group_id}`);
    
    // 타겟 그룹의 클라이언트들 조회
    let query = 'SELECT c.* FROM clients c';
    let params = [];
    
    if (preset.target_group_id) {
      query += ' JOIN group_clients gc ON c.id = gc.client_id WHERE gc.group_id = ?';
      params.push(preset.target_group_id);
    }
    
    db.all(query, params, (err, clients) => {
      if (err) {
        console.error(`❌ 클라이언트 조회 실패: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      console.log(`👥 정지 대상 클라이언트: ${clients.length}개`);
      
      // 각 클라이언트에 정지 명령 전송
      const stopResults = [];
      
      clients.forEach(client => {
        // Socket.io를 통해 클라이언트에 정지 명령 전송
        const clientSocket = connectedClients.get(client.name);
        
        if (clientSocket && clientSocket.connected) {
          clientSocket.emit('stop_command', {
            clientId: client.id,
            clientName: client.name,
            presetId: preset.id
          });
          console.log(`📤 클라이언트 ${client.name}에 정지 명령 전송`);
          stopResults.push({
            clientId: client.id,
            clientName: client.name,
            status: 'stopping'
          });
        } else {
          console.log(`⚠️ 오프라인 클라이언트 ${client.name} - 정지 명령 전송 건너뜀`);
        }
      });
      
      // 응답 데이터 구성
      const responseData = {
        message: '프리셋 정지 요청이 전송되었습니다.',
        preset: preset,
        clients: stopResults,
        summary: {
          total: clients.length,
          stopped: stopResults.length
        }
      };
      
      console.log(`✅ 프리셋 정지 요청 완료: ${stopResults.length}개 클라이언트에 정지 명령 전송`);
      
      io.emit('preset_stopped', {
        presetId: preset.id,
        presetName: preset.name,
        clients: stopResults
      });
      
      res.json(responseData);
    });
  });
});

// 실행 히스토리 API
app.get('/api/execution-history', (req, res) => {
  db.all(`
    SELECT eh.*, p.name as preset_name, c.name as client_name
    FROM execution_history eh
    JOIN presets p ON eh.preset_id = p.id
    JOIN clients c ON eh.client_id = c.id
    ORDER BY eh.executed_at DESC
    LIMIT 100
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// 프로세스 상태 조회 API
app.get('/api/process-status', (req, res) => {
  try {
    const processStatus = global.processStatus || new Map();
    const statusData = {};
    
    // Map을 일반 객체로 변환
    for (const [clientName, status] of processStatus) {
      statusData[clientName] = status;
    }
    
    res.json({
      success: true,
      data: statusData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 특정 클라이언트의 프로세스 상태 조회
app.get('/api/process-status/:clientName', (req, res) => {
  try {
    const { clientName } = req.params;
    const processStatus = global.processStatus || new Map();
    
    if (processStatus.has(clientName)) {
      res.json({
        success: true,
        data: processStatus.get(clientName),
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: '클라이언트의 프로세스 상태를 찾을 수 없습니다.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 프리셋 상태 판정 API (4단계 상태: 초록/파랑/노랑/빨강)
app.get('/api/presets/:id/status', (req, res) => {
  const { id } = req.params;
  console.log(`🔍 프리셋 상태 판정 요청: ID ${id}`);
  
  // 프리셋 정보 조회
  db.get('SELECT * FROM presets WHERE id = ?', [id], (err, preset) => {
    if (err) {
      console.error(`❌ 프리셋 조회 실패: ${err.message}`);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!preset) {
      console.error(`❌ 프리셋을 찾을 수 없음: ID ${id}`);
      res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
      return;
    }
    
    // 타겟 그룹의 클라이언트들 조회
    let query = 'SELECT c.* FROM clients c';
    let params = [];
    
    if (preset.target_group_id) {
      query += ' JOIN group_clients gc ON c.id = gc.client_id WHERE gc.group_id = ?';
      params.push(preset.target_group_id);
    }
    
    db.all(query, params, (err, clients) => {
      if (err) {
        console.error(`❌ 클라이언트 조회 실패: ${err.message}`);
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 각 클라이언트의 상태 판정
      const clientStatuses = [];
      let hasOfflineClient = false;
      let hasRunningClient = false;
      let hasCrashedClient = false;
      
      clients.forEach(client => {
        let status = 'ready'; // 기본값: 파랑 (실행 대기)
        let statusCode = 'blue';
        let reason = '프리셋에 등록된 온라인 클라이언트';
        
        // 1. 오프라인 체크 (노랑)
        if (client.status === 'offline') {
          status = 'warning';
          statusCode = 'yellow';
          reason = '오프라인 상태';
          hasOfflineClient = true;
        }
        // 2. 현재 프리셋 실행 중 체크 (초록) - 정확한 프리셋 확인
        else if (client.status === 'running' && client.current_preset_id === preset.id) {
          status = 'running';
          statusCode = 'green';
          reason = '현재 프리셋 실행 중';
          hasRunningClient = true;
        }
        // 3. 다른 프리셋 실행 중 체크 (파랑) - 다른 프리셋이 실행 중
        else if (client.status === 'running' && client.current_preset_id !== preset.id) {
          status = 'ready';
          statusCode = 'blue';
          reason = '다른 프리셋 실행 중';
        }
        // 4. 비정상 종료 체크 (빨강)
        else if (client.status === 'crashed') {
          status = 'crashed';
          statusCode = 'red';
          reason = '비정상 종료';
          hasCrashedClient = true;
        }
        // 5. 온라인 상태 (파랑)
        else if (client.status === 'online') {
          status = 'ready';
          statusCode = 'blue';
          reason = '실행 대기';
        }
        
        clientStatuses.push({
          clientId: client.id,
          clientName: client.name,
          status: status,
          statusCode: statusCode,
          reason: reason,
          originalStatus: client.status,
          currentPresetId: client.current_preset_id
        });
      });
      
      // 전체 프리셋 상태 판정
      let overallStatus = 'ready';
      let overallStatusCode = 'blue';
      let overallReason = '모든 클라이언트가 실행 대기 상태';
      
      if (hasCrashedClient) {
        overallStatus = 'crashed';
        overallStatusCode = 'red';
        overallReason = '비정상 종료된 클라이언트가 있음';
      } else if (hasRunningClient) {
        overallStatus = 'running';
        overallStatusCode = 'green';
        overallReason = '실행 중인 클라이언트가 있음';
      } else if (hasOfflineClient) {
        overallStatus = 'warning';
        overallStatusCode = 'yellow';
        overallReason = '오프라인 클라이언트가 있음';
      }
      
      const responseData = {
        presetId: preset.id,
        presetName: preset.name,
        overallStatus: overallStatus,
        overallStatusCode: overallStatusCode,
        overallReason: overallReason,
        clients: clientStatuses,
        summary: {
          total: clients.length,
          ready: clientStatuses.filter(c => c.status === 'ready').length,
          running: clientStatuses.filter(c => c.status === 'running').length,
          warning: clientStatuses.filter(c => c.status === 'warning').length,
          crashed: clientStatuses.filter(c => c.status === 'crashed').length
        }
      };
      
      console.log(`✅ 프리셋 상태 판정 완료: ${preset.name} - ${overallStatus} (${overallStatusCode})`);
      
      res.json(responseData);
    });
  });
});

// Socket.io 이벤트 처리
const connectedClients = new Map(); // 클라이언트 소켓 추적

function normalizeIP(ip) {
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip;
}

io.on('connection', (socket) => {
  console.log('클라이언트 연결 시도:', socket.id);

  // 클라이언트 등록 (이름 기반으로 기존 클라이언트 찾기)
  socket.on('register_client', (data) => {
    const { name, clientType = 'python' } = data;
    const clientIP = normalizeIP(socket.handshake.address || '127.0.0.1');
    
    socket.clientName = name;
    socket.clientType = clientType;
    
    console.log(`📝 클라이언트 등록 시도: ${name} (IP: ${clientIP})`);
    
    // 먼저 같은 이름의 기존 클라이언트가 있는지 확인
    db.get('SELECT * FROM clients WHERE name = ?', [name], (err, existingClient) => {
      if (err) {
        console.log(`❌ 클라이언트 조회 실패: ${name} - ${err.message}`);
        socket.emit('registration_failed', { reason: 'DB 조회 실패' });
        return;
      }
      
      if (existingClient) {
        // 같은 이름의 클라이언트가 이미 온라인 상태인지 확인
        const existingSocket = connectedClients.get(name);
        if (existingSocket && existingSocket.connected) {
          console.log(`⚠️ 같은 이름의 클라이언트(${existingClient.name})가 이미 온라인 상태입니다. 연결을 중복으로 허용하지 않습니다.`);
          socket.emit('registration_failed', { reason: '이미 온라인 상태인 클라이언트가 있습니다.' });
          
          // 소켓을 해제하지 않고 클라이언트가 자체적으로 종료하도록 함
          console.log(`✅ 중복 연결 거부 - 클라이언트 자체 종료 대기: ${name}`);
          return;
        }

        // 오프라인 상태이거나 소켓이 없는 경우 정보 업데이트
        console.log(`✅ 같은 이름의 오프라인 클라이언트 발견: ${existingClient.name} (IP: ${existingClient.ip_address} → ${clientIP})`);
        
        // 기존 소켓이 있지만 연결이 끊어진 경우에만 제거
        if (existingClient.name && connectedClients.has(existingClient.name)) {
          const oldSocket = connectedClients.get(existingClient.name);
          if (!oldSocket.connected) {
            connectedClients.delete(existingClient.name);
            console.log(`🗑️ 연결이 끊어진 기존 소켓 정보 제거: ${existingClient.name}`);
          }
        }
        
        db.run(
          'UPDATE clients SET ip_address = ?, status = ?, last_seen = CURRENT_TIMESTAMP WHERE name = ?',
          [clientIP, 'online', name],
          (err) => {
            if (!err) {
              connectedClients.set(name, socket);
              console.log(`✅ [${clientType}] 클라이언트 정보 업데이트: ${name} (IP: ${clientIP})`);
              
              const updatedClient = { ...existingClient, ip_address: clientIP, status: 'online' };
              io.emit('client_updated', updatedClient);
              io.emit('client_status_changed', { id: existingClient.id, name, status: 'online' });
            } else {
              console.log(`❌ 클라이언트 정보 업데이트 실패: ${name} - ${err.message}`);
            }
          }
        );
      } else {
        // 새 클라이언트 등록
        const clientInfo = {
          name: name,
          ip_address: clientIP,
          port: 8081,
          status: 'online'
        };
        
        db.run(
          'INSERT INTO clients (name, ip_address, port, status) VALUES (?, ?, ?, ?)',
          [clientInfo.name, clientInfo.ip_address, clientInfo.port, clientInfo.status],
          function(err) {
            if (!err) {
              const newClient = { ...clientInfo, id: this.lastID };
              connectedClients.set(name, socket);
              console.log(`✅ [${clientType}] 새 클라이언트 등록됨: ${name} (IP: ${clientIP})`);
              io.emit('client_added', newClient);
              io.emit('client_status_changed', { id: newClient.id, name, status: 'online' });
            } else {
              console.log(`❌ 새 클라이언트 등록 실패: ${name} - ${err.message}`);
            }
          }
        );
      }
    });
  });
  
  // 하트비트 응답
  socket.on('heartbeat', (data) => {
    const { name } = data;
    const now = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString();
    const clientIP = normalizeIP(socket.handshake.address || '127.0.0.1');
    
    console.log(`💓 하트비트 수신: ${name} (IP: ${clientIP}, 시간: ${timeStr}, 소켓 ID: ${socket.id})`);
    
    // 먼저 클라이언트가 데이터베이스에 있는지 확인
    db.get('SELECT * FROM clients WHERE name = ?', [name], (err, existingClient) => {
      if (err) {
        console.error(`❌ 클라이언트 조회 실패: ${name} - ${err.message}`);
        return;
      }
      
      if (existingClient) {
        // 기존 클라이언트가 있으면 상태 업데이트
        console.log(`✅ 기존 클라이언트 발견: ${name} (ID: ${existingClient.id}, 상태: ${existingClient.status})`);
        
        db.run(
          'UPDATE clients SET status = ?, last_seen = ? WHERE name = ?',
          ['online', now, name],
          (err) => {
            if (!err) {
              console.log(`💓 하트비트 업데이트 완료: ${name} (시간: ${timeStr})`);
            } else {
              console.error(`❌ 하트비트 업데이트 실패: ${name} - ${err.message}`);
            }
          }
        );
      } else {
        // 클라이언트가 데이터베이스에 없으면 자동으로 재등록
        console.log(`🔄 삭제된 클라이언트 자동 재등록 시작: ${name} (IP: ${clientIP}, 소켓 ID: ${socket.id})`);
        
        const clientInfo = {
          name: name,
          ip_address: clientIP,
          port: 8081,
          status: 'online'
        };
        
        console.log(`📝 새 클라이언트 정보:`, clientInfo);
        
        db.run(
          'INSERT INTO clients (name, ip_address, port, status) VALUES (?, ?, ?, ?)',
          [clientInfo.name, clientInfo.ip_address, clientInfo.port, clientInfo.status],
          function(err) {
            if (!err) {
              const newClient = { ...clientInfo, id: this.lastID };
              connectedClients.set(name, socket);
              socket.clientName = name;
              socket.clientType = 'python';
              
              console.log(`✅ 삭제된 클라이언트 자동 재등록 완료: ${name} (ID: ${this.lastID})`);
              console.log(`🔗 소켓 연결 정보: ${name} -> 소켓 ID ${socket.id}`);
              
              io.emit('client_added', newClient);
              io.emit('client_status_changed', { id: newClient.id, name, status: 'online' });
              
              console.log(`📡 클라이언트 추가 이벤트 전송 완료: ${name}`);
            } else {
              console.error(`❌ 삭제된 클라이언트 자동 재등록 실패: ${name} - ${err.message}`);
            }
          }
        );
      }
    });
  });
  
  // 명령 실행 결과 응답
  socket.on('execution_result', (data) => {
    const { executionId, clientName, status, result } = data;
    
    console.log(`📊 명령 실행 결과 수신: ${clientName} - ${status}`);
    
    // 실행 히스토리 업데이트
    if (executionId) {
      db.run(
        'UPDATE execution_history SET status = ? WHERE id = ?',
        [status, executionId],
        (err) => {
          if (!err) {
            console.log(`✅ 실행 히스토리 업데이트: ${executionId} -> ${status}`);
            io.emit('execution_updated', { executionId, status, result });
          }
        }
      );
    }
    
    // 클라이언트 상태를 online으로 변경 (명령 실행 완료)
    if (clientName) {
      db.run(
        'UPDATE clients SET status = "online", current_preset_id = NULL WHERE name = ?',
        [clientName],
        (err) => {
          if (!err) {
            console.log(`🔄 클라이언트 상태 변경: ${clientName} -> online (명령 실행 완료)`);
            io.emit('client_status_changed', { 
              name: clientName, 
              status: 'online',
              current_preset_id: null,
              reason: '명령 실행 완료'
            });
          }
        }
      );
    }
  });
  
  // 연결 확인 응답 처리
  socket.on('connection_check_response', (data) => {
    const { clientName } = data;
    const now = new Date().toISOString();
    
    // 응답이 오면 클라이언트가 온라인 상태임을 확인
    db.run(
      'UPDATE clients SET last_seen = ? WHERE name = ?',
      [now, clientName],
      (err) => {
        if (!err) {
          console.log(`✅ 연결 확인 응답: ${clientName} (시간: ${now})`);
        } else {
          console.error(`❌ 연결 확인 응답 업데이트 실패: ${clientName} - ${err.message}`);
        }
      }
    );
  });
  
  socket.on('disconnect', () => {
    const clientType = socket.clientType || 'Unknown';
    const clientName = socket.clientName || 'Unknown';
    
    console.log(`🔌 [${clientType}] 클라이언트 소켓 연결 해제됨: ${clientName} (ID: ${socket.id})`);
    
    if (socket.clientName) {
      // 현재 소켓이 실제로 연결이 끊어진 소켓인지 확인
      const currentSocket = connectedClients.get(socket.clientName);
      if (currentSocket && currentSocket.id === socket.id) {
        connectedClients.delete(socket.clientName);
        console.log(`🗑️ 클라이언트 소켓 제거: ${socket.clientName}`);
        
        // 즉시 오프라인으로 처리
        db.run(
          'UPDATE clients SET status = "offline" WHERE name = ?',
          [socket.clientName],
          (err) => {
            if (!err) {
              console.log(`🔄 ${socket.clientName} 즉시 오프라인으로 변경`);
              io.emit('client_status_changed', { name: socket.clientName, status: 'offline' });
            } else {
              console.error(`❌ ${socket.clientName} 오프라인 처리 실패: ${err.message}`);
            }
          }
        );
      } else {
        console.log(`⚠️ 다른 소켓이 이미 등록되어 있음 - 소켓 제거 건너뜀: ${socket.clientName}`);
      }
    }
  });

  // 클라이언트 상태 변경 이벤트 처리
  socket.on('client_status_changed', (data) => {
    console.log('📊 클라이언트 상태 변경:', data);
    setClients(prev => prev.map(client => 
      client.name === data.name 
        ? { ...client, status: data.status }
        : client
    ));
    
    // 그룹 정보도 함께 업데이트 (클라이언트 상태 변경이 그룹에 반영되도록)
    loadGroups();
  });
  
  // 프로세스 상태 업데이트 이벤트 처리
  socket.on('process_status', (data) => {
    const { clientName, clientId, runningProcesses, crashedProcesses, timestamp } = data;
    
    console.log(`🔍 프로세스 상태 업데이트: ${clientName}`);
    console.log(`  - 실행 중: ${runningProcesses.length}개`);
    console.log(`  - 비정상 종료: ${crashedProcesses.length}개`);
    
    // 프로세스 상태를 데이터베이스에 저장
    const processStatus = {
      clientName,
      clientId,
      runningProcesses,
      crashedProcesses,
      timestamp
    };
    
    // 프로세스 상태를 메모리에 저장 (실시간 상태 추적용)
    if (!global.processStatus) {
      global.processStatus = new Map();
    }
    global.processStatus.set(clientName, processStatus);
    
    // 클라이언트 상태 업데이트 로직
    let newClientStatus = 'online'; // 기본값

    // 실행 중인 프로세스가 1개라도 있으면 무조건 running
    if (runningProcesses.length > 0) {
      newClientStatus = 'running';
      console.log(`✅ ${clientName}에서 실행 중인 프로세스: ${runningProcesses.join(', ')}`);
    }
    // 실행 중인 프로세스가 없고, 비정상 종료된 프로세스가 있으면 crashed
    else if (crashedProcesses.length > 0) {
      newClientStatus = 'crashed';
      console.log(`⚠️ ${clientName}에서 비정상 종료된 프로세스: ${crashedProcesses.join(', ')}`);
    }
    // 둘 다 없으면 online
    else {
      newClientStatus = 'online';
      console.log(`📋 ${clientName} - 실행 대기 상태`);
    }
    
    // 클라이언트 상태를 데이터베이스에 업데이트
    db.run(
      'UPDATE clients SET status = ? WHERE name = ?',
      [newClientStatus, clientName],
      (err) => {
        if (!err) {
          console.log(`✅ 클라이언트 상태 업데이트: ${clientName} -> ${newClientStatus}`);
          
          // 웹 클라이언트에 상태 변경 알림
          io.emit('client_status_changed', { 
            name: clientName, 
            status: newClientStatus,
            reason: newClientStatus === 'crashed' ? '비정상 종료' : 
                   newClientStatus === 'running' ? '실행 중' : '실행 대기'
          });
        } else {
          console.error(`❌ 클라이언트 상태 업데이트 실패: ${clientName} - ${err.message}`);
        }
      }
    );
    
    // 웹 클라이언트에 프로세스 상태 변경 알림
    io.emit('process_status_updated', {
      clientName,
      runningProcesses,
      crashedProcesses,
      timestamp,
      clientStatus: newClientStatus
    });
  });
});

// 서버 주도적 클라이언트 연결 확인 (15초마다)
setInterval(() => {
  console.log('🔍 등록된 클라이언트 연결 상태 확인 중...');
  
  db.all('SELECT * FROM clients WHERE status = "online"', (err, clients) => {
    if (err) {
      console.error('클라이언트 상태 확인 오류:', err.message);
      return;
    }
    
    console.log(`📋 확인할 온라인 클라이언트: ${clients.length}개`);
    clients.forEach(client => {
      const clientSocket = connectedClients.get(client.name);
      if (clientSocket && clientSocket.connected) {
        console.log(`🔍 ${client.name} 연결 확인 요청 전송 (소켓 ID: ${clientSocket.id})`);
        clientSocket.emit('connection_check', {
          clientName: client.name,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log(`⚠️ ${client.name} 소켓이 없거나 연결되지 않음 - 오프라인으로 처리`);
        // 소켓이 없으면 바로 오프라인으로 처리
        db.run(
          'UPDATE clients SET status = "offline" WHERE name = ?',
          [client.name],
          (err) => {
            if (!err) {
              console.log(`🔄 ${client.name} 오프라인으로 변경`);
              io.emit('client_status_changed', { name: client.name, status: 'offline' });
            }
          }
        );
      }
    });
  });
}, 15000); // 15초마다

// 연결 확인에 응답하지 않는 클라이언트를 오프라인으로 처리 (30초 후)
setInterval(() => {
  const cutoffTime = new Date(Date.now() - 30000); // 30초 전
  console.log(`⏰ 오프라인 처리 기준 시간: ${cutoffTime.toISOString()}`);
  
  // 먼저 오프라인으로 변경될 클라이언트들을 조회
  db.all(
    'SELECT name, last_seen FROM clients WHERE status = "online" AND last_seen < ?',
    [cutoffTime.toISOString()],
    (err, clients) => {
      if (err) {
        console.error('오프라인 처리 조회 오류:', err.message);
        return;
      }
      
      if (clients.length > 0) {
        console.log(`📋 오프라인으로 변경될 클라이언트: ${clients.length}개`);
        const clientsToOffline = [];
        
        clients.forEach(client => {
          // 소켓이 연결된 클라이언트는 제외
          const clientSocket = connectedClients.get(client.name);
          if (!clientSocket || !clientSocket.connected) {
            clientsToOffline.push(client);
            console.log(`  - ${client.name}: last_seen = ${client.last_seen}`);
          } else {
            console.log(`  - ${client.name}: 소켓 연결됨 - 오프라인 처리 제외`);
          }
        });
        
        if (clientsToOffline.length > 0) {
          // 오프라인으로 변경
          const clientNames = clientsToOffline.map(c => c.name);
          const placeholders = clientNames.map(() => '?').join(',');
          
          db.run(
            `UPDATE clients SET status = "offline" WHERE status = "online" AND name IN (${placeholders})`,
            clientNames,
            function(err) {
              if (!err && this.changes > 0) {
                console.log(`🔄 ${this.changes}개 클라이언트를 오프라인으로 변경`);
                io.emit('clients_offline_updated');
              }
            }
          );
        } else {
          console.log('✅ 오프라인으로 변경될 클라이언트 없음');
        }
      } else {
        console.log('✅ 오프라인으로 변경될 클라이언트 없음');
      }
    }
  );
}, 30000); // 30초마다

// 기본 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Switchboard Plus Server가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📱 웹 인터페이스: http://localhost:${PORT}`);
});

// 프로세스 종료 시 데이터베이스 연결 해제
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('데이터베이스 연결 해제 오류:', err.message);
    } else {
      console.log('데이터베이스 연결이 해제되었습니다.');
    }
    process.exit(0);
  });
});