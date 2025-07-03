import React, { useState, useEffect, useRef, useCallback } from 'react';

const NavigableList = ({ 
  children, 
  onItemSelect,
  onItemActivate,
  className = ''
}) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef(null);
  const itemsRef = useRef([]);

  const handleKeyDown = useCallback((e) => {
    const items = itemsRef.current.filter(Boolean);
    const maxIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < maxIndex ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : maxIndex
        );
        break;
        
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
        
      case 'End':
        e.preventDefault();
        setFocusedIndex(maxIndex);
        break;
        
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && onItemActivate) {
          onItemActivate(focusedIndex);
        }
        break;
        
      case 'Tab':
        // Tab 키로 다음 요소로 이동 시 포커스 초기화
        setFocusedIndex(-1);
        break;
        
      default:
        // 다른 키는 처리하지 않음
        break;
    }
  }, [focusedIndex, onItemActivate]);

  useEffect(() => {
    const item = itemsRef.current[focusedIndex];
    if (item) {
      item.focus();
      item.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
      
      if (onItemSelect) {
        onItemSelect(focusedIndex);
      }
    }
  }, [focusedIndex, onItemSelect]);

  return (
    <div 
      ref={listRef}
      className={`navigable-list ${className}`}
      onKeyDown={handleKeyDown}
      role="list"
    >
      {React.Children.map(children, (child, index) => 
        React.cloneElement(child, {
          ref: el => itemsRef.current[index] = el,
          tabIndex: focusedIndex === index ? 0 : -1,
          'aria-selected': focusedIndex === index,
          'data-focused': focusedIndex === index,
          role: 'listitem',
        })
      )}
    </div>
  );
};

export default NavigableList;