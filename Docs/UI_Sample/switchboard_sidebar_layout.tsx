import React, { useState, useEffect } from 'react';

function SwitchboardApp() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [runningPresets, setRunningPresets] = useState(new Set()); // 실행 중인 프리셋 추적
  const [clients, setClients] = useState([
    { id: 1, name: 'Display 1', ip: '192.168.10.2', status: 'online' },
    { id: 2, name: 'Display 2', ip: '192.168.10.3', status: 'running' },
    { id: 3, name: 'Display 3', ip: '192.168.10.4', status: 'offline' }
  ]);
  const [presets, setPresets] = useState([
    { id: 1, name: 'TESTEST', group: 'TEST' },
    { id: 2, name: '아침 프레젠테이션', group: 'MAIN' },
    { id: 3, name: '이벤트 영상', group: 'EVENT' },
    { id: 4, name: '점심 광고', group: 'MAIN' },
    { id: 5, name: '저녁 뉴스', group: 'NEWS' },
    { id: 6, name: '배경 영상', group: 'DEFAULT' }
  ]);
  const [groups, setGroups] = useState([
    { id: 1, name: 'TEST', clients: ['192.168.10.2'] },
    { id: 2, name: 'MAIN', clients: ['192.168.10.2', '192.168.10.3'] },
    { id: 3, name: 'EVENT', clients: ['192.168.10.2', '192.168.10.3', '192.168.10.4'] }
  ]);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [modals, setModals] = useState({
    presetEdit: { show: false, preset: null },
    presetCreate: { show: false },
    presetDelete: { show: false, preset: null },
    groupEdit: { show: false, group: null },
    groupCreate: { show: false },
    groupDelete: { show: false, group: null },
    clientAdd: { show: false }
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  // 프리셋 실행/정지 토글
  const togglePreset = (preset) => {
    const isRunning = runningPresets.has(preset.id);
    
    if (isRunning) {
      // 정지
      setRunningPresets(prev => {
        const newSet = new Set(prev);
        newSet.delete(preset.id);
        return newSet;
      });
      showToast(`프리셋 "${preset.name}"을 정지했습니다.`);
    } else {
      // 실행
      setRunningPresets(prev => new Set(prev).add(preset.id));
      showToast(`프리셋 "${preset.name}"을 실행했습니다.`);
    }
  };

  // 모달 관리 함수들
  const openModal = (type, data = null) => {
    setModals(prev => ({
      ...prev,
      [type]: { show: true, ...(data && { preset: data, group: data }) }
    }));
  };

  const closeModal = (type) => {
    setModals(prev => ({
      ...prev,
      [type]: { show: false, preset: null, group: null }
    }));
  };

  // 프리셋 관련 함수들
  const handlePresetSave = (presetData) => {
    if (modals.presetEdit.preset) {
      // 편집
      setPresets(prev => prev.map(p => 
        p.id === modals.presetEdit.preset.id ? { ...p, ...presetData } : p
      ));
      showToast('프리셋이 수정되었습니다.');
    } else {
      // 생성
      const newPreset = {
        id: presets.length + 1,
        ...presetData
      };
      setPresets(prev => [...prev, newPreset]);
      showToast('새 프리셋이 생성되었습니다.');
    }
    closeModal('presetEdit');
    closeModal('presetCreate');
  };

  const handlePresetDelete = () => {
    const presetToDelete = modals.presetDelete.preset;
    setPresets(prev => prev.filter(p => p.id !== presetToDelete.id));
    showToast(`프리셋 "${presetToDelete.name}"이 삭제되었습니다.`);
    closeModal('presetDelete');
  };

  const handlePresetCopy = (preset) => {
    const newPreset = {
      ...preset,
      id: presets.length + 1,
      name: `${preset.name} (복사본)`
    };
    setPresets(prev => [...prev, newPreset]);
    showToast('프리셋이 복제되었습니다.');
  };

  // 그룹 관련 함수들
  const handleGroupSave = (groupData) => {
    if (modals.groupEdit.group) {
      // 편집
      setGroups(prev => prev.map(g => 
        g.id === modals.groupEdit.group.id ? { ...g, ...groupData } : g
      ));
      showToast('그룹이 수정되었습니다.');
    } else {
      // 생성
      const newGroup = {
        id: groups.length + 1,
        ...groupData
      };
      setGroups(prev => [...prev, newGroup]);
      showToast('새 그룹이 생성되었습니다.');
    }
    closeModal('groupEdit');
    closeModal('groupCreate');
  };

  const handleGroupDelete = () => {
    const groupToDelete = modals.groupDelete.group;
    setGroups(prev => prev.filter(g => g.id !== groupToDelete.id));
    showToast(`그룹 "${groupToDelete.name}"이 삭제되었습니다.`);
    closeModal('groupDelete');
  };

  // 클라이언트 추가 함수
  const handleClientAdd = (clientData) => {
    const newClient = {
      id: clients.length + 1,
      status: 'offline',
      ...clientData
    };
    setClients(prev => [...prev, newClient]);
    showToast('새 클라이언트가 추가되었습니다.');
    closeModal('clientAdd');
  };

  // 사이드바 메뉴 (더 심플하게)
  const menuItems = [
    { id: 'dashboard', name: '대시보드', icon: '📊' },
    { id: 'clients', name: '클라이언트', icon: '🖥️' },
    { id: 'presets', name: '프리셋', icon: '📝' },
    { id: 'groups', name: '그룹', icon: '👥' },
    { id: 'settings', name: '설정', icon: '⚙️' },
  ];

  // 🎯 모달 컴포넌트들
  const PresetModal = ({ isEdit = false }) => {
    const preset = isEdit ? modals.presetEdit.preset : null;
    const [formData, setFormData] = useState({
      name: preset?.name || '',
      group: preset?.group || '',
      description: ''
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.name.trim()) {
        showToast('프리셋 이름을 입력해주세요.');
        return;
      }
      handlePresetSave(formData);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">
            {isEdit ? '프리셋 편집' : '새 프리셋 생성'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">프리셋 이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 아침 프레젠테이션"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">그룹</label>
              <select
                value={formData.group}
                onChange={(e) => setFormData({...formData, group: e.target.value})}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">그룹 선택</option>
                {groups.map(group => (
                  <option key={group.id} value={group.name}>{group.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">설명 (선택)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="프리셋에 대한 설명을 입력하세요"
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => closeModal(isEdit ? 'presetEdit' : 'presetCreate')}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {isEdit ? '수정' : '생성'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const GroupModal = ({ isEdit = false }) => {
    const group = isEdit ? modals.groupEdit.group : null;
    const [formData, setFormData] = useState({
      name: group?.name || '',
      clients: group?.clients || []
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.name.trim()) {
        showToast('그룹 이름을 입력해주세요.');
        return;
      }
      handleGroupSave(formData);
    };

    const toggleClient = (clientIp) => {
      setFormData(prev => ({
        ...prev,
        clients: prev.clients.includes(clientIp)
          ? prev.clients.filter(ip => ip !== clientIp)
          : [...prev.clients, clientIp]
      }));
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">
            {isEdit ? '그룹 편집' : '새 그룹 생성'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">그룹 이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: MAIN"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">클라이언트 선택</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {clients.map(client => (
                  <label key={client.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.clients.includes(client.ip)}
                      onChange={() => toggleClient(client.ip)}
                      className="rounded"
                    />
                    <span className="text-sm">{client.name} ({client.ip})</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => closeModal(isEdit ? 'groupEdit' : 'groupCreate')}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {isEdit ? '수정' : '생성'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const DeleteConfirmModal = ({ type, item, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-center">삭제 확인</h3>
        
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🗑️</div>
          <p className="text-gray-600">
            <strong>"{item?.name}"</strong> {type}을(를) 삭제하시겠습니까?
          </p>
          <p className="text-sm text-red-600 mt-2">
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );

  const ClientAddModal = () => {
    const [formData, setFormData] = useState({
      name: '',
      ip: ''
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!formData.name.trim() || !formData.ip.trim()) {
        showToast('모든 필드를 입력해주세요.');
        return;
      }
      handleClientAdd(formData);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">새 클라이언트 추가</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">클라이언트 이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: Display 4"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">IP 주소</label>
              <input
                type="text"
                value={formData.ip}
                onChange={(e) => setFormData({...formData, ip: e.target.value})}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 192.168.10.5"
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => closeModal('clientAdd')}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // 심플한 헤더
  const Header = () => (
    <div className="bg-white border-b px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-900">
          {menuItems.find(item => item.id === currentPage)?.name || '대시보드'}
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>🟢 연결됨</span>
          <span>{currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );

  // 심플한 사이드바
  const Sidebar = () => (
    <div className="w-60 bg-gray-900 text-white">
      {/* 로고 */}
      <div className="p-6">
        <h2 className="text-lg font-bold">⚡ Switchboard Plus</h2>
        <p className="text-xs text-gray-400 mt-1">nDisplay Control</p>
      </div>

      {/* 메뉴 */}
      <nav className="px-4">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-3 mb-1 rounded-lg text-left transition-colors ${
              currentPage === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );

  // 확실한 정보 + 심플한 레이아웃
  const DashboardPage = () => (
    <div className="space-y-6">
      {/* 전체 통계 바 - 확실한 정보 표시 */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-5 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-1">{clients.length}</div>
            <div className="text-xs text-gray-500">전체 디스플레이 서버</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600 mb-1">
              {clients.filter(c => c.status !== 'offline').length}
            </div>
            <div className="text-xs text-gray-500">온라인</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {clients.filter(c => c.status === 'running').length}
            </div>
            <div className="text-xs text-gray-500">실행 중</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-600 mb-1">{runningPresets.size}</div>
            <div className="text-xs text-gray-500">활성 프리셋</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-1">{groups.length}</div>
            <div className="text-xs text-gray-500">그룹 수</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 클라이언트 모니터링 - 작은 박스들 */}
        <div className="bg-white p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">디스플레이 서버 모니터링</h3>
            <button 
              className="text-sm text-blue-600 hover:text-blue-800"
              onClick={() => showToast('클라이언트 상태를 업데이트했습니다.')}
            >
              🔄 새로고침
            </button>
          </div>
          <div className="grid grid-cols-auto-fill gap-3" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))'}}>
            {clients.map(client => (
              <div 
                key={client.id}
                className={`p-3 rounded-lg text-center transition-all duration-200 cursor-pointer hover:shadow-md ${
                  client.status === 'running' ? 'bg-green-100' :
                  client.status === 'online' ? 'bg-yellow-100' : 'bg-red-100 opacity-70'
                }`}
              >
                <div className="text-lg mb-1">
                  {client.status === 'running' ? '🟢' :
                   client.status === 'online' ? '🟡' : '🔴'}
                </div>
                <div className="font-semibold text-xs text-gray-800 mb-1">{client.name}</div>
                <div className="text-xs text-gray-500">{client.ip}</div>
              </div>
            ))}
            {/* 새 클라이언트 추가 박스 */}
            <div className="p-3 rounded-lg text-center border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer transition-colors">
              <div className="text-lg mb-1">➕</div>
              <div className="text-xs text-gray-500">새 클라이언트</div>
            </div>
          </div>
        </div>

        {/* 프리셋 빠른 실행 - 심플한 플레이/정지 버튼 */}
        <div className="bg-white p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">프리셋 빠른 실행</h3>
            <button 
              className="text-sm text-blue-600 hover:text-blue-800"
              onClick={() => setCurrentPage('presets')}
            >
              전체 보기 →
            </button>
          </div>
          <div className="grid grid-cols-auto-fill gap-3" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))'}}>
            {presets.slice(0, 8).map(preset => {
              const isRunning = runningPresets.has(preset.id);
              return (
                <div 
                  key={preset.id}
                  className={`p-3 rounded-lg text-center transition-all duration-200 cursor-pointer hover:shadow-md ${
                    isRunning 
                      ? 'bg-green-100 border border-green-400 hover:bg-green-200' 
                      : 'bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                  onClick={() => togglePreset(preset)}
                >
                  {/* 플레이/정지 버튼 스왑 */}
                  <div className="text-lg mb-1">
                    {isRunning ? '⏹️' : '▶️'}
                  </div>
                  <div 
                    className="font-semibold text-xs text-gray-800 mb-1 leading-tight"
                    title={preset.name} // 툴팁으로 전체 이름 표시
                  >
                    {preset.name.length > 10 
                      ? `${preset.name.substring(0, 10)}...` 
                      : preset.name}
                  </div>
                  {/* 실행 중일 때만 상태 텍스트 표시 */}
                  {isRunning && (
                    <div className="text-xs text-green-700">
                      실행 중
                    </div>
                  )}
                </div>
              );
            })}
            {/* 새 프리셋 추가 박스 */}
            <div 
              className="p-3 rounded-lg text-center border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer transition-colors bg-white"
              onClick={() => setCurrentPage('presets')}
            >
              <div className="text-lg mb-1">➕</div>
              <div className="text-xs text-gray-500">새 프리셋</div>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 두 열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 그룹 현황 */}
        <div className="bg-white p-5 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">그룹 현황</h3>
            <button 
              className="text-sm text-blue-600 hover:text-blue-800"
              onClick={() => setCurrentPage('groups')}
            >
              전체 관리 →
            </button>
          </div>
          <div className="grid grid-cols-auto-fill gap-3" style={{gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))'}}>
            {groups.map(group => (
              <div 
                key={group.id}
                className="p-3 rounded-lg text-center border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 cursor-pointer"
                onClick={() => setCurrentPage('groups')}
              >
                <div className="text-lg mb-1">👥</div>
                <div className="font-semibold text-xs text-gray-800 mb-1">{group.name}</div>
                <div className="text-xs text-gray-500">{group.clients.length}개</div>
              </div>
            ))}
            {/* 새 그룹 추가 박스 */}
            <div 
              className="p-3 rounded-lg text-center border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer transition-colors"
              onClick={() => setCurrentPage('groups')}
            >
              <div className="text-lg mb-1">➕</div>
              <div className="text-xs text-gray-500">새 그룹</div>
            </div>
          </div>
        </div>

        {/* 서버 시스템 상태 */}
        <div className="bg-white p-5 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">서버 시스템 상태</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">서버 상태</div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-600">정상</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">네트워크</div>
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-600">안정</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">메모리 사용량</div>
              <div className="text-sm font-medium mb-1">245MB / 2GB (12%)</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{width: '12%'}}></div>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">DB 사용량</div>
              <div className="text-sm font-medium mb-1">45MB / 1GB (4%)</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{width: '4%'}}></div>
              </div>
            </div>
            <div className="col-span-2 text-center pt-2">
              <div className="text-xs text-gray-500 mb-1">가동 시간</div>
              <div className="text-sm font-medium">2시간 15분</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 심플한 클라이언트 페이지
  const ClientsPage = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">클라이언트 관리</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + 추가
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-700">이름</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">IP 주소</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">상태</th>
              <th className="px-6 py-3 text-left font-medium text-gray-700">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {clients.map(client => (
              <tr key={client.id}>
                <td className="px-6 py-4 font-medium">{client.name}</td>
                <td className="px-6 py-4">{client.ip}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    client.status === 'running' ? 'bg-green-100 text-green-800' :
                    client.status === 'online' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {client.status === 'running' ? '실행 중' :
                     client.status === 'online' ? '온라인' : '오프라인'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-blue-600 hover:text-blue-800 mr-3">편집</button>
                  <button className="text-red-600 hover:text-red-800">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 💥 새로운 프리셋 관리 페이지 - 2개씩 그리드 + 실행버튼 없음
  const PresetsPage = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">프리셋 관리</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + 생성
        </button>
      </div>
      
      {/* 🔥 기본값도 2개씩으로 변경 */}
      <div className="grid grid-cols-2 gap-6">
        {presets.map(preset => (
          <div key={preset.id} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{preset.name}</h3>
                <p className="text-gray-500 text-sm mb-3">그룹: {preset.group}</p>
                <div className="mb-4">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {preset.group}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  마지막 실행: 10분 전
                </div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <button className="px-3 py-2 border rounded hover:bg-gray-50 text-sm">편집</button>
                <button className="px-3 py-2 border rounded hover:bg-gray-50 text-sm">복제</button>
                <button className="px-3 py-2 border rounded hover:bg-gray-50 text-sm text-red-600 hover:bg-red-50">삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 그룹 관리 페이지도 2개씩 그리드로 변경
  const GroupsPage = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">그룹 관리</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + 생성
        </button>
      </div>
      
      {/* 🔥 그룹도 기본값 2개씩 */}
      <div className="grid grid-cols-2 gap-6">
        {groups.map(group => (
          <div key={group.id} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{group.name}</h3>
                <p className="text-gray-500 text-sm mb-3">{group.clients.length}개 클라이언트</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {group.clients.map((client, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {client}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-400">
                  생성일: 2024-01-15
                </div>
              </div>
              <div className="flex flex-col gap-2 ml-4">
                <button className="px-3 py-2 border rounded hover:bg-gray-50 text-sm">편집</button>
                <button className="px-3 py-2 border rounded hover:bg-gray-50 text-sm text-red-600 hover:bg-red-50">삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 설정 페이지 - 다크모드 추가
  const SettingsPage = () => {
    const [darkMode, setDarkMode] = useState(false);
    
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">시스템 설정</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 서버 설정 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-4">서버 설정</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-2">서버 포트</label>
                <input type="text" defaultValue="8000" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">최대 클라이언트</label>
                <input type="number" defaultValue="50" className="w-full border rounded px-3 py-2" />
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                저장
              </button>
            </div>
          </div>
          
          {/* UI 설정 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-4">UI 설정</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">다크 모드</span>
                  <p className="text-sm text-gray-500">어두운 테마로 변경</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={darkMode}
                    onChange={(e) => setDarkMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">클라이언트 연결 알림</span>
                  <p className="text-sm text-gray-500">새 클라이언트 연결 시 알림 표시</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">오류 발생 알림</span>
                  <p className="text-sm text-gray-500">시스템 오류 시 알림 표시</p>
                </div>
                <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
              </div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                저장
              </button>
            </div>
          </div>
        </div>
        
        {/* 데이터베이스 설정 */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">데이터베이스 설정</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded">
              <div className="text-sm text-gray-500 mb-1">현재 크기</div>
              <div className="text-lg font-semibold">45MB</div>
            </div>
            <div className="text-center p-4 border rounded">
              <div className="text-sm text-gray-500 mb-1">최대 크기</div>
              <div className="text-lg font-semibold">1GB</div>
            </div>
            <div className="text-center p-4 border rounded">
              <div className="text-sm text-gray-500 mb-1">사용률</div>
              <div className="text-lg font-semibold text-green-600">4%</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
              DB 백업
            </button>
            <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
              DB 초기화
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'clients': return <ClientsPage />;
      case 'presets': return <PresetsPage />;
      case 'groups': return <GroupsPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-8">
          {renderPage()}
        </main>
      </div>

      {/* 토스트 */}
      {toast.show && (
        <div className="fixed bottom-5 right-5 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm z-50">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default SwitchboardApp;