import React, { useState } from 'react';
import GroupModal from './GroupModal';
import './GroupSection.css';

const GroupSection = ({ groups, clients, onRefresh, showToast }) => {
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedGroups(new Set(groups.map(g => g.id)));
    } else {
      setSelectedGroups(new Set());
    }
  };

  const handleGroupSelect = (groupId, checked) => {
    const newSelected = new Set(selectedGroups);
    if (checked) {
      newSelected.add(groupId);
    } else {
      newSelected.delete(groupId);
    }
    setSelectedGroups(newSelected);
  };

  const handleSaveGroup = async (formData) => {
    const isEditing = !!editingGroup;
    const url = isEditing ? `/api/groups/${editingGroup.id}` : '/api/groups';
    const method = isEditing ? 'PUT' : 'POST';

    const groupData = {
      name: formData.name,
      client_ids: formData.clientIds
    };

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `그룹 ${isEditing ? '수정' : '생성'}에 실패했습니다.`);
      }

      const result = await response.json();
      
      showToast(
        isEditing 
          ? `그룹 "${result.name}"이(가) 성공적으로 수정되었습니다.`
          : `새 그룹 "${result.name}"이(가) 생성되었습니다.`, 
        'success'
      );
      
      closeModal();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const openAddModal = () => {
    console.log('새 그룹 버튼 클릭됨');
    setEditingGroup(null);
    setShowAddModal(true);
  };

  const closeModal = () => {
    console.log('모달 닫기');
    setShowAddModal(false);
    setEditingGroup(null);
  };

  const openEditModal = (group) => {
    console.log('그룹 편집 버튼 클릭됨:', group);
    setEditingGroup(group);
    setShowAddModal(true);
  };

  const deleteGroup = async (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (window.confirm(`정말 "${group.name}" 그룹을 삭제하시겠습니까?\n그룹만 삭제되고 클라이언트는 유지됩니다.`)) {
      try {
        const response = await fetch(`/api/groups/${groupId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '그룹 삭제에 실패했습니다.');
        }
        
        // UI 업데이트는 App.js의 소켓 이벤트를 통해 처리되므로 별도 호출 필요 없음
        showToast(`그룹 "${group.name}"이(가) 성공적으로 삭제되었습니다.`, 'success');

      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  };

  const bulkAction = (action) => {
    if (selectedGroups.size === 0) {
      showToast('선택된 그룹이 없습니다.', 'error');
      return;
    }

    const actionNames = {
      'on': '켜기',
      'reboot': '재부팅',
      'off': '끄기'
    };

    const actionName = actionNames[action];
    const groupCount = selectedGroups.size;

    if (window.confirm(`선택된 ${groupCount}개 그룹의 모든 디스플레이 서버를 ${actionName} 하시겠습니까?`)) {
      let totalClients = 0;
      selectedGroups.forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
          totalClients += group.client_ids.length;
        }
      });

      showToast(`${groupCount}개 그룹 (${totalClients}대 클라이언트)에 전원 ${actionName} 명령을 전송했습니다. (v2.1에서 활성화)`, 'info');
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">
        👥 디스플레이 서버 그룹
        <button 
          className="btn btn-secondary btn-with-text" 
          onClick={(e) => {
            console.log('새 그룹 버튼 클릭 이벤트 발생');
            e.preventDefault();
            e.stopPropagation();
            openAddModal();
          }}
        >
          ➕ 새 그룹
        </button>
      </h2>
      
      {/* 그룹 일괄 제어 UI */}
      <div className="bulk-controls">
        <div className="selection-info">
          <label>
            <input 
              type="checkbox" 
              checked={selectedGroups.size === groups.length && groups.length > 0}
              onChange={handleSelectAll}
            />
            전체 선택
          </label>
          <span>선택된 그룹: <span>{selectedGroups.size}</span>개</span>
        </div>
        <div className="bulk-actions">
          <button
            className="btn btn-primary btn-bulk"
            onClick={() => bulkAction('on')}
            title="선택된 그룹들 전체 켜기"
          >
            켜기
          </button>
          <button
            className="btn btn-secondary btn-bulk"
            onClick={() => bulkAction('reboot')}
            title="선택된 그룹들 전체 재부팅"
          >
            재부팅
          </button>
          <button
            className="btn btn-danger btn-bulk"
            onClick={() => bulkAction('off')}
            title="선택된 그룹들 전체 끄기"
          >
            끄기
          </button>
        </div>
      </div>

      <div className="group-grid">
        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">아직 생성된 그룹이 없습니다</div>
            <div className="empty-state-description">새 그룹 버튼을 클릭해서 첫 번째 그룹을 만들어보세요!</div>
          </div>
        ) : (
          groups.map(group => {
            const clientTags = (group.clients || []).map(client => {
              return (
                <span key={client.id} className="client-tag">
                  {client.name} ({client.ip_address})
                </span>
              );
            });

            return (
              <div key={group.id} className="group-card">
                <input 
                  type="checkbox" 
                  className="group-checkbox"
                  checked={selectedGroups.has(group.id)}
                  onChange={(e) => handleGroupSelect(group.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="group-content">
                  <div className="group-name">{group.name}</div>
                  <div className="group-info">{(group.clients || []).length}개 디스플레이 서버</div>
                  <div className="group-clients">
                    {clientTags}
                  </div>
                </div>
                <div className="group-actions">
                  <button
                    className="btn btn-secondary btn-bulk"
                    onClick={(e) => {
                      console.log('편집 버튼 클릭 이벤트 발생:', group);
                      e.preventDefault();
                      e.stopPropagation();
                      openEditModal(group);
                    }}
                    title="편집"
                  >
                    편집
                  </button>
                  <button
                    className="btn btn-danger btn-bulk"
                    onClick={() => deleteGroup(group.id)}
                    title="삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 그룹 추가/편집 모달 */}
      {showAddModal && (
        <GroupModal
          isOpen={showAddModal}
          onClose={closeModal}
          onSave={handleSaveGroup}
          clients={clients}
          initialData={editingGroup}
        />
      )}
    </div>
  );
};

export default GroupSection; 