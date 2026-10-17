export interface SkillTarget {
  id: "claude" | "codex";
  label: string;
  dir: string;
  installed: boolean;
  /** 설치본이 현재 앱의 SKILL.md·CLI 명세와 다름 */
  outdated: boolean;
}
