import React from 'react';
import './OfflineIndicator.css';

const OfflineIndicator = ({ 
  offline, 
  updateAvailable, 
  onApplyUpdate, 
  cacheInfo 
}) => {
  if (!offline && !updateAvailable) {
    return null;
  }

  return (
    <div className="offline-indicator-container">
      {offline && (
        <div className="offline-banner">
          <div className="offline-content">
            <span className="offline-icon">📴</span>
            <span className="offline-text">오프라인 모드 - 캐시된 데이터를 사용합니다</span>
          </div>
        </div>
      )}
      
      {updateAvailable && (
        <div className="update-banner">
          <div className="update-content">
            <span className="update-icon">🔄</span>
            <span className="update-text">새로운 업데이트가 있습니다</span>
            <button 
              className="btn btn-primary btn-sm"
              onClick={onApplyUpdate}
            >
              업데이트 적용
            </button>
          </div>
        </div>
      )}
      
      {cacheInfo && (
        <div className="cache-info">
          <span className="cache-text">
            캐시: {cacheInfo.staticFiles}개 파일, {cacheInfo.apiResponses}개 API
          </span>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator; 