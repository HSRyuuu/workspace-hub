import { useSyncExternalStore } from "react";

export interface ConfirmToastOptions {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** 취소·dismiss 시 호출. 없으면 noop. */
  onCancel?: () => void;
}

// ── Singleton store ───────────────────────────────────────────────────────────
// useSyncExternalStore 기반 싱글톤. 새 호출이 이전 큐를 대체한다.

let _state: ConfirmToastOptions | null = null;
const _subscribers = new Set<() => void>();

function _notify() {
  _subscribers.forEach((cb) => cb());
}

function _subscribe(cb: () => void): () => void {
  _subscribers.add(cb);
  // Set.delete 는 원소 없어도 안전 → unsubscribe idempotent 보장
  return () => {
    _subscribers.delete(cb);
  };
}

function _getState(): ConfirmToastOptions | null {
  return _state;
}

export function showConfirmToast(opts: ConfirmToastOptions) {
  _state = opts;
  _notify();
}

export function dismissConfirmToast() {
  _state = null;
  _notify();
}

/** 테스트 격리용 — 프로덕션 코드에서는 호출하지 않는다. */
export function _resetConfirmToastForTest() {
  _state = null;
  _subscribers.clear();
}

export function useConfirmToast() {
  return useSyncExternalStore(_subscribe, _getState, _getState);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ConfirmToast() {
  const toast = useConfirmToast();
  if (!toast) return null;

  const handleConfirm = () => {
    dismissConfirmToast();
    toast.onConfirm();
  };
  const handleCancel = () => {
    dismissConfirmToast();
    toast.onCancel?.();
  };

  return (
    <div className="confirm-toast" role="dialog" aria-modal="true" data-testid="confirm-toast">
      <p className="confirm-toast-message">{toast.message}</p>
      <div className="confirm-toast-actions">
        <button className="btn btn-ghost" onClick={handleCancel}>
          {toast.cancelLabel}
        </button>
        <button className="btn btn-primary" onClick={handleConfirm}>
          {toast.confirmLabel}
        </button>
      </div>
    </div>
  );
}
