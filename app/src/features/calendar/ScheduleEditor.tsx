import { useEffect, useState } from "react";
import { Button, ColorSwatch, DateField, TimeField, showConfirmToast } from "../../components/ui";
import { TrashIcon } from "../../components/ui/icons";
import { scheduleApi } from "./api";
import { buildLocalIso, formatDateLocal, parseUtcIso } from "./dateUtils";
import type { Schedule } from "./types";

/** 새 일정 작성 모드(기존 = null) 또는 기존 일정 편집 모드 */
interface ScheduleEditorProps {
  existing: Schedule | null;
  /** compose 모드일 때 기본 날짜 (`YYYY-MM-DD`) */
  defaultDayIso: string | null;
  onSaved: (s: Schedule) => void;
  onDeleted: (id: number) => void;
  onCancel: () => void;
}

function defaultsFor(existing: Schedule | null, defaultDayIso: string | null) {
  if (existing) {
    const s = parseUtcIso(existing.start_at);
    const e = parseUtcIso(existing.end_at);
    return {
      title: existing.title,
      startDate: formatDateLocal(existing.start_at),
      startTime: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      endDate: formatDateLocal(existing.end_at),
      endTime: `${pad(e.getHours())}:${pad(e.getMinutes())}`,
      allDay: existing.all_day,
      description: existing.description ?? "",
      location: existing.location ?? "",
      color: (existing.color ?? "").toUpperCase(),
    };
  }
  const dayIso = defaultDayIso ?? "";
  return {
    title: "",
    startDate: dayIso,
    startTime: "09:00",
    endDate: dayIso,
    endTime: "10:00",
    allDay: false,
    description: "",
    location: "",
    color: "",
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseHM(s: string): [number, number] {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

function buildIso(date: string, time: string, allDay: boolean, end: boolean): string {
  const md = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!md) return "";
  const [, y, m, d] = md;
  const [h, mi] = allDay ? (end ? [23, 59] : [0, 0]) : parseHM(time);
  return buildLocalIso(Number(y), Number(m), Number(d), h, mi);
}

export function ScheduleEditor({
  existing,
  defaultDayIso,
  onSaved,
  onDeleted,
  onCancel,
}: ScheduleEditorProps) {
  const [state, setState] = useState(() => defaultsFor(existing, defaultDayIso));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(defaultsFor(existing, defaultDayIso));
    setError(null);
    // existing 의 id 가 같아도 다른 필드가 갱신되면(예: 저장 후 refresh) 폼이 stale 해지므로 updated_at 도 deps 에 포함.
  }, [existing?.id, existing?.updated_at, defaultDayIso]);

  const isNew = existing === null;

  function patchState<K extends keyof typeof state>(key: K, value: typeof state[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!state.title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    if (!state.startDate || !state.endDate) {
      setError("시작·종료 날짜를 선택하세요.");
      return;
    }
    const start = buildIso(state.startDate, state.startTime, state.allDay, false);
    const end = buildIso(state.endDate, state.endTime, state.allDay, true);
    setError(null);
    setBusy(true);
    try {
      const saved = isNew
        ? await scheduleApi.add({
            title: state.title.trim(),
            start,
            end,
            all_day: state.allDay,
            description: state.description || null,
            location: state.location || null,
            color: state.color || null,
          })
        : await scheduleApi.update(existing!.id, {
            title: state.title.trim(),
            start,
            end,
            all_day: state.allDay,
            description: state.description,
            location: state.location,
            color: state.color,
          });
      onSaved(saved);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!existing) return;
    const id = existing.id;
    showConfirmToast({
      message: "이 일정을 삭제하시겠습니까?",
      confirmLabel: "삭제",
      cancelLabel: "취소",
      onConfirm: async () => {
        setBusy(true);
        setError(null);
        try {
          await scheduleApi.delete(id);
          onDeleted(id);
        } catch (e) {
          setError(String(e));
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <div className="cal-editor">
      <div className="cal-editor-header">
        <h3>{isNew ? "새 일정" : "일정 수정"}</h3>
        <button type="button" className="cal-editor-close" onClick={onCancel} aria-label="닫기">
          ×
        </button>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      <label className="cal-field">
        <span className="cal-field-label">제목</span>
        <input
          className="input"
          value={state.title}
          onChange={(e) => patchState("title", e.target.value)}
          placeholder="예: 디자인 리뷰"
        />
      </label>

      <label className="cal-field inline">
        <input
          type="checkbox"
          checked={state.allDay}
          onChange={(e) => patchState("allDay", e.target.checked)}
        />
        <span>종일</span>
      </label>

      <div className="cal-field-row">
        <div className="cal-field">
          <span className="cal-field-label">시작</span>
          <div className="cal-field-datetime">
            <DateField
              value={state.startDate}
              onChange={(v) => patchState("startDate", v)}
              ariaLabel="시작 날짜"
            />
            <TimeField
              value={state.startTime}
              onChange={(v) => patchState("startTime", v)}
              ariaLabel="시작 시간"
              disabled={state.allDay}
            />
          </div>
        </div>
        <div className="cal-field">
          <span className="cal-field-label">종료</span>
          <div className="cal-field-datetime">
            <DateField
              value={state.endDate}
              onChange={(v) => patchState("endDate", v)}
              ariaLabel="종료 날짜"
            />
            <TimeField
              value={state.endTime}
              onChange={(v) => patchState("endTime", v)}
              ariaLabel="종료 시간"
              disabled={state.allDay}
            />
          </div>
        </div>
      </div>

      <label className="cal-field">
        <span className="cal-field-label">장소</span>
        <input
          className="input"
          value={state.location}
          onChange={(e) => patchState("location", e.target.value)}
          placeholder="(선택)"
        />
      </label>

      <label className="cal-field">
        <span className="cal-field-label">설명</span>
        <textarea
          className="input cal-textarea"
          rows={3}
          value={state.description}
          onChange={(e) => patchState("description", e.target.value)}
          placeholder="(선택)"
        />
      </label>

      <div className="cal-field">
        <span className="cal-field-label">색상</span>
        <ColorSwatch value={state.color} onChange={(v) => patchState("color", v)} />
      </div>

      <div className="cal-editor-actions">
        <button
          type="button"
          className="cal-icon-btn"
          onClick={onCancel}
          disabled={busy}
          aria-label="취소"
          title="취소"
        >
          <RefreshIcon />
        </button>
        {!isNew && (
          <button
            type="button"
            className="cal-icon-btn danger"
            onClick={remove}
            disabled={busy}
            aria-label="삭제"
            title="삭제"
          >
            <TrashIcon />
          </button>
        )}
        <Button variant="primary" onClick={save} disabled={busy}>
          {isNew ? "추가" : "저장"}
        </Button>
      </div>
    </div>
  );
}

const RefreshIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);
