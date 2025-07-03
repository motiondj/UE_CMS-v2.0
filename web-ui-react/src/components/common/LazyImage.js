import React, { useState, useEffect, useRef } from 'react';
import './LazyImage.css';

const LazyImage = ({ 
  src, 
  alt, 
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YWFhYSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
  className = '',
  onLoad,
  onError,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    // Intersection Observer를 사용한 lazy loading
    if ('IntersectionObserver' in window) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsInView(true);
              observerRef.current.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: '50px', // 50px 전에 미리 로드
          threshold: 0.01
        }
      );

      if (imgRef.current) {
        observerRef.current.observe(imgRef.current);
      }
    } else {
      // Intersection Observer를 지원하지 않는 브라우저
      setIsInView(true);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
    if (onError) onError();
  };

  return (
    <div 
      ref={imgRef}
      className={`lazy-image-container ${className}`}
      {...props}
    >
      {/* 플레이스홀더 이미지 */}
      <img
        src={placeholder}
        alt=""
        className={`lazy-image-placeholder ${isLoaded ? 'hidden' : ''}`}
        aria-hidden="true"
      />
      
      {/* 실제 이미지 */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`lazy-image ${isLoaded ? 'loaded' : ''} ${hasError ? 'error' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
      
      {/* 에러 상태 */}
      {hasError && (
        <div className="lazy-image-error">
          <span>이미지를 불러올 수 없습니다</span>
        </div>
      )}
    </div>
  );
};

export default LazyImage; 