import { useRef, useState } from "react";
import { ChevronIcon, FolderIcon, PinIcon } from "../../components/ui/icons";
import { useOutsideClick } from "../../components/ui/useOutsideClick";
import { extractPastedFilePath } from "./helpers";
import type { ExplorerFolder } from "./types";

interface FolderBarProps {
  current: ExplorerFolder | null;
  folders: readonly ExplorerFolder[];
  onPickNewFolder: () => void;
  onOpenPastedFile: (path: string) => Promise<boolean>;
  onSelectFolder: (f: ExplorerFolder) => void;
  onToggleFavorite: (f: ExplorerFolder) => void;
}

const baseName = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

export function FolderBar({
  current,
  folders,
  onPickNewFolder,
  onOpenPastedFile,
  onSelectFolder,
  onToggleFavorite,
}: FolderBarProps) {
  const [open, setOpen] = useState(false);
  const [filePathInput, setFilePathInput] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  const favorites = folders.filter((f) => f.is_favorite);
  const recents = folders.filter((f) => !f.is_favorite);
  const normalizedFilePath = extractPastedFilePath(filePathInput);

  const submitFilePath = async () => {
    if (!normalizedFilePath) return;
    setFilePathInput(normalizedFilePath);
    const opened = await onOpenPastedFile(normalizedFilePath);
    if (opened) setFilePathInput("");
  };

  return (
    <div className="files-folderbar">
      <div className="files-folderbar-current" ref={ref}>
        <button
          type="button"
          className="files-folder-trigger"
          onClick={() => setOpen((v) => !v)}
          title={current?.path ?? ""}
        >
          <span className="files-folder-trigger-icon"><FolderIcon size={15} /></span>
          <span className="files-folder-trigger-text">
            <span className="files-folder-trigger-name">{current ? baseName(current.path) : "선택 안 됨"}</span>
          </span>
          <span className="files-folder-trigger-caret" aria-hidden>
            <ChevronIcon rotation={open ? 0 : 90} size={16} />
          </span>
        </button>
        {open && (
          <div className="files-folder-dropdown">
            {favorites.length > 0 && (
              <>
                <div className="files-folder-dropdown-label">즐겨찾기</div>
                {favorites.map((f) => (
                  <FolderRow key={f.id} folder={f} onSelect={onSelectFolder} onToggleFavorite={onToggleFavorite} close={() => setOpen(false)} />
                ))}
              </>
            )}
            <div className="files-folder-dropdown-label">최근</div>
            {recents.length === 0 && <div className="files-folder-dropdown-empty">없음</div>}
            {recents.map((f) => (
              <FolderRow key={f.id} folder={f} onSelect={onSelectFolder} onToggleFavorite={onToggleFavorite} close={() => setOpen(false)} />
            ))}
          </div>
        )}
      </div>
      {current && (
        <button
          type="button"
          className={`files-fav-toggle${current.is_favorite ? " on" : ""}`}
          aria-label="즐겨찾기 토글"
          onClick={() => onToggleFavorite(current)}
        >
          <PinIcon pinned={current.is_favorite} size={15} />
        </button>
      )}
      <button type="button" className="files-folder-open" onClick={onPickNewFolder}>
        폴더 열기…
      </button>
      <div className="files-file-open">
        <input
          className="files-file-open-input"
          value={filePathInput}
          placeholder="파일 경로 붙여넣기"
          aria-label="열 파일 경로"
          onChange={(e) => setFilePathInput(e.currentTarget.value)}
          onPaste={(e) => {
            e.preventDefault();
            setFilePathInput(extractPastedFilePath(e.clipboardData.getData("text")));
          }}
          onBlur={() => setFilePathInput((value) => extractPastedFilePath(value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submitFilePath();
          }}
        />
        <button
          type="button"
          className="files-file-open-button"
          disabled={!normalizedFilePath}
          onClick={submitFilePath}
        >
          열기
        </button>
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  onSelect,
  onToggleFavorite,
  close,
}: {
  folder: ExplorerFolder;
  onSelect: (f: ExplorerFolder) => void;
  onToggleFavorite: (f: ExplorerFolder) => void;
  close: () => void;
}) {
  return (
    <div className="files-folder-row" title={folder.path}>
      <button
        type="button"
        className="files-folder-row-main"
        onClick={() => {
          close();
          onSelect(folder);
        }}
      >
        <span className="files-folder-row-name">{baseName(folder.path)}</span>
        <span className="files-folder-row-path">{folder.path}</span>
      </button>
      <button
        type="button"
        className={`files-fav-toggle${folder.is_favorite ? " on" : ""}`}
        aria-label="즐겨찾기 토글"
        onClick={() => onToggleFavorite(folder)}
      >
        <PinIcon pinned={folder.is_favorite} size={14} />
      </button>
    </div>
  );
}
