import { useState } from "react";
import { Button } from "../../../components/ui";

interface AddBarProps {
  onAdd: (title: string) => void;
}

export function AddBar({ onAdd }: AddBarProps) {
  const [title, setTitle] = useState("");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="add-bar">
      <input
        className="input"
        placeholder="할 일 입력 후 Enter"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="새 할 일 입력"
      />
      <Button variant="primary" onClick={submit} disabled={!title.trim()}>
        + 새 할 일
      </Button>
    </div>
  );
}
