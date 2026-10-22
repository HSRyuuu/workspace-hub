import type { Todo } from "../todo/types";

export interface DashboardSummary {
  due_todos: Todo[];
  open_todos: Todo[];
  open_total: number;
}
