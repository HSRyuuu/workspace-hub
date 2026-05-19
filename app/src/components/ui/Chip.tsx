/**
 * Workspace 칩 — 단순 dot + text. 배경 없음.
 *
 * 디자인 시스템 v0.2 결정 — 회색 박스 칩 대신 정보 위주의 dot+text.
 * Workspace 도메인이 추가되면 dot 색은 workspace.color 에서 가져오게 된다.
 */
interface WorkspaceChipProps {
  /** workspace 표시 라벨 */
  label: string;
  /** dot 컬러 (CSS 값) — 미지정 시 data-slate */
  color?: string;
}

export function WorkspaceChip({ label, color }: WorkspaceChipProps) {
  return (
    <span className="ws-chip">
      <span
        className="ws-chip-dot"
        style={color ? { background: color } : undefined}
      />
      {label}
    </span>
  );
}
