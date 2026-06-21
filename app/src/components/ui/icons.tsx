/**
 * lucide-style ChevronRight (base direction = right).
 * `rotation` 은 도(degree) — caller 가 0 (right) / 90 (down) / -90 (up) / 180 (left)
 * 등으로 base 방향을 정한다. 트랜지션은 120ms ease.
 */
export function ChevronIcon({ rotation = 0 }: { rotation?: number }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: "transform 120ms ease",
      }}
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

interface IconProps {
  size?: number;
}

const ICON_DEFAULTS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function TrashIcon({ size = 14 }: IconProps = {}) {
  return (
    <svg {...ICON_DEFAULTS} width={size} height={size} aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function PlusIcon({ size = 14 }: IconProps = {}) {
  return (
    <svg {...ICON_DEFAULTS} width={size} height={size} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function PencilIcon({ size = 14 }: IconProps = {}) {
  return (
    <svg {...ICON_DEFAULTS} width={size} height={size} aria-hidden>
      <path d="M4 20h4l11-11-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: IconProps = {}) {
  return (
    <svg {...ICON_DEFAULTS} width={size} height={size} aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function FolderIcon({
  size = 14,
  filled = false,
}: IconProps & { filled?: boolean } = {}) {
  return (
    <svg
      {...ICON_DEFAULTS}
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      aria-hidden
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

export function FileIcon({ size = 14 }: IconProps = {}) {
  return (
    <svg {...ICON_DEFAULTS} width={size} height={size} aria-hidden>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5z" />
    </svg>
  );
}

export function PinIcon({ pinned, size = 14 }: { pinned: boolean } & IconProps) {
  return (
    <svg
      {...ICON_DEFAULTS}
      width={size}
      height={size}
      fill={pinned ? "currentColor" : "none"}
      aria-hidden
    >
      <polygon points="12,2.5 14.6,9 21.5,9.5 16.2,14 17.8,20.5 12,16.8 6.2,20.5 7.8,14 2.5,9.5 9.4,9" />
    </svg>
  );
}
