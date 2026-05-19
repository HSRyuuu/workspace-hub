import type { Priority } from "../../components/ui/PriorityDot";

export type TodoStatus = "open" | "done";
// 단일 진실 원천: components/ui/PriorityDot. todo 도메인에서도 재내보내기 — 기존 import 호환.
export type { Priority };

export interface Todo {
  id: number;
  workspace_id: number | null;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: Priority;
  status: TodoStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewTodoInput {
  title: string;
  description?: string | null;
  due?: string | null;
  priority?: Priority;
  workspace_id?: number | null;
}

/**
 * TodoPatch — 부분 업데이트용.
 * `null` 또는 `""` 은 Tauri 레이어가 `--clear-*` 플래그로 변환해 NULL 클리어 신호로 처리한다.
 */
export interface TodoPatch {
  title?: string;
  description?: string | null;
  due?: string | null;
  priority?: Priority;
  status?: TodoStatus;
}
