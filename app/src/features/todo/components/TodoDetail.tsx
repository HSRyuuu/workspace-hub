import { useEffect, useRef, useState } from "react";
import { DateField, MarkdownEditor, PriorityDot, Select } from "../../../components/ui";
import type { MarkdownEditorHandle, SelectOption } from "../../../components/ui";
import type { Priority, Todo, TodoPatch } from "../types";

interface TodoDetailProps {
  todo: Todo | null;
  descriptionRef: React.RefObject<MarkdownEditorHandle>;
  onPatch: (id: number, patch: TodoPatch, debounce?: boolean) => void;
}

const PRIORITY_OPTIONS: SelectOption<Priority>[] = [
  { value: "low", label: "낮음", leading: <PriorityDot priority="low" /> },
  { value: "mid", label: "보통", leading: <PriorityDot priority="mid" /> },
  { value: "high", label: "높음", leading: <PriorityDot priority="high" /> },
];

export function TodoDetail({ todo, descriptionRef, onPatch }: TodoDetailProps) {
  const [localTitle, setLocalTitle] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // todo ID 변경 시 로컬 제목 리셋 (description 은 MarkdownEditor 가 resetKey 로 처리)
  useEffect(() => {
    if (!todo) return;
    setLocalTitle(todo.title);
  }, [todo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!todo) {
    return (
      <div className="todo-detail-empty">
        <span className="empty-icon" aria-hidden="true">📋</span>
        <p className="empty-primary">좌측에서 할 일을 선택하세요</p>
        <p className="empty-secondary">↑/↓ 이동, Enter 열기</p>
      </div>
    );
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTitle(val);
    if (val.trim()) {
      onPatch(todo.id, { title: val.trim() }, true); // debounced
    }
  };

  const handleDescriptionChange = (md: string) => {
    onPatch(todo.id, { description: md || null }, true); // debounced
  };

  const handlePriorityChange = (priority: Priority) => {
    onPatch(todo.id, { priority }, false); // immediate
  };

  const createdDate = todo.created_at.slice(0, 10);

  return (
    <div className="todo-detail">
      <div className="detail-field">
        <label className="detail-label">제목</label>
        <input
          ref={titleRef}
          className="input"
          value={localTitle}
          onChange={handleTitleChange}
          aria-label="제목"
        />
      </div>

      <div className="detail-meta-row">
        <div className="detail-field">
          <label className="detail-label">우선순위</label>
          <Select<Priority>
            value={todo.priority}
            options={PRIORITY_OPTIONS}
            onChange={handlePriorityChange}
            ariaLabel="우선순위"
          />
        </div>

        <div className="detail-field">
          <label className="detail-label">마감일</label>
          <DateField
            value={todo.due_at ? todo.due_at.slice(0, 10) : ""}
            onChange={(val) => onPatch(todo.id, { due: val || null }, false)}
            ariaLabel="마감일"
          />
        </div>

        <div className="detail-field">
          <label className="detail-label">생성일</label>
          <span className="detail-value">{createdDate}</span>
        </div>
      </div>

      <div className="detail-field detail-field--grow">
        <label className="detail-label">설명</label>
        <MarkdownEditor
          ref={descriptionRef}
          resetKey={todo.id}
          initialMarkdown={todo.description ?? ""}
          onChange={handleDescriptionChange}
          placeholder="설명을 입력하세요"
        />
      </div>
    </div>
  );
}
