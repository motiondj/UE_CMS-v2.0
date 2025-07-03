import { useEffect, useCallback } from 'react';

const useKeyboardNavigation = (shortcuts = {}) => {
  const handleKeyDown = useCallback((e) => {
    // Ctrl/Cmd + Key 조합
    const key = e.key.toLowerCase();
    const withCtrl = e.ctrlKey || e.metaKey;
    const withShift = e.shiftKey;
    const withAlt = e.altKey;

    // 단축키 조합 생성
    let combo = '';
    if (withCtrl) combo += 'ctrl+';
    if (withShift) combo += 'shift+';
    if (withAlt) combo += 'alt+';
    combo += key;

    // 해당 단축키가 있으면 실행
    if (shortcuts[combo]) {
      e.preventDefault();
      shortcuts[combo](e);
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

export default useKeyboardNavigation; 