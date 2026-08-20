import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { scheduleApi } from "../calendar/api";
import { buildLocalIso, fromIsoDate, todayIso } from "../calendar/dateUtils";
import { memoApi } from "../memo/api";
import { todoApi } from "../todo/api";
import "./capture.css";

type CaptureKind = "memo" | "todo" | "schedule";
type CapturedItem = { kind: CaptureKind; id: number };

const KIND_ORDER: CaptureKind[] = ["memo", "todo", "schedule"];

const KIND_LABEL: Record<CaptureKind, string> = {
  memo: "메모",
  todo: "TODO",
  schedule: "캘린더",
};

/** SCHEDULE_PALETTE 의 "빨강". 인덱스 참조는 팔레트 순서에 묶이므로 값으로 고정한다. */
const CAPTURE_SCHEDULE_COLOR = "#C33B3B";

const PLACEHOLDER: Record<CaptureKind, string> = {
  memo: "메모를 입력하세요",
  todo: "할 일을 입력하세요",
  schedule: "일정을 입력하세요",
};

/** 빠른 캡처 일정은 선택한 날짜 하루 종일. ScheduleEditor 와 같이 00:00 ~ 23:59 로 저장한다. */
function allDayRange(dayIso: string): { start: string; end: string } {
  const day = fromIsoDate(dayIso);
  // 네이티브 date 입력은 세그먼트를 부분 입력하는 동안 빈 값을 보고한다. 유일한 날짜 검증 지점.
  if (!day) throw new Error("날짜를 선택하세요.");
  const [y, m, d] = [day.getFullYear(), day.getMonth() + 1, day.getDate()];
  return { start: buildLocalIso(y, m, d, 0, 0), end: buildLocalIso(y, m, d, 23, 59) };
}

async function createItem(
  kind: CaptureKind,
  title: string,
  dayIso: string,
): Promise<{ id: number }> {
  if (kind === "memo") return memoApi.add({ title, body: "" });
  if (kind === "todo") return todoApi.add({ title });
  const { start, end } = allDayRange(dayIso);
  return scheduleApi.add({ title, start, end, all_day: true, color: CAPTURE_SCHEDULE_COLOR });
}

export default function CaptureApp() {
  const [kind, setKind] = useState<CaptureKind>("memo");
  const [value, setValue] = useState("");
  const [dayIso, setDayIso] = useState(todayIso);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedItem, setCapturedItem] = useState<CapturedItem | null>(null);

  function dismiss() {
    setValue("");
    setDayIso(todayIso());
    setCapturedItem(null);
    void getCurrentWebviewWindow().hide();
  }

  async function save() {
    const title = value.trim();
    if ((!title && !capturedItem) || saving) return;

    setSaving(true);
    setError(null);
    let target = capturedItem;
    try {
      if (!target) {
        const created = await createItem(kind, title, dayIso);
        target = { kind, id: created.id };
        setCapturedItem(target);
      }
      await invoke("quick_capture_open_main", target);
      setCapturedItem(null);
      setValue("");
      setDayIso(todayIso());
    } catch (caught) {
      // Tauri 는 문자열로 reject 하고, 로컬 검증은 Error 로 throw 한다.
      const reason = caught instanceof Error ? caught.message : String(caught);
      setError(target ? `저장은 완료됐지만 화면을 열지 못했습니다: ${reason}` : reason);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="capture-app">
      <div className="capture-kind" aria-label="캡처 종류">
        {KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={kind === k ? "active" : ""}
            aria-pressed={kind === k}
            disabled={saving || capturedItem !== null}
            onClick={() => setKind(k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className={kind === "schedule" ? "capture-row split" : "capture-row"}>
        <input
          autoFocus
          className="capture-input"
          aria-label="빠른 캡처"
          placeholder={PLACEHOLDER[kind]}
          value={value}
          disabled={saving}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            } else if (event.key === "Tab") {
              event.preventDefault();
              if (!saving && !capturedItem) {
                setKind(
                  (current) => KIND_ORDER[(KIND_ORDER.indexOf(current) + 1) % KIND_ORDER.length],
                );
              }
            } else if (event.key === "Escape") {
              dismiss();
            }
          }}
        />
        {kind === "schedule" && (
          // 캡처 창은 200px 고정이라 팝오버형 DateField 가 잘린다. 인라인으로 그려지는 네이티브 위젯을 쓴다.
          <input
            type="date"
            className="capture-date"
            aria-label="일정 날짜"
            value={dayIso}
            disabled={saving || capturedItem !== null}
            onChange={(event) => setDayIso(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void save();
              } else if (event.key === "Escape") {
                dismiss();
              }
            }}
          />
        )}
      </div>
      <div className="capture-footer">
        <span className={error ? "capture-error" : "capture-hint"}>
          {error ?? "Tab 전환 · Enter 저장 · Esc 닫기"}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={(!value.trim() && !capturedItem) || saving}
          onClick={() => void save()}
        >
          {saving ? "처리 중" : capturedItem ? "화면 열기" : "저장"}
        </button>
      </div>
    </main>
  );
}
