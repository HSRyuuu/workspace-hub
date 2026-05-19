import { PinIcon, TrashIcon } from "./icons";

interface MemoActionsProps {
  id: number;
  pinned: boolean;
  onTogglePin: (id: number, pinned: boolean) => void;
  onDelete: (id: number) => void;
  /** row 안에 들어갈 때 부모 row 클릭 전파 방지. */
  stopPropagation?: boolean;
}

export default function MemoActions({
  id,
  pinned,
  onTogglePin,
  onDelete,
  stopPropagation,
}: MemoActionsProps) {
  return (
    <>
      <button
        type="button"
        className={`memo-icon-btn${pinned ? " is-pinned" : ""}`}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          onTogglePin(id, !pinned);
        }}
        aria-label={pinned ? "고정 해제" : "상단 고정"}
        aria-pressed={pinned}
        title={pinned ? "고정 해제" : "상단 고정"}
      >
        <PinIcon pinned={pinned} />
      </button>
      <button
        type="button"
        className="memo-icon-btn memo-icon-btn--danger"
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          onDelete(id);
        }}
        aria-label="휴지통으로"
        title="휴지통으로"
      >
        <TrashIcon />
      </button>
    </>
  );
}
