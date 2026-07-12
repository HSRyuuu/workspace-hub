import type { ExplorerFolder } from "../files/types";
import type { Memo } from "../memo/types";
import type { Todo } from "../todo/types";

export interface DashboardSummary {
  due_todos: Todo[];
  open_todos: Todo[];
  open_total: number;
  recent_memos: Memo[];
  recent_folders: ExplorerFolder[];
}
