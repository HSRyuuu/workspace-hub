import { useCallback, useEffect, useState } from "react";
import { Button, SegmentedControl } from "../../components/ui";
import { showConfirmToast } from "../../components/ui/ConfirmToast";
import { showErrorToast, showHintToast } from "../../components/ui/Toast";
import { getThemePref, setThemePref, type ThemePref } from "../../theme";
import { settingsApi } from "./api";
import type { SkillTarget } from "./types";

const THEME_ITEMS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "시스템" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

export default function SettingsPage() {
  const [targets, setTargets] = useState<SkillTarget[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePref>(getThemePref);

  const changeTheme = (next: ThemePref) => {
    setThemePref(next);
    setTheme(next);
  };

  const load = useCallback(() => {
    settingsApi
      .skillTargets()
      .then(setTargets)
      .catch((e) => showErrorToast(`스킬 상태를 불러오지 못했어요: ${String(e)}`, load));
  }, []);

  useEffect(load, [load]);

  const run = (t: SkillTarget, action: () => Promise<void>, done: string) => {
    setBusy(t.id);
    action()
      .then(() => {
        showHintToast(done);
        load();
      })
      .catch((e) => showErrorToast(String(e)))
      .finally(() => setBusy(null));
  };

  const install = (t: SkillTarget) =>
    run(
      t,
      () => settingsApi.skillInstall(t.id),
      t.installed ? `${t.label} 스킬 명세를 업데이트했어요` : `${t.label} 스킬을 설치했어요`,
    );

  const uninstall = (t: SkillTarget) =>
    showConfirmToast({
      message: `${t.label} 스킬을 제거할까요?`,
      confirmLabel: "제거",
      cancelLabel: "취소",
      onConfirm: () =>
        run(t, () => settingsApi.skillUninstall(t.id), `${t.label} 스킬을 제거했어요`),
    });

  return (
    <div className="settings-page">
      <header className="today-header">
        <p>SETTINGS</p>
        <h1>설정</h1>
      </header>

      <section className="today-card settings-card">
        <div className="settings-card-head">
          <h2>화면 테마</h2>
          <p>시스템을 고르면 macOS 의 라이트/다크 설정을 따라가요.</p>
        </div>
        <div className="settings-row">
          <div className="settings-row-title">테마</div>
          <SegmentedControl
            items={THEME_ITEMS}
            value={theme}
            onChange={changeTheme}
            ariaLabel="화면 테마"
          />
        </div>
      </section>

      <section className="today-card settings-card settings-card--stack">
        <div className="settings-card-head">
          <h2>AI 스킬</h2>
          <p>
            로컬 Claude Code·Codex 가 이 앱의 TODO·일정·메모를 CLI 로 조회하고 수정할 수 있게 하는{" "}
            <code>workspace-hub</code> 스킬을 설치해요. 스킬에는 CLI 명세(
            <code>references/cli-spec.md</code>)가 함께 들어가요.
          </p>
        </div>
        {targets?.map((t) => (
          <div key={t.id} className="settings-row">
            <div className="settings-row-main">
              <div className="settings-row-title">
                {t.label}
                <span className={`settings-badge${t.outdated ? " settings-badge--warn" : ""}`}>
                  {!t.installed ? "미설치" : t.outdated ? "업데이트 필요" : "최신"}
                </span>
              </div>
              <code className="settings-row-path">{t.dir}</code>
            </div>
            <div className="settings-row-actions">
              {t.installed && (
                <Button
                  variant="danger-ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => uninstall(t)}
                >
                  제거
                </Button>
              )}
              <Button
                variant={!t.installed || t.outdated ? "primary" : "secondary"}
                size="sm"
                disabled={busy !== null}
                onClick={() => install(t)}
              >
                {t.installed ? "CLI 명세 업데이트" : "설치"}
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
