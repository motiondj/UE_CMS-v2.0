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
  }
});

// 데이터베이스 테이블 초기화
function initializeDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) UNIQUE NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      port INTEGER DEFAULT 8081,
      status VARCHAR(50) DEFAULT 'offline',
      last_seen DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS group_clients (
      group_id INTEGER,
      client_id INTEGER,
      PRIMARY KEY (group_id, client_id),
      FOREIGN KEY (group_id) REFERENCES groups (id),
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )`,
    `CREATE TABLE IF NOT EXISTS presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      command TEXT NOT NULL,
      target_group_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_group_id) REFERENCES groups (id)
    )`,
    `CREATE TABLE IF NOT EXISTS execution_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preset_id INTEGER,
      client_id INTEGER,
      status VARCHAR(50),
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preset_id) REFERENCES presets (id),
      FOREIGN KEY (client_id) REFERENCES clients (id)
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

// 클라이언트 관리 API
app.get('/api/clients', (req, res) => {
  db.all('SELECT * FROM clients ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
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

app.delete('/api/clients/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: '클라이언트를 찾을 수 없습니다.' });
      return;
    }
    
    io.emit('client_deleted', { id: parseInt(id) });
    res.json({ message: '클라이언트가 삭제되었습니다.' });
  });
});

// 그룹 관리 API
app.get('/api/groups', (req, res) => {
  db.all('SELECT * FROM groups ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/groups', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '그룹 이름은 필수입니다.' });
    return;
  }

  db.run('INSERT INTO groups (name) VALUES (?)', [name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT * FROM groups WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      io.emit('group_added', row);
      res.json(row);
    });
  });
});

app.delete('/api/groups/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM groups WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
      return;
    }
    
    io.emit('group_deleted', { id: parseInt(id) });
    res.json({ message: '그룹이 삭제되었습니다.' });
  });
});

// 프리셋 관리 API
app.get('/api/presets', (req, res) => {
  db.all(`
    SELECT p.*, g.name as group_name 
    FROM presets p 
    LEFT JOIN groups g ON p.target_group_id = g.id 
    ORDER BY p.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/presets', (req, res) => {
  const { name, command, target_group_id } = req.body;
  
  if (!name || !command) {
    res.status(400).json({ error: '프리셋 이름과 명령어는 필수입니다.' });
    return;
  }

  db.run(
    'INSERT INTO presets (name, command, target_group_id) VALUES (?, ?, ?)',
    [name, command, target_group_id || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      db.get(`
        SELECT p.*, g.name as group_name 
        FROM presets p 
        LEFT JOIN groups g ON p.target_group_id = g.id 
        WHERE p.id = ?
      `, [this.lastID], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        io.emit('preset_added', row);
        res.json(row);
      });
    }
  );
});

app.delete('/api/presets/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM presets WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
      return;
    }
    
    io.emit('preset_deleted', { id: parseInt(id) });
    res.json({ message: '프리셋이 삭제되었습니다.' });
  });
});

// 프리셋 실행 API
app.post('/api/presets/:id/execute', (req, res) => {
  const { id } = req.params;
  
  // 프리셋 정보 조회
  db.get('SELECT * FROM presets WHERE id = ?', [id], (err, preset) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!preset) {
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
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 각 클라이언트에 명령 전송
      const executionResults = [];
      clients.forEach(client => {
        // Socket.io를 통해 클라이언트에 명령 전송
        io.emit('execute_command', {
          clientId: client.id,
          command: preset.command,
          presetId: preset.id
        });
        
        // 실행 히스토리 기록
        db.run(
          'INSERT INTO execution_history (preset_id, client_id, status) VALUES (?, ?, ?)',
          [preset.id, client.id, 'executing'],
          function(err) {
            if (!err) {
              executionResults.push({
                clientId: client.id,
                clientName: client.name,
                status: 'executing',
                executionId: this.lastID
              });
            }
          }
        );
      });
      
      io.emit('preset_executed', {
        presetId: preset.id,
        presetName: preset.name,
        clients: executionResults
      });
      
      res.json({
        message: '프리셋이 실행되었습니다.',
        preset: preset,
        clients: executionResults
      });
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

// Socket.io 이벤트 처리
io.on('connection', (socket) => {
  console.log('클라이언트가 연결되었습니다:', socket.id);
  
  // 클라이언트 상태 업데이트
  socket.on('client_status_update', (data) => {
    const { clientId, status } = data;
    
    db.run(
      'UPDATE clients SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [status, clientId],
      (err) => {
        if (!err) {
          io.emit('client_status_changed', { clientId, status });
        }
      }
    );
  });
  
  // 실행 결과 업데이트
  socket.on('execution_result', (data) => {
    const { executionId, status, result } = data;
    
    db.run(
      'UPDATE execution_history SET status = ? WHERE id = ?',
      [status, executionId],
      (err) => {
        if (!err) {
          io.emit('execution_updated', { executionId, status, result });
        }
      }
    );
  });
  
  socket.on('disconnect', () => {
    console.log('클라이언트가 연결을 해제했습니다:', socket.id);
  });
});

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