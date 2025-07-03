# 공통 컴포넌트 (Common Components)

이 디렉토리에는 재사용 가능한 공통 컴포넌트들이 포함되어 있습니다.

## LazyImage

이미지 lazy loading을 위한 컴포넌트입니다.

### 사용법

```jsx
import LazyImage from './components/common/LazyImage';

// 기본 사용법
<LazyImage 
  src="https://example.com/image.jpg" 
  alt="설명" 
/>

// 커스텀 플레이스홀더
<LazyImage 
  src="https://example.com/image.jpg" 
  alt="설명"
  placeholder="https://example.com/placeholder.jpg"
/>

// 콜백 함수
<LazyImage 
  src="https://example.com/image.jpg" 
  alt="설명"
  onLoad={() => console.log('이미지 로드 완료')}
  onError={() => console.log('이미지 로드 실패')}
/>

// 스타일 클래스
<LazyImage 
  src="https://example.com/image.jpg" 
  alt="설명"
  className="custom-class"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | string | - | 이미지 URL (필수) |
| `alt` | string | - | 이미지 대체 텍스트 (필수) |
| `placeholder` | string | 기본 SVG | 로딩 중 표시할 플레이스홀더 |
| `className` | string | '' | 추가 CSS 클래스 |
| `onLoad` | function | - | 이미지 로드 완료 시 콜백 |
| `onError` | function | - | 이미지 로드 실패 시 콜백 |

### 특징

- **Intersection Observer API** 사용으로 성능 최적화
- **자동 에러 처리** 및 사용자 친화적 메시지
- **부드러운 전환 애니메이션**
- **접근성 지원** (aria-hidden, alt 텍스트)
- **반응형 디자인** 지원

## StatusBadge

상태를 표시하는 배지 컴포넌트입니다.

### 사용법

```jsx
import StatusBadge from './components/common/StatusBadge';

// 기본 사용법
<StatusBadge status="online" />

// 크기 조절
<StatusBadge status="running" size="large" />

// 아이콘 숨김
<StatusBadge status="offline" showIcon={false} />
```

### 지원하는 상태

- `online` - 온라인 (🟢)
- `running` - 실행 중 (⚡)
- `offline` - 오프라인 (🔴)
- `error` - 오류 (⚠️)
- 기타 - 기본 (⚪)

### 크기 옵션

- `small` - 작은 크기
- `medium` - 중간 크기 (기본)
- `large` - 큰 크기

## Modal

모달 다이얼로그 컴포넌트입니다.

### 사용법

```jsx
import Modal from './components/common/Modal';

<Modal 
  isOpen={showModal} 
  onClose={() => setShowModal(false)}
  title="모달 제목"
>
  <p>모달 내용</p>
</Modal>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | false | 모달 표시 여부 |
| `onClose` | function | - | 닫기 콜백 |
| `title` | string | - | 모달 제목 |
| `size` | string | 'medium' | 크기 (small/medium/large) |
| `showCloseButton` | boolean | true | 닫기 버튼 표시 여부 |
| `closeOnOverlayClick` | boolean | true | 오버레이 클릭 시 닫기 |
| `closeOnEsc` | boolean | true | ESC 키로 닫기 |

## ConfirmDialog

확인 다이얼로그 컴포넌트입니다.

### 사용법

```jsx
import ConfirmDialog from './components/common/ConfirmDialog';

<ConfirmDialog
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={() => {
    // 확인 시 실행할 로직
    setShowConfirm(false);
  }}
  title="삭제 확인"
  message="정말로 삭제하시겠습니까?"
  confirmText="삭제"
  cancelText="취소"
  type="danger"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | false | 다이얼로그 표시 여부 |
| `onClose` | function | - | 취소 콜백 |
| `onConfirm` | function | - | 확인 콜백 |
| `title` | string | '확인' | 제목 |
| `message` | string | - | 메시지 |
| `confirmText` | string | '확인' | 확인 버튼 텍스트 |
| `cancelText` | string | '취소' | 취소 버튼 텍스트 |
| `type` | string | 'default' | 타입 (default/danger/warning) | 