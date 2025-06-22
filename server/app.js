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

// React 빌드 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트 먼저 정의
app.get('/api/status', (req, res) => {
    res.json({ 
        message: 'Switchboard Plus Server is running!',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// SQLite 데이터베이스 연결
const db = new sqlite3.Database(path.join(__dirname, '../database/switchboard.db'), (err) => {
    if (err) {
        console.error('❌ 데이터베이스 연결 실패:', err.message);
    } else {
        console.log('✅ SQLite 데이터베이스 연결 성공');
        // 외래 키 제약 조건 활성화
        db.run('PRAGMA foreign_keys = ON;', (err) => {
            if (err) {
                console.error('❌ 외래 키 활성화 실패:', err.message);
            } else {
                initializeDatabase();
            }
        });
    }
});

// 데이터베이스 초기화 (테이블 생성)
function initializeDatabase() {
    db.serialize(() => {
        const tables = [
            `CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) UNIQUE NOT NULL,
                ip_address VARCHAR(45) NOT NULL,
                port INTEGER DEFAULT 8081,
                status VARCHAR(50) DEFAULT 'offline',
                last_seen DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS group_clients (
                group_id INTEGER,
                client_id INTEGER,
                PRIMARY KEY (group_id, client_id),
                FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
                FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                target_group_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (target_group_id) REFERENCES groups (id) ON DELETE SET NULL
            )`,
            `CREATE TABLE IF NOT EXISTS preset_commands (
                preset_id INTEGER,
                client_id INTEGER,
                command TEXT NOT NULL,
                PRIMARY KEY (preset_id, client_id),
                FOREIGN KEY (preset_id) REFERENCES presets (id) ON DELETE CASCADE,
                FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
            )`
        ];

        tables.forEach(table => {
            db.run(table, (err) => {
                if (err) {
                    // console.error('❌ 테이블 생성 실패:', err.message);
                }
            });
        });

        // 기존 테이블 구조 변경 (마이그레이션)
        // 'clients' 테이블에 'description' 컬럼 추가
        db.run('ALTER TABLE clients ADD COLUMN description TEXT', () => {});
        // 'groups' 테이블에 'description' 컬럼 추가
        db.run('ALTER TABLE groups ADD COLUMN description TEXT', () => {});
        // 'presets' 테이블에 'description' 컬럼 추가
        db.run('ALTER TABLE presets ADD COLUMN description TEXT', () => {});
    });
}

// 클라이언트 관리 API
app.get('/api/clients', (req, res) => {
    db.all('SELECT * FROM clients ORDER BY name', (err, rows) => {
        if (err) {
            console.error('❌ 클라이언트 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/clients', (req, res) => {
    const { name, ip_address, port } = req.body;
    
    if (!name || !ip_address) {
        return res.status(400).json({ error: '클라이언트 이름과 IP 주소는 필수입니다.' });
    }
    
    db.run(
        'INSERT INTO clients (name, ip_address, port) VALUES (?, ?, ?)',
        [name, ip_address, port || 8081],
        function(err) {
            if (err) {
                console.error('❌ 클라이언트 추가 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }
            
            const newClient = { id: this.lastID, name, ip_address, port: port || 8081, status: 'offline' };
            console.log('✅ 클라이언트 추가됨:', newClient);
            res.status(201).json(newClient);
        }
    );
});

app.delete('/api/clients/:id', (req, res) => {
    const clientId = req.params.id;
    
    db.run('DELETE FROM clients WHERE id = ?', [clientId], function(err) {
        if (err) {
            console.error('❌ 클라이언트 삭제 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: '클라이언트를 찾을 수 없습니다.' });
        }
        
        console.log('✅ 클라이언트 삭제됨:', clientId);
        res.json({ message: '클라이언트가 삭제되었습니다.' });
    });
});

// 그룹 관리 API
app.get('/api/groups', (req, res) => {
    db.all('SELECT * FROM groups ORDER BY name', (err, groups) => {
        if (err) {
            console.error('❌ 그룹 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        const promises = groups.map(group => {
            return new Promise((resolve, reject) => {
                db.all('SELECT client_id FROM group_clients WHERE group_id = ?', [group.id], (err, clients) => {
                    if (err) {
                        return reject(err);
                    }
                    group.client_ids = clients.map(c => c.client_id);
                    resolve(group);
                });
            });
        });

        Promise.all(promises)
            .then(results => {
                res.json(results);
            })
            .catch(error => {
                console.error('❌ 그룹 클라이언트 정보 조회 실패:', error);
                res.status(500).json({ error: error.message });
            });
    });
});

app.post('/api/groups', (req, res) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: '그룹 이름은 필수입니다.' });
    }
    
    db.run('INSERT INTO groups (name) VALUES (?)', [name], function(err) {
        if (err) {
            console.error('❌ 그룹 추가 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        const newGroup = { id: this.lastID, name };
        console.log('✅ 그룹 추가됨:', newGroup);
        res.status(201).json(newGroup);
    });
});

app.put('/api/groups/:id', (req, res) => {
    const groupId = req.params.id;
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: '그룹 이름은 필수입니다.' });
    }
    
    db.run('UPDATE groups SET name = ? WHERE id = ?', [name, groupId], function(err) {
        if (err) {
            console.error('❌ 그룹 수정 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
        }
        
        console.log('✅ 그룹 수정됨:', groupId);
        res.json({ id: groupId, name });
    });
});

app.delete('/api/groups/:id', (req, res) => {
    const groupId = req.params.id;
    
    db.run('DELETE FROM groups WHERE id = ?', [groupId], function(err) {
        if (err) {
            console.error('❌ 그룹 삭제 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
        }
        
        console.log('✅ 그룹 삭제됨:', groupId);
        res.json({ message: '그룹이 삭제되었습니다.' });
    });
});

// 프리셋 관리 API
app.get('/api/presets', (req, res) => {
    db.all('SELECT * FROM presets ORDER BY name', (err, presets) => {
        if (err) {
            console.error('❌ 프리셋 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }

        const promises = presets.map(preset => {
            return new Promise((resolve, reject) => {
                db.all('SELECT client_id, command FROM preset_commands WHERE preset_id = ?', [preset.id], (err, commands) => {
                    if (err) {
                        return reject(err);
                    }
                    preset.commands = commands.reduce((acc, c) => {
                        acc[c.client_id] = c.command;
                        return acc;
                    }, {});
                    resolve(preset);
                });
            });
        });

        Promise.all(promises)
            .then(results => {
                res.json(results);
            })
            .catch(error => {
                console.error('❌ 프리셋 명령어 정보 조회 실패:', error);
                res.status(500).json({ error: error.message });
            });
    });
});

app.get('/api/presets/:id', (req, res) => {
    const presetId = req.params.id;
    db.get('SELECT * FROM presets WHERE id = ?', [presetId], (err, preset) => {
        if (err) {
            console.error('❌ 프리셋 상세 조회 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!preset) {
            return res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
        }

        db.all('SELECT client_id, command FROM preset_commands WHERE preset_id = ?', [presetId], (err, commands) => {
            if (err) {
                console.error('❌ 프리셋 명령어 조회 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }
            preset.commands = commands.reduce((acc, c) => {
                acc[c.client_id] = c.command;
                return acc;
            }, {});
            res.json(preset);
        });
    });
});

app.post('/api/presets', (req, res) => {
    const { name, description, target_group_id, commands } = req.body;

    if (!name || !target_group_id || !commands || Object.keys(commands).length === 0) {
        return res.status(400).json({ error: '프리셋 이름, 대상 그룹, 명령어는 필수입니다.' });
    }

    db.run(
        'INSERT INTO presets (name, description, target_group_id) VALUES (?, ?, ?)',
        [name, description || '', target_group_id],
        function (err) {
            if (err) {
                console.error('❌ 프리셋 추가 실패:', err.message);
                return res.status(500).json({ error: err.message });
            }

            const presetId = this.lastID;
            const commandPromises = Object.entries(commands).map(([clientId, command]) => {
                return new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO preset_commands (preset_id, client_id, command) VALUES (?, ?, ?)',
                        [presetId, clientId, command],
                        (err) => {
                            if (err) {
                                return reject(err);
                            }
                            resolve();
                        }
                    );
                });
            });

            Promise.all(commandPromises)
                .then(() => {
                    const newPreset = { id: presetId, name, description, target_group_id, commands };
                    console.log('✅ 프리셋 추가됨:', newPreset);
                    res.status(201).json(newPreset);
                })
                .catch(error => {
                    console.error('❌ 프리셋 명령어 추가 실패:', error.message);
                    // 롤백
                    db.run('DELETE FROM presets WHERE id = ?', [presetId]);
                    res.status(500).json({ error: '프리셋 명령어 저장에 실패했습니다.' });
                });
        }
    );
});

app.put('/api/presets/:id', (req, res) => {
    const presetId = req.params.id;
    const { name, description, target_group_id, commands } = req.body;

    if (!name || !target_group_id || !commands || Object.keys(commands).length === 0) {
        return res.status(400).json({ error: '프리셋 이름, 대상 그룹, 명령어는 필수입니다.' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
            'UPDATE presets SET name = ?, description = ?, target_group_id = ? WHERE id = ?',
            [name, description || '', target_group_id, presetId],
            function (err) {
                if (err) {
                    console.error('❌ 프리셋 수정 실패:', err.message);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
            }
        );

        db.run('DELETE FROM preset_commands WHERE preset_id = ?', [presetId], (err) => {
            if (err) {
                console.error('❌ 기존 명령어 삭제 실패:', err.message);
                db.run('ROLLBACK');
                return res.status(500).json({ error: '기존 명령어 삭제에 실패했습니다.' });
            }
        });

        const commandPromises = Object.entries(commands).map(([clientId, command]) => {
            return new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO preset_commands (preset_id, client_id, command) VALUES (?, ?, ?)',
                    [presetId, clientId, command],
                    (err) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve();
                    }
                );
            });
        });

        Promise.all(commandPromises)
            .then(() => {
                db.run('COMMIT');
                const updatedPreset = { id: presetId, name, description, target_group_id, commands };
                console.log('✅ 프리셋 수정됨:', updatedPreset);
                res.json(updatedPreset);
            })
            .catch(error => {
                console.error('❌ 새 명령어 추가 실패:', error.message);
                db.run('ROLLBACK');
                res.status(500).json({ error: '새 명령어 저장에 실패했습니다.' });
            });
    });
});

app.delete('/api/presets/:id', (req, res) => {
    const presetId = req.params.id;
    
    // CASCADE DELETE 덕분에 preset_commands는 자동으로 삭제됩니다.
    db.run('DELETE FROM presets WHERE id = ?', [presetId], function(err) {
        if (err) {
            console.error('❌ 프리셋 삭제 실패:', err.message);
            return res.status(500).json({ error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
        }
        
        console.log('✅ 프리셋 삭제됨:', presetId);
        res.json({ message: '프리셋이 삭제되었습니다.' });
    });
});

// 프리셋 실행 API (핵심 기능)
app.post('/api/presets/:id/execute', (req, res) => {
    const presetId = req.params.id;
    
    db.get('SELECT target_group_id FROM presets WHERE id = ?', [presetId], (err, preset) => {
        if (err || !preset) {
            return res.status(404).json({ error: '프리셋을 찾을 수 없습니다.' });
        }

        db.all('SELECT client_id, command FROM preset_commands WHERE preset_id = ?', [presetId], (err, commands) => {
            if (err) {
                return res.status(500).json({ error: '명령어 조회에 실패했습니다.' });
            }

            const commandMap = new Map(commands.map(c => [c.client_id, c.command]));
            
            // 연결된 소켓 클라이언트들에게 명령어 전송
            const connectedSocketIds = Object.keys(clientsMap);
            let executionCount = 0;

            connectedSocketIds.forEach(socketId => {
                const clientInfo = clientsMap[socketId];
                if (commandMap.has(clientInfo.id)) {
                    const command = commandMap.get(clientInfo.id);
                    io.to(socketId).emit('execute_command', { command });
                    executionCount++;
                }
            });

            if (executionCount > 0) {
                console.log(`✅ 프리셋 ${presetId} 실행: ${executionCount}개의 클라이언트에 명령어 전송`);
                res.json({ message: `${executionCount}개의 클라이언트에 명령어를 전송했습니다.` });
            } else {
                res.status(404).json({ error: '명령을 실행할 온라인 클라이언트가 없습니다.' });
            }
        });
    });
});

// React 앱 정적 파일 서빙 (API 라우트 이후에 정의)
app.use(express.static(path.join(__dirname, 'public')));

// 기본 경로는 React 앱으로 (모든 API 라우트 이후에 정의)
app.get(/^(?!\/api)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== Socket.io 이벤트 처리 =====

// Socket.IO 연결 관리
const clientsMap = {}; // socket.id -> { id, name, ip_address }

io.on('connection', (socket) => {
    console.log('🔌 새로운 클라이언트가 연결되었습니다:', socket.id);
    
    // 클라이언트 등록 및 Socket Room 참여
    socket.on('register_client', (data) => {
        const { name } = data;
        if (!name) return;

        // 클라이언트를 이름 기반의 room에 참여시킴
        socket.join(name);
        
        db.run(
            'UPDATE clients SET status = ?, last_seen = ? WHERE name = ?',
            ['online', new Date().toISOString(), name],
            (err) => {
                if (err) {
                    console.error('❌ 클라이언트 상태 업데이트 실패:', err.message);
                } else {
                    console.log(`✅ 클라이언트 [${name}] 등록 및 방 [${name}] 참여`);
                    io.emit('client_status_changed', { name, status: 'online' });
                }
            }
        );
    });
    
    // 하트비트
    socket.on('heartbeat', (data) => {
        const { name } = data;
        
        db.run(
            'UPDATE clients SET last_seen = ? WHERE name = ?',
            [new Date().toISOString(), name]
        );
    });
    
    // 클라이언트 연결 해제
    socket.on('disconnect', () => {
        // 연결 해제 시 상태를 'offline'으로 변경하는 로직 추가 필요
        // (socket.id와 client name을 매핑하는 로직이 필요함)
        console.log('🔌 클라이언트 연결 해제됨:', socket.id);
    });
});

// 서버 시작
const PORT = 8000;
server.listen(PORT, () => {
    console.log(`🚀 Switchboard Plus MVP Server running on http://localhost:${PORT}`);
    console.log(`📊 API 엔드포인트: http://localhost:${PORT}/api/status`);
    console.log(`🌐 웹 UI: http://localhost:${PORT}`);
}); 