import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatsBar from '../StatsBar';

describe('StatsBar', () => {
  const defaultProps = {
    totalClients: 10,
    onlineClients: 8,
    runningClients: 3,
    activeExecutions: 2,
    totalGroups: 5,
    totalPresets: 7,
    totalRunningPresets: 2
  };

  const zeroProps = {
    totalClients: 0,
    onlineClients: 0,
    runningClients: 0,
    activeExecutions: 0,
    totalGroups: 0,
    totalPresets: 0,
    totalRunningPresets: 0
  };

  test('renders all stats correctly', () => {
    render(<StatsBar {...defaultProps} />);

    // 전체 디스플레이 서버 수
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('🖥️ 전체 디스플레이 서버')).toBeInTheDocument();

    // 온라인 클라이언트 수
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('🟢 온라인')).toBeInTheDocument();

    // 실행 중 클라이언트 수
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('⚡ 실행 중')).toBeInTheDocument();

    // 프리셋 수 (실행 중 표시 포함)
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('📋 프리셋 (실행 중)')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();

    // 그룹 수
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('👥 그룹 수')).toBeInTheDocument();
  });

  test('handles zero values correctly', () => {
    render(<StatsBar {...zeroProps} />);

    // 모든 값이 0인지 확인 (특정 위치의 값만 확인)
    const statValues = screen.getAllByText('0');
    expect(statValues).toHaveLength(5); // 5개의 통계 항목

    // 라벨들이 올바르게 표시되는지 확인
    expect(screen.getByText('🖥️ 전체 디스플레이 서버')).toBeInTheDocument();
    expect(screen.getByText('🟢 온라인')).toBeInTheDocument();
    expect(screen.getByText('⚡ 실행 중')).toBeInTheDocument();
    expect(screen.getByText('📋 프리셋')).toBeInTheDocument();
    expect(screen.getByText('👥 그룹 수')).toBeInTheDocument();
  });

  test('renders with correct structure', () => {
    render(<StatsBar {...defaultProps} />);

    // 기본 구조 확인
    expect(screen.getByText('🖥️ 전체 디스플레이 서버')).toBeInTheDocument();
    expect(screen.getByText('🟢 온라인')).toBeInTheDocument();
    expect(screen.getByText('⚡ 실행 중')).toBeInTheDocument();
    expect(screen.getByText('📋 프리셋 (실행 중)')).toBeInTheDocument();
    expect(screen.getByText('👥 그룹 수')).toBeInTheDocument();
  });

  test('shows running presets indicator when there are running presets', () => {
    render(<StatsBar {...defaultProps} />);

    // 실행 중인 프리셋이 있을 때 표시되는 요소들
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('📋 프리셋 (실행 중)')).toBeInTheDocument();
  });

  test('does not show running presets indicator when no running presets', () => {
    const propsWithoutRunning = {
      ...defaultProps,
      totalRunningPresets: 0
    };
    
    render(<StatsBar {...propsWithoutRunning} />);

    // 실행 중인 프리셋이 없을 때는 표시되지 않음
    expect(screen.queryByText('(0)')).not.toBeInTheDocument();
    expect(screen.getByText('📋 프리셋')).toBeInTheDocument();
    expect(screen.queryByText('📋 프리셋 (실행 중)')).not.toBeInTheDocument();
  });
}); 