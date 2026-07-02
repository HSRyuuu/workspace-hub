import { invoke } from "@tauri-apps/api/core";
import type { NewTodoInput, Todo, TodoPatch } from "./types";

export const todoApi = {
  list: (status: "all" | "open" | "done" = "all"): Promise<Todo[]> =>
    invoke<Todo[]>("todo_list", { status }),

  listCalendarRange: (
    from: string,
    to: string,
    completedFrom: string,
    completedTo: string,
  ): Promise<Todo[]> =>
    invoke<Todo[]>("todo_list_calendar_range", {
      from,
      to,
      completedFrom,
      completedTo,
    }),

  add: (input: NewTodoInput): Promise<Todo> =>
    invoke<Todo>("todo_add", { input }),

  update: (id: number, patch: TodoPatch): Promise<Todo> =>
    invoke<Todo>("todo_update", { id, patch }),

  complete: (id: number): Promise<Todo> =>
    invoke<Todo>("todo_complete", { id }),

  uncomplete: (id: number): Promise<Todo> =>
    invoke<Todo>("todo_uncomplete", { id }),

  delete: (id: number): Promise<void> =>
    invoke<void>("todo_delete", { id }),
};
