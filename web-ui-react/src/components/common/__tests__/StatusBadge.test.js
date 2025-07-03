import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
  test('renders online status correctly', () => {
    render(<StatusBadge status="online" />);
    
    expect(screen.getByText('온라인')).toBeInTheDocument();
    expect(screen.getByText('🟢')).toBeInTheDocument();
  });

  test('renders running status correctly', () => {
    render(<StatusBadge status="running" />);
    
    expect(screen.getByText('실행 중')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  test('renders offline status correctly', () => {
    render(<StatusBadge status="offline" />);
    
    expect(screen.getByText('오프라인')).toBeInTheDocument();
    expect(screen.getByText('🔴')).toBeInTheDocument();
  });

  test('renders error status correctly', () => {
    render(<StatusBadge status="error" />);
    
    expect(screen.getByText('오류')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  test('renders default status correctly', () => {
    render(<StatusBadge status="unknown" />);
    
    expect(screen.getByText('unknown')).toBeInTheDocument();
    expect(screen.getByText('⚪')).toBeInTheDocument();
  });

  test('hides icon when showIcon is false', () => {
    render(<StatusBadge status="online" showIcon={false} />);
    
    expect(screen.getByText('온라인')).toBeInTheDocument();
    expect(screen.queryByText('🟢')).not.toBeInTheDocument();
  });

  test('handles Korean status text correctly', () => {
    render(<StatusBadge status="콘텐츠 실행 중" />);

    expect(screen.getByText('실행 중')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });
}); 