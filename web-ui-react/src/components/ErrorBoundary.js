import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // 에러 로깅 서비스로 전송 (예: Sentry)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // 개발 환경에서는 상세 에러 표시
      if (process.env.NODE_ENV === 'development') {
        return (
          <div className="error-boundary-container">
            <div className="error-boundary-content">
              <h1 className="error-title">⚠️ 오류가 발생했습니다</h1>
              <div className="error-details">
                <h3>에러 메시지:</h3>
                <pre>{this.state.error && this.state.error.toString()}</pre>
                <h3>컴포넌트 스택:</h3>
                <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
              </div>
              <div className="error-actions">
                <button onClick={this.handleReset} className="btn btn-primary">
                  다시 시도
                </button>
                <button onClick={() => window.location.reload()} className="btn btn-secondary">
                  페이지 새로고침
                </button>
              </div>
            </div>
          </div>
        );
      }

      // 프로덕션 환경에서는 간단한 에러 표시
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <h1 className="error-title">⚠️ 문제가 발생했습니다</h1>
            <p className="error-message">
              일시적인 오류가 발생했습니다. 불편을 드려 죄송합니다.
            </p>
            <div className="error-actions">
              <button onClick={this.handleReset} className="btn btn-primary">
                다시 시도
              </button>
              <button onClick={() => window.location.reload()} className="btn btn-secondary">
                페이지 새로고침
              </button>
            </div>
            {this.state.errorCount > 2 && (
              <p className="error-hint">
                오류가 계속 발생한다면 관리자에게 문의해주세요.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 