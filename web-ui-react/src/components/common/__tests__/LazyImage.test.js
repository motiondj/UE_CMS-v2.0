import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LazyImage from '../LazyImage';

// IntersectionObserver 모킹
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

describe('LazyImage', () => {
  const defaultProps = {
    src: 'https://example.com/test-image.jpg',
    alt: 'Test Image'
  };

  beforeEach(() => {
    // 각 테스트 전에 IntersectionObserver 호출 초기화
    mockIntersectionObserver.mockClear();
  });

  test('renders placeholder initially', () => {
    render(<LazyImage {...defaultProps} />);
    
    // 플레이스홀더 이미지가 렌더링되는지 확인
    const placeholder = screen.getByRole('img', { hidden: true });
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  });

  test('shows error message when image fails to load', async () => {
    render(<LazyImage {...defaultProps} />);
    
    // IntersectionObserver가 호출되도록 시뮬레이션
    const observerCallback = mockIntersectionObserver.mock.calls[0][0];
    const mockEntry = {
      isIntersecting: true,
      target: document.createElement('div')
    };
    
    observerCallback([mockEntry]);
    
    // 에러 상태 시뮬레이션
    const errorImg = screen.getByAltText('Test Image');
    errorImg.dispatchEvent(new Event('error'));
    
    await waitFor(() => {
      expect(screen.getByText('이미지를 불러올 수 없습니다')).toBeInTheDocument();
    });
  });

  test('calls onLoad callback when image loads', async () => {
    const onLoadMock = jest.fn();
    render(<LazyImage {...defaultProps} onLoad={onLoadMock} />);
    
    // IntersectionObserver가 호출되도록 시뮬레이션
    const observerCallback = mockIntersectionObserver.mock.calls[0][0];
    const mockEntry = {
      isIntersecting: true,
      target: document.createElement('div')
    };
    
    observerCallback([mockEntry]);
    
    // 로드 성공 시뮬레이션
    const img = screen.getByAltText('Test Image');
    img.dispatchEvent(new Event('load'));
    
    await waitFor(() => {
      expect(onLoadMock).toHaveBeenCalled();
    });
  });

  test('calls onError callback when image fails', async () => {
    const onErrorMock = jest.fn();
    render(<LazyImage {...defaultProps} onError={onErrorMock} />);
    
    // IntersectionObserver가 호출되도록 시뮬레이션
    const observerCallback = mockIntersectionObserver.mock.calls[0][0];
    const mockEntry = {
      isIntersecting: true,
      target: document.createElement('div')
    };
    
    observerCallback([mockEntry]);
    
    // 에러 시뮬레이션
    const img = screen.getByAltText('Test Image');
    img.dispatchEvent(new Event('error'));
    
    await waitFor(() => {
      expect(onErrorMock).toHaveBeenCalled();
    });
  });

  test('uses custom placeholder', () => {
    const customPlaceholder = 'https://example.com/custom-placeholder.jpg';
    render(<LazyImage {...defaultProps} placeholder={customPlaceholder} />);
    
    const placeholder = screen.getByRole('img', { hidden: true });
    expect(placeholder).toHaveAttribute('src', customPlaceholder);
  });

  test('applies loading="lazy" attribute', () => {
    render(<LazyImage {...defaultProps} />);
    
    // IntersectionObserver가 호출되도록 시뮬레이션
    const observerCallback = mockIntersectionObserver.mock.calls[0][0];
    const mockEntry = {
      isIntersecting: true,
      target: document.createElement('div')
    };
    
    observerCallback([mockEntry]);
    
    const img = screen.getByAltText('Test Image');
    expect(img).toHaveAttribute('loading', 'lazy');
  });
}); 