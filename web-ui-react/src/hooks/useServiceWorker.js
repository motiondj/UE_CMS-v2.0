import { useEffect, useState, useCallback } from 'react';

const useServiceWorker = () => {
  const [registration, setRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offline, setOffline] = useState(false);
  const [cacheInfo, setCacheInfo] = useState(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          // 기존 Service Worker 완전 제거
          const existingRegistrations = await navigator.serviceWorker.getRegistrations();
          for (const existingRegistration of existingRegistrations) {
            await existingRegistration.unregister();
            console.log('🗑️ 기존 Service Worker 제거됨');
          }

          // 캐시 완전 정리
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
          console.log('🧹 캐시 완전 정리됨');

          // 새로운 Service Worker 등록
          const swRegistration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });

          console.log('✅ Service Worker 등록 성공:', swRegistration);

          // 업데이트 확인
          swRegistration.addEventListener('updatefound', () => {
            const newWorker = swRegistration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });

          setRegistration(swRegistration);

          // 페이지 새로고침 시 Service Worker 교체
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Service Worker 교체됨');
            window.location.reload();
          });

          // 메시지 수신
          navigator.serviceWorker.addEventListener('message', (event) => {
            const { type, data } = event.data;
            
            switch (type) {
              case 'SERVER_CONNECTED':
                setOffline(false);
                console.log('✅ 서버 연결됨');
                break;
                
              case 'SERVER_DISCONNECTED':
                setOffline(true);
                console.log('❌ 서버 연결 끊김');
                break;
                
              default:
                console.log('📨 Service Worker 메시지:', type, data);
            }
          });

        } catch (error) {
          console.error('❌ Service Worker 등록 실패:', error);
        }
      };

      registerSW();
    }
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [registration]);

  // 캐시 정보 조회
  const getCacheInfo = useCallback(() => {
    if (registration) {
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve) => {
        registration.active.postMessage(
          { type: 'GET_CACHE_INFO' },
          [messageChannel.port2]
        );
        
        messageChannel.port1.onmessage = (event) => {
          setCacheInfo(event.data);
          resolve(event.data);
        };
      });
    }
    return null;
  }, [registration]);

  // 캐시 정리
  const clearCache = useCallback(() => {
    if (registration) {
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
      setCacheInfo(null);
      console.log('🧹 캐시 정리 요청됨');
    }
  }, [registration]);

  // 백그라운드 동기화 등록
  const registerBackgroundSync = useCallback(async () => {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-sync');
        console.log('🔄 백그라운드 동기화 등록됨');
      } catch (error) {
        console.error('❌ 백그라운드 동기화 등록 실패:', error);
      }
    }
  }, []);

  // 네트워크 상태 모니터링
  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      console.log('🌐 온라인 상태');
      
      // 서버 연결 확인
      if (registration) {
        registerBackgroundSync();
      }
    };
    
    const handleOffline = () => {
      setOffline(true);
      console.log('📴 오프라인 상태');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 초기 상태 설정
    setOffline(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [registration, registerBackgroundSync]);

  return {
    registration,
    updateAvailable,
    offline,
    cacheInfo,
    updateServiceWorker,
    getCacheInfo,
    clearCache,
    registerBackgroundSync
  };
};

export default useServiceWorker; 