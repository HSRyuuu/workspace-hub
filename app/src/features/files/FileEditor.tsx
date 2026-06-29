import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { languageForFile, shouldWrapEditorLines, type LanguageId } from "./helpers";

function languageExtension(id: LanguageId | null): Extension {
  switch (id) {
    case "javascript":
      return javascript();
    case "typescript":
      return javascript({ typescript: true });
    case "python":
      return python();
    case "java":
      return java();
    case "json":
      return json();
    case "html":
      return html();
    case "css":
      return css();
    case "markdown":
      return markdown();
    default:
      return [];
  }
}

interface FileEditorProps {
  /** 바뀌면 에디터를 새 문서로 재구성한다. */
  path: string;
  /** path 가 바뀐 시점의 스냅샷 — 이후 변경은 에디터가 단일 진실. */
  initialContent: string;
  onChange: (content: string) => void;
}

export function FileEditor({ path, initialContent, onChange }: FileEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const name = path.split("/").pop() ?? "";
    const wrapExtension = shouldWrapEditorLines(name) ? [EditorView.lineWrapping] : [];
    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        basicSetup,
        languageExtension(languageForFile(name)),
        ...wrapExtension,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    return () => view.destroy();
    // path 전환 시에만 재구성 — initialContent 는 그 시점 스냅샷이므로 deps 에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return <div className="files-editor" ref={hostRef} />;
}
