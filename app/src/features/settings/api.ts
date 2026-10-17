import { invoke } from "@tauri-apps/api/core";
import type { SkillTarget } from "./types";

export const settingsApi = {
  skillTargets: (): Promise<SkillTarget[]> => invoke<SkillTarget[]>("skill_targets"),
  /** 설치와 CLI 명세 업데이트를 겸한다 */
  skillInstall: (target: string): Promise<void> => invoke<void>("skill_install", { target }),
  skillUninstall: (target: string): Promise<void> => invoke<void>("skill_uninstall", { target }),
};
