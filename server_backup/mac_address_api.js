// MAC 주소 업데이트 API (ID로)
app.put('/api/clients/:id/mac-address', (req, res) => {
  const { id } = req.params;
  const { mac_address, is_manual = false } = req.body;
  
  if (!mac_address) {
    res.status(400).json({ error: 'MAC 주소는 필수입니다.' });
    return;
  }
  
  // 클라이언트 존재 여부 확인
  db.get('SELECT id, name FROM clients WHERE id = ?', [id], (err, client) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!client) {
      res.status(404).json({ error: '클라이언트를 찾을 수 없습니다.' });
      return;
    }
    
    // 기존 MAC 주소 정보 확인
    db.get('SELECT mac_address, is_manual FROM client_power_info WHERE client_id = ?', [id], (err, existing) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // 우선순위 로직: 수동 입력이 있으면 자동 수집으로 덮어쓰지 않음
      if (existing && existing.is_manual && !is_manual) {
        console.log(`⚠️ 수동 입력된 MAC 주소가 있어 자동 수집 MAC 주소 무시: ${client.name} (수동: ${existing.mac_address}, 자동: ${mac_address})`);
        res.json({ 
          success: true, 
          message: '수동 입력된 MAC 주소가 있어 자동 수집 MAC 주소를 무시합니다.',
          client_id: id,
          mac_address: existing.mac_address,
          is_manual: true
        });
        return;
      }
      
      // MAC 주소 저장 또는 업데이트
      const isManualFlag = is_manual ? 1 : 0;
      db.run(
        'INSERT OR REPLACE INTO client_power_info (client_id, mac_address, updated_at, is_manual) VALUES (?, ?, datetime("now"), ?)',
        [id, mac_address, isManualFlag],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          const actionType = is_manual ? '수동' : '자동';
          console.log(`✅ ${actionType} MAC 주소 설정 완료: ${client.name} (ID: ${id}) -> ${mac_address}`);
          
          // Socket.io 이벤트 전송 (웹 UI 실시간 업데이트)
          io.emit('mac_address_updated', {
            clientId: parseInt(id),
            clientName: client.name,
            macAddress: mac_address,
            isManual: is_manual
          });
          
          res.json({ 
            success: true, 
            message: 'MAC 주소가 업데이트되었습니다.',
            client_id: parseInt(id),
            mac_address: mac_address,
            is_manual: is_manual
          });
        }
      );
    });
  });
}); 