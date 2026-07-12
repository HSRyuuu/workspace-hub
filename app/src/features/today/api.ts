import { invoke } from "@tauri-apps/api/core";
import type { DashboardSummary } from "./types";

export const todayApi = {
  summary: (weekEnd: string): Promise<DashboardSummary> =>
    invoke<DashboardSummary>("dashboard_summary", { weekEnd }),
  openInFinder: (path: string): Promise<void> => invoke<void>("open_in_finder", { path }),
};
