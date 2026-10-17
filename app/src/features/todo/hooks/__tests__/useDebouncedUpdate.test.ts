import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedUpdate } from "../useDebouncedUpdate";
import type { Todo } from "../../types";

function makeTodo(id: number): Todo {
  return {
    id,
    workspace_id: null,
    title: `Todo ${id}`,
    description: null,
    start_date: "2026-05-17",
    due_date: null,
    due_time: 0,
    priority: "mid",
    status: "open",
    completed_at: null,
    created_at: "2026-05-17T00:00:00Z",
    updated_at: "2026-05-17T00:00:00Z",
  };
}

describe("useDebouncedUpdate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("(debounce) fires API after 500ms and calls onApply", async () => {
    vi.useFakeTimers();
    const todo = makeTodo(1);
    const updated = { ...todo, title: "수정됨" };
    const updateFn = vi.fn().mockResolvedValue(updated);
    const onApply = vi.fn();
    const onRollback = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDebouncedUpdate({ updateFn, onApply, onRollback, onError }),
    );

    act(() => {
      result.current.update(1, { title: "수정됨" }, true); // debounced
    });

    // 500ms 이전 — API 미발사
    expect(updateFn).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
      // flush microtasks for the resolved promise
      await Promise.resolve();
    });

    expect(updateFn).toHaveBeenCalledWith(1, { title: "수정됨" });
    expect(onApply).toHaveBeenCalledWith(updated);
    expect(onRollback).not.toHaveBeenCalled();
  });

  it("(stale discard) discards response from earlier seq when a newer request has been issued", async () => {
    let resolveFirst!: (v: Todo) => void;
    let resolveSecond!: (v: Todo) => void;
    const first = new Promise<Todo>((res) => (resolveFirst = res));
    const second = new Promise<Todo>((res) => (resolveSecond = res));

    const todo1 = makeTodo(1);
    const todo2 = { ...makeTodo(1), title: "two" };
    const updateFn = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const onApply = vi.fn();
    const onRollback = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDebouncedUpdate({ updateFn, onApply, onRollback, onError }),
    );

    // 두 번 즉시 발사
    act(() => {
      result.current.update(1, { title: "one" }, false);
      result.current.update(1, { title: "two" }, false);
    });

    // 두 번째 응답 먼저 resolve → onApply 호출
    await act(async () => {
      resolveSecond(todo2);
      await Promise.resolve();
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(todo2);

    // 첫 번째 응답 뒤늦게 resolve → stale → 무시
    await act(async () => {
      resolveFirst(todo1);
      await Promise.resolve();
    });
    expect(onApply).toHaveBeenCalledTimes(1); // 여전히 1번만 호출됨
  });

  it("(unmount guard) does not call onApply after component unmounts", async () => {
    let resolveFn!: (v: Todo) => void;
    const deferred = new Promise<Todo>((res) => (resolveFn = res));
    const updateFn = vi.fn().mockReturnValue(deferred);
    const onApply = vi.fn();
    const onRollback = vi.fn();
    const onError = vi.fn();

    const { result, unmount } = renderHook(() =>
      useDebouncedUpdate({ updateFn, onApply, onRollback, onError }),
    );

    act(() => {
      result.current.update(1, { title: "test" }, false);
    });

    // 언마운트 후 응답 도착
    unmount();
    await act(async () => {
      resolveFn(makeTodo(1));
      await Promise.resolve();
    });

    // mountedRef.current = false → onApply 호출 없음
    expect(onApply).not.toHaveBeenCalled();
  });

  it("(rollback) calls onRollback and onError when API rejects", async () => {
    const updateFn = vi.fn().mockRejectedValue(new Error("네트워크 오류"));
    const onApply = vi.fn();
    const onRollback = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDebouncedUpdate({ updateFn, onApply, onRollback, onError }),
    );

    await act(async () => {
      result.current.update(1, { title: "실패" }, false);
      await Promise.resolve();
    });

    expect(onApply).not.toHaveBeenCalled();
    expect(onRollback).toHaveBeenCalledWith(1);
    expect(onError).toHaveBeenCalledWith("네트워크 오류", expect.any(Function));
  });
});
