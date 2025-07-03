import config from '../config/environment';

class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.reportCallback = null;
    this.isEnabled = config.DEBUG_MODE;
  }

  // 컴포넌트 렌더링 시간 측정
  measureComponent(componentName, callback) {
    if (!this.isEnabled) {
      return callback();
    }

    const startTime = performance.now();
    
    const result = callback();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.recordMetric(`component_render_${componentName}`, duration);
    
    return result;
  }

  // API 호출 시간 측정
  async measureApiCall(endpoint, callback) {
    if (!this.isEnabled) {
      return callback();
    }

    const startTime = performance.now();
    
    try {
      const result = await callback();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(`api_call_${endpoint}`, duration);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(`api_call_error_${endpoint}`, duration);
      throw error;
    }
  }

  // 메모리 사용량 측정
  measureMemory() {
    if (!this.isEnabled || !performance.memory) {
      return null;
    }

    const memory = performance.memory;
    this.recordMetric('memory_used', memory.usedJSHeapSize);
    this.recordMetric('memory_total', memory.totalJSHeapSize);
    this.recordMetric('memory_limit', memory.jsHeapSizeLimit);
    
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }

  // 네트워크 상태 측정
  measureNetwork() {
    if (!this.isEnabled || !navigator.connection) {
      return null;
    }

    const connection = navigator.connection;
    this.recordMetric('network_effective_type', connection.effectiveType);
    this.recordMetric('network_downlink', connection.downlink);
    this.recordMetric('network_rtt', connection.rtt);
    
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }

  // 메트릭 기록
  recordMetric(name, value) {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    
    this.metrics[name].push({
      value,
      timestamp: new Date().toISOString()
    });
    
    // 최대 100개까지만 보관
    if (this.metrics[name].length > 100) {
      this.metrics[name].shift();
    }
    
    // 개발 환경에서만 콘솔 출력
    if (config.IS_DEVELOPMENT) {
      console.log(`📊 Performance: ${name} = ${value.toFixed(2)}ms`);
    }
  }

  // 성능 리포트 생성
  generateReport() {
    const report = {};
    
    Object.keys(this.metrics).forEach(name => {
      const values = this.metrics[name].map(m => m.value);
      if (values.length > 0) {
        report[name] = {
          count: values.length,
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          last: values[values.length - 1]
        };
      }
    });
    
    return report;
  }

  // 성능 경고 체크
  checkPerformanceWarnings() {
    const warnings = [];
    const report = this.generateReport();
    
    // 렌더링 시간 경고
    Object.keys(report).forEach(metric => {
      if (metric.startsWith('component_render_') && report[metric].average > 16) {
        warnings.push(`${metric}: 평균 렌더링 시간이 16ms를 초과합니다 (${report[metric].average.toFixed(2)}ms)`);
      }
      
      if (metric.startsWith('api_call_') && report[metric].average > 1000) {
        warnings.push(`${metric}: 평균 API 호출 시간이 1초를 초과합니다 (${report[metric].average.toFixed(2)}ms)`);
      }
    });
    
    // 메모리 사용량 경고
    const memory = this.measureMemory();
    if (memory && memory.percentage > 80) {
      warnings.push(`메모리 사용량이 80%를 초과합니다 (${memory.percentage.toFixed(1)}%)`);
    }
    
    return warnings;
  }

  // Web Vitals 측정
  measureWebVitals() {
    if (!this.isEnabled || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('lcp', lastEntry.renderTime || lastEntry.loadTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          this.recordMetric('fid', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let cls = 0;
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        });
        this.recordMetric('cls', cls);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('Web Vitals 측정 중 오류:', error);
    }
  }

  // 성능 모니터링 시작
  startMonitoring() {
    if (!this.isEnabled) {
      return;
    }

    this.measureWebVitals();
    
    // 주기적 메트릭 수집
    setInterval(() => {
      this.measureMemory();
      this.measureNetwork();
      
      // 성능 경고 체크
      const warnings = this.checkPerformanceWarnings();
      if (warnings.length > 0) {
        console.warn('🚨 성능 경고:', warnings);
      }
    }, 30000); // 30초마다
  }
}

const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor; 