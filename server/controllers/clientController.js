const ClientModel = require('../models/Client');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

class ClientController {
  // 모든 클라이언트 조회
  static async getAll(req, res, next) {
    try {
      const clients = await ClientModel.findAll();
      res.json(clients);
    } catch (error) {
      logger.error('클라이언트 조회 실패:', error);
      next(error);
    }
  }

  // 클라이언트 변경사항 조회 (문서에 나온 API)
  static async getChanges(req, res, next) {
    try {
      const { since } = req.query;
      
      // since 파라미터가 있으면 해당 시간 이후 변경된 클라이언트만 반환
      const changes = await ClientModel.getChanges(since);
      
      res.json({
        changed: changes.changed || [],
        deleted: changes.deleted || [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('클라이언트 변경사항 조회 실패:', error);
      next(error);
    }
  }

  // 클라이언트 생성
  static async create(req, res, next) {
    try {
      const { name, ip_address, port } = req.body;
      
      // 유효성 검사
      if (!name || !ip_address) {
        return res.status(400).json({ 
          error: '이름과 IP 주소는 필수입니다.' 
        });
      }

      const client = await ClientModel.create({ name, ip_address, port });
      
      // Socket.IO 이벤트 전송
      socketService.emit('client_added', client);
      
      logger.info(`새 클라이언트 등록: ${name} (${ip_address})`);
      res.status(201).json(client);
    } catch (error) {
      logger.error('클라이언트 생성 실패:', error);
      next(error);
    }
  }

  // 클라이언트 업데이트
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, ip_address, port } = req.body;
      
      if (!name || !ip_address) {
        return res.status(400).json({ 
          error: '이름과 IP 주소는 필수입니다.' 
        });
      }

      const client = await ClientModel.update(id, { name, ip_address, port });
      
      // Socket.IO 이벤트 전송
      socketService.emit('client_updated', client);
      
      logger.info(`클라이언트 업데이트: ${name} (ID: ${id})`);
      res.json(client);
    } catch (error) {
      if (error.message === '클라이언트를 찾을 수 없습니다.') {
        return res.status(404).json({ error: error.message });
      }
      logger.error('클라이언트 업데이트 실패:', error);
      next(error);
    }
  }

  // 클라이언트 삭제
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      
      const success = await ClientModel.delete(id);
      
      if (!success) {
        return res.status(404).json({ 
          error: '클라이언트를 찾을 수 없습니다.' 
        });
      }

      // Socket.IO 이벤트 전송
      socketService.emit('client_deleted', { id: parseInt(id) });
      
      logger.info(`클라이언트 삭제: ID ${id}`);
      res.json({ message: '클라이언트가 삭제되었습니다.' });
    } catch (error) {
      logger.error('클라이언트 삭제 실패:', error);
      next(error);
    }
  }

  // 클라이언트 상태 업데이트 (문서에 나온 API)
  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ 
          error: '상태는 필수입니다.' 
        });
      }

      const result = await ClientModel.updateStatus(id, status);
      
      if (result.success) {
        // Socket으로 변경 알림
        socketService.emit('client_status_changed', {
          client_id: id,
          status: status,
          timestamp: new Date().toISOString()
        });
      }
      
      res.json(result);
    } catch (error) {
      logger.error('클라이언트 상태 업데이트 실패:', error);
      next(error);
    }
  }

  // MAC 주소 업데이트
  static async updateMacAddress(req, res, next) {
    try {
      const { id } = req.params;
      const { mac_address, is_manual = false } = req.body;
      
      if (!mac_address) {
        return res.status(400).json({ 
          error: 'MAC 주소는 필수입니다.' 
        });
      }

      const result = await ClientModel.updateMacAddress(id, mac_address, is_manual);
      
      if (result.success) {
        // Socket.IO 이벤트 전송
        socketService.emit('mac_address_updated', {
          clientId: parseInt(id),
          macAddress: mac_address,
          isManual: is_manual
        });
      }
      
      res.json(result);
    } catch (error) {
      logger.error('MAC 주소 업데이트 실패:', error);
      next(error);
    }
  }

  // 하트비트 처리
  static async heartbeat(req, res, next) {
    try {
      const { clientName, ip_address, port = 8081 } = req.body;
      
      if (!clientName || !ip_address) {
        return res.status(400).json({ 
          error: '클라이언트 이름과 IP 주소는 필수입니다.' 
        });
      }

      const client = await ClientModel.updateHeartbeat(clientName, ip_address, port);
      
      // Socket.IO 이벤트 전송
      socketService.emit('client_status_changed', {
        id: client.id,
        name: clientName,
        status: 'online',
        ip_address: ip_address
      });
      
      res.json({ 
        success: true, 
        message: '하트비트 처리 완료',
        clientId: client.id
      });
    } catch (error) {
      logger.error('하트비트 처리 실패:', error);
      next(error);
    }
  }

  // 연결된 클라이언트 정보 조회
  static async getConnectedClients(req, res, next) {
    try {
      const connectedClients = socketService.getConnectedClients();
      const allClients = await ClientModel.findAll();
      
      // 각 클라이언트의 연결 상태 확인
      const clientsWithConnectionStatus = allClients.map(client => {
        const isConnected = socketService.isClientConnected(client.name);
        const socket = socketService.connectedClients.get(client.name);
        
        return {
          ...client,
          isConnected: isConnected,
          socketId: socket ? socket.id : null,
          socketConnected: socket ? socket.connected : false,
          lastSeen: socket ? socket.handshake.time : null
        };
      });
      
      res.json({
        connectedClients: connectedClients,
        totalClients: allClients.length,
        clients: clientsWithConnectionStatus
      });
    } catch (error) {
      logger.error('연결된 클라이언트 조회 실패:', error);
      next(error);
    }
  }
}

module.exports = ClientController; 