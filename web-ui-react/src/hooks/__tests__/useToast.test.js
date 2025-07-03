import { renderHook, act } from '@testing-library/react';
import useToast from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('initializes with empty toasts array', () => {
    const { result } = renderHook(() => useToast());
    
    expect(result.current.toasts).toEqual([]);
  });

  test('shows toast with default type', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Test message');
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toEqual({
      id: 0,
      message: 'Test message',
      type: 'info',
      duration: 4000
    });
  });

  test('shows toast with custom type and duration', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Success message', 'success', 6000);
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toEqual({
      id: 0,
      message: 'Success message',
      type: 'success',
      duration: 6000
    });
  });

  test('removes toast after duration', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Test message', 'info', 1000);
    });
    
    expect(result.current.toasts).toHaveLength(1);
    
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });

  test('removes specific toast by id', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('First message');
      result.current.showToast('Second message');
    });
    
    expect(result.current.toasts).toHaveLength(2);
    
    act(() => {
      result.current.removeToast(0);
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second message');
  });

  test('clears all toasts', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('First message');
      result.current.showToast('Second message');
      result.current.showToast('Third message');
    });
    
    expect(result.current.toasts).toHaveLength(3);
    
    act(() => {
      result.current.clearToasts();
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });

  test('increments toast id for each new toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('First message');
      result.current.showToast('Second message');
      result.current.showToast('Third message');
    });
    
    expect(result.current.toasts[0].id).toBe(0);
    expect(result.current.toasts[1].id).toBe(1);
    expect(result.current.toasts[2].id).toBe(2);
  });

  test('handles multiple toasts with different durations', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Short message', 'info', 1000);
      result.current.showToast('Long message', 'success', 3000);
    });
    
    expect(result.current.toasts).toHaveLength(2);
    
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Long message');
    
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    
    expect(result.current.toasts).toHaveLength(0);
  });
}); 