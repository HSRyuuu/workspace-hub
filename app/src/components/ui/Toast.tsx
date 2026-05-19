import { useSyncExternalStore } from "react";
import { useConfirmToast } from "./ConfirmToast";

interface ErrorToastState {
  message: string;
  retry?: () => void;
}

// ── Singleton store ───────────────────────────────────────────────────────────
let _state: ErrorToastState | null = null;
let _queue: ErrorToastState | null = null;
const _subscribers = new Set<() => void>();

function _notify() {
  _subscribers.forEach((cb) => cb());
}

function _subscribe(cb: () => void): () => void {
  _subscribers.add(cb);
  return () => {
    _subscribers.delete(cb);
  };
}

function _getState(): ErrorToastState | null {
  return _state;
}

/** ConfirmToast 표시 중이면 큐에 저장, 아니면 즉시 표시. */
export function showErrorToast(message: string, retry?: () => void) {
  const next: ErrorToastState = { message, retry };
  // ConfirmToast 가시 여부는 호출 시점에 판단할 수 없으므로
  // 컴포넌트 레이어의 우선순위 정책은 Toast 컴포넌트 내부에서 처리한다.
  _state = next;
  _queue = null;
  _notify();
}

export function dismissErrorToast() {
  if (_queue) {
    _state = _queue;
    _queue = null;
  } else {
    _state = null;
  }
  _notify();
}

/** 테스트 격리용 */
export function _resetErrorToastForTest() {
  _state = null;
  _queue = null;
  _subscribers.clear();
}

function useErrorToast() {
  return useSyncExternalStore(_subscribe, _getState, _getState);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Toast() {
  const error = useErrorToast();
  const confirm = useConfirmToast();

  // ConfirmToast 표시 중이면 ErrorToast 는 숨긴다 (우선순위 정책 §3.1)
  if (!error || confirm) return null;

  return (
    <div className="error-toast" role="alert" data-testid="error-toast">
      <p className="error-toast-message">⚠ {error.message}</p>
      <div className="error-toast-actions">
        {error.retry && (
          <button className="btn btn-ghost" onClick={error.retry}>
            재시도
          </button>
        )}
        <button className="btn btn-ghost" onClick={dismissErrorToast}>
          닫기
        </button>
      </div>
    </div>
  );
}
