import { invoke } from "@tauri-apps/api/core";
import { showErrorToast, showHintToast } from "../../../components/ui";

interface LinkChipProps {
  url: string;
  /** 지정하면 삭제 버튼을 보여준다 (상세 편집용). */
  onRemove?: () => void;
}

/** 링크는 http/https 만 허용한다 — 앱의 `open_url` 과 core 검증이 같은 규칙. */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function chipLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "");
}

/** 행 선택(상세 열기)으로 이어지지 않도록 모든 동작에서 클릭 전파를 끊는다. */
export function LinkChip({ url, onRemove }: LinkChipProps) {
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    invoke<void>("open_url", { url }).catch((error: unknown) => showErrorToast(String(error)));
  };

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard
      .writeText(url)
      .then(() => showHintToast("링크를 복사했어요"))
      .catch((error: unknown) => showErrorToast(String(error)));
  };

  return (
    <span className="link-chip">
      <button
        type="button"
        className="link-chip-open"
        aria-label="링크 열기"
        title={url}
        onClick={open}
      >
        {chipLabel(url)}
      </button>
      <button
        type="button"
        className="link-chip-btn"
        aria-label="링크 복사"
        title="복사"
        onClick={copy}
      >
        ⧉
      </button>
      {onRemove && (
        <button
          type="button"
          className="link-chip-btn"
          aria-label="링크 삭제"
          title="삭제"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
