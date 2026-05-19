import { useCallback, useEffect, useRef } from "react";
import type { Todo, TodoPatch } from "../types";

export interface UseDebouncedUpdateOptions {
  updateFn: (id: number, patch: TodoPatch) => Promise<Todo>;
  onApply: (todo: Todo) => void;
  onRollback: (id: number) => void;
  onError: (msg: string, retry: () => void) => void;
}

/**
 * 낙관적 갱신 + debounce/즉시 발사 + stale 응답 폐기 + 언마운트 guard.
 *
 * - `debounce=true`(기본값): 500ms 후 발사. 동일 todo 재호출 시 이전 타이머 리셋.
 * - `debounce=false`: 즉시 발사. 대기 중인 타이머도 취소.
 * - per-todo monotonic seq 로 stale 응답(seq < currentSeq) 폐기.
 * - 컴포넌트 언마운트 후 인플라이트 응답은 콜백 호출 안 함.
 */
export function useDebouncedUpdate({
  updateFn,
  onApply,
  onRollback,
  onError,
}: UseDebouncedUpdateOptions): {
  update: (id: number, patch: TodoPatch, debounce?: boolean) => void;
} {
  const mountedRef = useRef(true);
  const seqRef = useRef(new Map<number, number>());
  const timerRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  // Latest-ref 패턴 — fire() 가 항상 최신 콜백을 사용하도록.
  const updateFnRef = useRef(updateFn);
  const onApplyRef = useRef(onApply);
  const onRollbackRef = useRef(onRollback);
  const onErrorRef = useRef(onError);

  // deps 배열 없음 → 매 렌더마다 최신 값 동기화
  useEffect(() => {
    updateFnRef.current = updateFn;
  });
  useEffect(() => {
    onApplyRef.current = onApply;
  });
  useEffect(() => {
    onRollbackRef.current = onRollback;
  });
  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timerRef.current.forEach(clearTimeout);
    };
  }, []);

  const fire = useCallback(async (id: number, patch: TodoPatch, seq: number) => {
    try {
      const updated = await updateFnRef.current(id, patch);
      if (!mountedRef.current) return; // (iv) 언마운트 guard
      const cur = seqRef.current.get(id) ?? 0;
      if (seq < cur) return; // (ii) stale 응답 폐기
      onApplyRef.current(updated);
    } catch (e) {
      if (!mountedRef.current) return;
      onRollbackRef.current(id);
      const msg = e instanceof Error ? e.message : String(e);
      onErrorRef.current(msg, () => {
        const newSeq = (seqRef.current.get(id) ?? 0) + 1;
        seqRef.current.set(id, newSeq);
        void fire(id, patch, newSeq);
      });
    }
  }, []); // 빈 deps — 모든 외부 참조는 ref 경유

  const update = useCallback(
    (id: number, patch: TodoPatch, debounce = true) => {
      const seq = (seqRef.current.get(id) ?? 0) + 1;
      seqRef.current.set(id, seq);

      const existing = timerRef.current.get(id);
      if (existing) {
        clearTimeout(existing);
        timerRef.current.delete(id);
      }

      if (debounce) {
        const timer = setTimeout(() => {
          timerRef.current.delete(id);
          void fire(id, patch, seq);
        }, 500);
        timerRef.current.set(id, timer);
      } else {
        void fire(id, patch, seq);
      }
    },
    [fire],
  );

  return { update };
}
