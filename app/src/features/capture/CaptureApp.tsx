import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { memoApi } from "../memo/api";
import { todoApi } from "../todo/api";
import "./capture.css";

type CaptureKind = "memo" | "todo";
type CapturedItem = { kind: CaptureKind; id: number };

export default function CaptureApp() {
  const [kind, setKind] = useState<CaptureKind>("memo");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedItem, setCapturedItem] = useState<CapturedItem | null>(null);

  async function save() {
    const title = value.trim();
    if ((!title && !capturedItem) || saving) return;

    setSaving(true);
    setError(null);
    let target = capturedItem;
    try {
      if (!target) {
        const created =
          kind === "memo" ? await memoApi.add({ title, body: "" }) : await todoApi.add({ title });
        target = { kind, id: created.id };
        setCapturedItem(target);
      }
      await invoke("quick_capture_open_main", target);
      setCapturedItem(null);
      setValue("");
    } catch (caught) {
      setError(
        target ? `저장은 완료됐지만 화면을 열지 못했습니다: ${String(caught)}` : String(caught),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="capture-app">
      <div className="capture-kind" aria-label="캡처 종류">
        <button
          type="button"
          className={kind === "memo" ? "active" : ""}
          aria-pressed={kind === "memo"}
          disabled={saving || capturedItem !== null}
          onClick={() => setKind("memo")}
        >
          메모
        </button>
        <button
          type="button"
          className={kind === "todo" ? "active" : ""}
          aria-pressed={kind === "todo"}
          disabled={saving || capturedItem !== null}
          onClick={() => setKind("todo")}
        >
          TODO
        </button>
      </div>
      <input
        autoFocus
        className="capture-input"
        aria-label="빠른 캡처"
        placeholder={kind === "memo" ? "메모를 입력하세요" : "할 일을 입력하세요"}
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
              setKind((current) => (current === "memo" ? "todo" : "memo"));
            }
          } else if (event.key === "Escape") {
            setValue("");
            setCapturedItem(null);
            void getCurrentWebviewWindow().hide();
          }
        }}
      />
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
