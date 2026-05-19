import { useCallback, useEffect, useMemo, useState } from "react";

export type SaveState = "idle" | "saving" | "saved";

interface UseSaveIndicatorReturn {
  state: SaveState;
  lastSavedAt: number | null;
  /** typing 시 호출 — "저장 중…" 으로 전환. */
  markSaving: () => void;
  /** debounce 저장 또는 flush 성공 시 호출. timestamp 박힘. */
  markSaved: (now?: number) => void;
  /** 메모 전환 시 호출 — 인디케이터 숨김. */
  reset: () => void;
  /** 렌더용 라벨. idle 이면 null. */
  label: string | null;
}

export function useSaveIndicator(): UseSaveIndicatorReturn {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // state="saved" 동안에만 30s 마다 ++ — 상대시간 라벨("방금" → "1분 전")이 실제로 갱신되게 한다.
  const [tick, setTick] = useState(0);

  const markSaving = useCallback(() => setState("saving"), []);
  const markSaved = useCallback((now: number = Date.now()) => {
    setState("saved");
    setLastSavedAt(now);
  }, []);
  const reset = useCallback(() => {
    setState("idle");
    setLastSavedAt(null);
    setTick(0);
  }, []);

  useEffect(() => {
    if (state !== "saved") return;
    const handle = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(handle);
  }, [state, lastSavedAt]);

  // 반환 객체 reference 를 useMemo 로 안정화 — MemoPage 의 useCallback/useEffect deps 에
  // saveIndicator 통째로 들어갈 때 매 렌더 새 객체로 인한 무한 재실행 회피.
  return useMemo(() => {
    const label =
      state === "idle"
        ? null
        : state === "saving"
          ? "저장 중…"
          : `저장됨 · ${formatRelative(lastSavedAt ?? Date.now(), Date.now())}`;
    return { state, lastSavedAt, markSaving, markSaved, reset, label };
    // tick 은 label 재계산 트리거 용도 — 의도적으로 deps 에 포함.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lastSavedAt, tick, markSaving, markSaved, reset]);
}

/** 두 timestamp(ms) 의 차이를 한국어 상대 시간으로. < 30s → "방금", < 1h → "N분 전", else "N시간 전". */
export function formatRelative(then: number, now: number): string {
  const diff = Math.max(0, now - then);
  if (diff < 30_000) return "방금";
  if (diff < 60 * 60_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins}분 전`;
  }
  const hours = Math.floor(diff / (60 * 60_000));
  return `${hours}시간 전`;
}
