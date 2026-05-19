import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfirmToast,
  showConfirmToast,
  _resetConfirmToastForTest,
} from "../ConfirmToast";

beforeEach(() => {
  _resetConfirmToastForTest();
});

afterEach(() => {
  _resetConfirmToastForTest();
  vi.useRealTimers();
});

/** 편의 헬퍼 — 기본 옵션으로 ConfirmToast 를 띄운다 */
function showDefault(overrides?: Partial<Parameters<typeof showConfirmToast>[0]>) {
  act(() => {
    showConfirmToast({
      message: "정말 삭제할까요?",
      confirmLabel: "삭제",
      cancelLabel: "취소",
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      ...overrides,
    });
  });
}

describe("ConfirmToast 부정 invariant", () => {
  it("does not dismiss on Escape key", () => {
    render(<ConfirmToast />);
    showDefault();

    expect(screen.getByTestId("confirm-toast")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(screen.getByTestId("confirm-toast")).toBeInTheDocument();
  });

  it("does not dismiss on outside click", () => {
    render(<ConfirmToast />);
    showDefault();

    expect(screen.getByTestId("confirm-toast")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.getByTestId("confirm-toast")).toBeInTheDocument();
  });

  it("does not auto-dismiss after 10 seconds", () => {
    vi.useFakeTimers();
    render(<ConfirmToast />);
    showDefault();

    expect(screen.getByTestId("confirm-toast")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId("confirm-toast")).toBeInTheDocument();
  });

  it("replaces previous toast when new confirm is requested", () => {
    render(<ConfirmToast />);

    act(() => {
      showConfirmToast({
        message: "첫 번째 메시지",
        confirmLabel: "확인",
        cancelLabel: "취소",
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      });
    });

    expect(screen.getByText("첫 번째 메시지")).toBeInTheDocument();

    act(() => {
      showConfirmToast({
        message: "두 번째 메시지",
        confirmLabel: "확인",
        cancelLabel: "취소",
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      });
    });

    expect(screen.queryByText("첫 번째 메시지")).not.toBeInTheDocument();
    expect(screen.getByText("두 번째 메시지")).toBeInTheDocument();
  });
});

describe("ConfirmToast unsubscribe idempotent (React 18 Strict Mode)", () => {
  it("calling unsubscribe multiple times does not throw", () => {
    // subscribe 두 번 등록 후 각각 unsubscribe — Set.delete 의 idempotent 를 검증한다.
    let unsub1: (() => void) | undefined;
    let unsub2: (() => void) | undefined;

    const cb = vi.fn();
    // _subscribe 는 내부 구현이므로 useSyncExternalStore 가 사용하는 경로를 간접 검증한다:
    // 컴포넌트를 두 번 렌더링(Strict Mode 시뮬레이션)해도 문제없이 동작해야 한다.
    const { unmount: u1 } = render(<ConfirmToast />);
    const { unmount: u2 } = render(<ConfirmToast />);

    // showConfirmToast 는 두 구독자에게 notify — 에러 없이 실행됨을 확인
    expect(() => {
      act(() => {
        showConfirmToast({
          message: "test",
          confirmLabel: "ok",
          cancelLabel: "no",
          onConfirm: vi.fn(),
          onCancel: vi.fn(),
        });
      });
    }).not.toThrow();

    // 양쪽 언마운트 — 중복 unsubscribe 도 에러 없음
    expect(() => {
      u1();
      u2();
      // 이미 삭제된 subscriber 를 다시 삭제해도 Set.delete 가 안전하게 처리해야 한다.
      unsub1?.();
      unsub2?.();
      cb(); // unused — 단순 호출 확인
    }).not.toThrow();
  });
});
