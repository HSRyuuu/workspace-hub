import { invoke } from "@tauri-apps/api/core";
import type { NewScheduleInput, Schedule, UpdateSchedulePatch } from "./types";

export const scheduleApi = {
  listRange: (from: string, to: string): Promise<Schedule[]> =>
    invoke<Schedule[]>("schedule_list_range", { from, to }),

  get: (id: number): Promise<Schedule> => invoke<Schedule>("schedule_get", { id }),

  add: (input: NewScheduleInput): Promise<Schedule> =>
    invoke<Schedule>("schedule_add", { input }),

  update: (id: number, patch: UpdateSchedulePatch): Promise<Schedule> =>
    invoke<Schedule>("schedule_update", { id, patch }),

  delete: (id: number): Promise<void> => invoke<void>("schedule_delete", { id }),
};
