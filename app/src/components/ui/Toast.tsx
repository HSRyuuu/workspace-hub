import { useSyncExternalStore } from "react";
import { useConfirmToast } from "./ConfirmToast";

type ToastKind = "error" | "hint";
type HintPosition = "right" | "center";

interface ToastState {
  kind: ToastKind;
  message: string;
  retry?: () => void;
  position?: HintPosition;
}

// ── Singleton store ───────────────────────────────────────────────────────────
let _state: ToastState | null = null;
let _queue: ToastState | null = null;
let _hintTimer: ReturnType<typeof setTimeout> | null = null;
const _subscribers = new Set<() => void>();

const HINT_AUTODISMISS_MS = 5000;

function _notify() {
  _subscribers.forEach((cb) => cb());
}

function _subscribe(cb: () => void): () => void {
  _subscribers.add(cb);
  return () => {
    _subscribers.delete(cb);
  };
}

function _getState(): ToastState | null {
  return _state;
}

function _clearHintTimer() {
  if (_hintTimer) {
    clearTimeout(_hintTimer);
    _hintTimer = null;
  }
}

/** ConfirmToast 표시 중이면 큐에 저장, 아니면 즉시 표시. */
export function showErrorToast(message: string, retry?: () => void) {
  _clearHintTimer();
  _state = { kind: "error", message, retry };
  _queue = null;
  _notify();
}

/** 정보성 힌트 토스트. 5초 후 자동 dismiss. position="center" 면 ConfirmToast 자리에 표시. */
export function showHintToast(message: string, position: HintPosition = "right") {
  _clearHintTimer();
  _state = { kind: "hint", message, position };
  _queue = null;
  _notify();
  _hintTimer = setTimeout(() => {
    if (_state?.kind === "hint") {
      _state = null;
      _notify();
    }
    _hintTimer = null;
  }, HINT_AUTODISMISS_MS);
}

export function dismissErrorToast() {
  _clearHintTimer();
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
  _clearHintTimer();
  _state = null;
  _queue = null;
  _subscribers.clear();
}

function useErrorToast() {
  return useSyncExternalStore(_subscribe, _getState, _getState);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Toast() {
  const toast = useErrorToast();
  const confirm = useConfirmToast();

  // ConfirmToast 표시 중이면 Toast 는 숨긴다 (우선순위 정책 §3.1)
  if (!toast || confirm) return null;

  if (toast.kind === "hint") {
    const positionCls =
      toast.position === "center" ? " error-toast--center" : "";
    return (
      <div
        className={`error-toast error-toast--hint${positionCls}`}
        role="status"
        data-testid="hint-toast"
      >
        <p className="error-toast-message">{toast.message}</p>
        <div className="error-toast-actions">
          <button className="btn btn-ghost" onClick={dismissErrorToast}>
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="error-toast" role="alert" data-testid="error-toast">
      <p className="error-toast-message">⚠ {toast.message}</p>
      <div className="error-toast-actions">
        {toast.retry && (
          <button className="btn btn-ghost" onClick={toast.retry}>
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
