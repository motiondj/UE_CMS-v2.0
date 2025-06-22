import React from 'react';

const PresetSection = ({
  presets,
  groups,
  selectedPresets,
  onSelectAll,
  onBulkAction,
  onAddPreset,
  onEditPreset,
  onDeletePreset,
  onExecutePreset,
  onSelectPreset
}) => {
  const allSelected = presets.length > 0 && selectedPresets.size === presets.length;

  return (
    <div className="section">
      <h2 className="section-title">
        📋 콘텐츠 프리셋
        <button className="btn btn-secondary btn-with-text" onClick={onAddPreset}>
          ➕ 새 프리셋
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
          <span>선택된 프리셋: <span>{selectedPresets.size}</span>개</span>
        </div>
        <div className="bulk-actions">
          <button className="btn btn-primary btn-bulk" onClick={() => onBulkAction('execute')} title="선택된 프리셋들 전체 실행">
            ▶️
          </button>
          <button className="btn btn-danger btn-bulk" onClick={() => onBulkAction('stop')} title="선택된 프리셋들 전체 정지">
            ⏹️
          </button>
          <button className="btn btn-danger btn-bulk" onClick={() => onBulkAction('delete')} title="선택된 프리셋들 전체 삭제">
            🗑️
          </button>
        </div>
      </div>
      <div className="preset-grid" id="presetGrid">
        {presets.length === 0 ? (
          <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)'}}>
            <div style={{fontSize: 48, marginBottom: 16}}>📝</div>
            <div style={{fontSize: 14, marginBottom: 8}}>아직 생성된 프리셋이 없습니다</div>
            <div style={{fontSize: 12}}>새 프리셋 버튼을 클릭해서 첫 번째 프리셋을 만들어보세요!</div>
          </div>
        ) : (
          presets.map(preset => {
            // 새로운 구조에 맞게 그룹 정보 가져오기
            const group = groups.find(g => g.id === preset.group_id);
            const groupName = group ? group.name : '삭제된 그룹';
            const clientCount = preset.client_commands ? Object.keys(preset.client_commands).length : 0;
            
            return (
              <div key={preset.id} className={`preset-card${preset.is_active ? ' active' : ''}`} id={`preset-${preset.id}`}>
                <input
                  type="checkbox"
                  className="preset-checkbox"
                  data-preset-id={preset.id}
                  checked={selectedPresets.has(preset.id)}
                  onChange={e => onSelectPreset(preset.id, e.target.checked)}
                  onClick={e => e.stopPropagation()}
                />
                <div className="preset-content">
                  <div className="preset-name">{preset.name}</div>
                  {preset.description && <div className="preset-info">{preset.description}</div>}
                  <div className="preset-info">그룹: {groupName}</div>
                  <div className="preset-info">{clientCount}대 클라이언트</div>
                </div>
                <div className="preset-actions">
                  <button className="btn btn-primary" onClick={() => onExecutePreset(preset.id)} title="실행">▶️</button>
                  <button className="btn btn-secondary" onClick={() => onEditPreset(preset.id)} title="편집">✏️</button>
                  <button className="btn btn-danger" onClick={() => onDeletePreset(preset.id)} title="삭제">🗑️</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PresetSection; 