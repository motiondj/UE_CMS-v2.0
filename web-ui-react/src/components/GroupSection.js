import React from 'react';

const GroupSection = ({
  groups,
  clients,
  selectedGroups,
  onSelectAll,
  onBulkAction,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  onSelectGroup
}) => {
  const allSelected = groups.length > 0 && selectedGroups.size === groups.length;

  return (
    <div className="section">
      <h2 className="section-title">
        디스플레이 서버 그룹
        <button className="btn btn-secondary btn-with-text" onClick={onAddGroup}>
          ➕ 새 그룹
        </button>
      </h2>
      {/* 일괄 제어 UI */}
      <div className="bulk-controls">
        <div className="selection-info">
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={e => onSelectAll(e.target.checked)}
            />
            전체 선택
          </label>
          <span>선택된 그룹: <span>{selectedGroups.size}</span>개</span>
        </div>
        <div className="bulk-actions">
          <button className="btn btn-primary btn-bulk" onClick={() => onBulkAction('on')} title="선택된 그룹들 전체 켜기">
            🔌
          </button>
          <button className="btn btn-secondary btn-bulk" onClick={() => onBulkAction('reboot')} title="선택된 그룹들 전체 재부팅">
            🔄
          </button>
          <button className="btn btn-danger btn-bulk" onClick={() => onBulkAction('off')} title="선택된 그룹들 전체 끄기">
            ⚡
          </button>
        </div>
      </div>
      <div className="group-grid" id="groupGrid">
        {groups.length === 0 ? (
          <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)'}}>
            <div style={{fontSize: 48, marginBottom: 16}}>👥</div>
            <div style={{fontSize: 14, marginBottom: 8}}>아직 생성된 그룹이 없습니다</div>
            <div style={{fontSize: 12}}>새 그룹 버튼을 클릭해서 첫 번째 그룹을 만들어보세요!</div>
          </div>
        ) : (
          groups.map(group => {
            const clientTags = (group.client_ids || []).map(clientId => {
              const client = clients.find(c => c.id === clientId);
              return client ? <span key={clientId} className="client-tag">{client.ip_address}</span> : null;
            });
            return (
              <div key={group.id} className="group-card">
                <input
                  type="checkbox"
                  className="group-checkbox"
                  data-group-id={group.id}
                  checked={selectedGroups.has(group.id)}
                  onChange={e => onSelectGroup(group.id, e.target.checked)}
                  onClick={e => e.stopPropagation()}
                />
                <div className="group-content">
                  <div className="group-name">{group.name}</div>
                  <div className="group-info">{(group.client_ids || []).length}개 디스플레이 서버</div>
                  <div className="group-clients">{clientTags}</div>
                </div>
                <div className="group-actions">
                  <button className="btn btn-secondary" onClick={() => onEditGroup(group.id)} title="편집">✏️</button>
                  <button className="btn btn-danger" onClick={() => onDeleteGroup(group.id)} title="삭제">🗑️</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default GroupSection; 