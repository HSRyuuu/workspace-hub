import { useEffect, useState } from "react";
import { todoApi } from "../todo/api";
import type { Todo } from "../todo/types";

const statusLabel = (todo: Todo) => {
  if (todo.status === "hold") return "보류";
  if (todo.status === "done") return "완료";
  return "열림";
};

export function ProjectTodosSection({ projectId }: { projectId: number }) {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    todoApi
      .listByProject(projectId)
      .then(setTodos)
      .catch(() => setTodos([]));
  }, [projectId]);

  return (
    <section className="scratch-section">
      <div className="section-head">
        <h2 className="section-label">
          관련 TODO <span className="section-count">{todos.length}</span>
        </h2>
      </div>
      <ul className="scratch-list">
        {todos.map((todo) => (
          <li key={todo.id} className="scratch-row">
            <span className="scratch-title">{todo.title}</span>
            <span className="ws-chip">
              <span className="ws-chip-dot" />
              {statusLabel(todo)}
            </span>
            {todo.due_date && <span className="scratch-body">{todo.due_date}</span>}
          </li>
        ))}
        {todos.length === 0 && <li className="dirs-empty">연결된 TODO가 없습니다.</li>}
      </ul>
    </section>
  );
}
