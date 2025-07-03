import React, { lazy, Suspense } from 'react';
import './LoadingSpinner.css';

// Lazy 로딩 컴포넌트들
export const ClientDetailModal = lazy(() => import('./ClientDetailModal'));
export const GroupModal = lazy(() => import('./GroupModal'));
export const PresetModal = lazy(() => import('./PresetModal'));
export const AddClientModal = lazy(() => import('./AddClientModal'));

// 로딩 스피너 컴포넌트
export const LoadingSpinner = ({ message = '로딩 중...' }) => (
  <div className="loading-spinner-container">
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  </div>
);

// Lazy 컴포넌트 래퍼
export const LazyComponent = ({ component: Component, fallback, ...props }) => (
  <Suspense fallback={fallback || <LoadingSpinner />}>
    <Component {...props} />
  </Suspense>
); 