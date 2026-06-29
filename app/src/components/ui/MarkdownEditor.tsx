import { useEditor, EditorContent, Extension, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode, ResolvedPos, Slice } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import Placeholder from "@tiptap/extension-placeholder";
import { invoke } from "@tauri-apps/api/core";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/** prosemirror-markdown 의 MarkdownSerializerState 중 본 코드에서 쓰는 부분만. */
interface SerializerState {
  write(content: string): void;
  renderInline(node: ProseMirrorNode): void;
  closeBlock(node: ProseMirrorNode): void;
}

/** 클립보드 텍스트를 마크다운 해석 없이 code block 으로 삽입. 툴바 버튼·단축키 공용. */
async function pastePlainText(editor: Editor) {
  if (!editor.isEditable) return;
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "codeBlock",
        content: [{ type: "text", text }],
      })
      .run();
  } catch {
    // 권한/지원 안 됨 — 사용자가 일반 paste 로 재시도하도록 둠
  }
}

/** Cmd/Ctrl+Shift+V: pastePlainText 단축키. */
const PlainPasteShortcut = Extension.create({
  name: "plainPasteShortcut",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-v": () => {
        void pastePlainText(this.editor);
        return true;
      },
    };
  },
});

/**
 * code block 토글. 기본 toggleCodeBlock 은 setBlockType 을 선택된 블록마다 적용해
 * 여러 줄(paragraph) 선택 시 줄마다 별도 code block 이 생긴다. 여러 textblock 이
 * 걸쳐 선택된 경우엔 줄바꿈으로 이어붙인 단일 code block 으로 감싼다.
 * (이미 code block 안이거나 단일 블록이면 기본 동작에 위임.)
 */
function toggleCodeBlockMerged(editor: Editor) {
  if (editor.isActive("codeBlock")) {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }
  const { state } = editor;
  const { from, to } = state.selection;
  const lines: string[] = [];
  let rangeFrom = Infinity;
  let rangeTo = -Infinity;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      lines.push(node.textContent);
      rangeFrom = Math.min(rangeFrom, pos);
      rangeTo = Math.max(rangeTo, pos + node.nodeSize);
      return false;
    }
    return true;
  });
  if (lines.length <= 1) {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }
  const text = lines.join("\n");
  editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        const node = state.schema.nodes.codeBlock.create(null, state.schema.text(text));
        tr.replaceRangeWith(rangeFrom, rangeTo, node);
      }
      return true;
    })
    .run();
}

/** code block 단축키(Mod-Alt-c)도 여러 줄 병합 동작을 쓰도록 기본 keymap 보다 우선 적용. */
const CodeBlockMergeShortcut = Extension.create({
  name: "codeBlockMergeShortcut",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-c": () => {
        toggleCodeBlockMerged(this.editor);
        return true;
      },
    };
  },
});

/**
 * 빈 paragraph 를 markdown round-trip 으로 보존하기 위한 paragraph override.
 *
 * 기본 직렬화기는 빈 paragraph 를 무시하고, markdown-it 파서는 다중 빈 줄을 paragraph
 * 분리자 하나로 collapse 한다. 따라서 "first / (blank) / second" 입력이 저장·재로딩
 * 후 "first / second" 로 줄어드는 회귀가 발생.
 *
 * 해법: 빈 paragraph 를 만나면 zero-width space (U+200B) 한 글자를 출력. 이 글자는
 * 시각적으로 보이지 않지만 markdown-it 가 paragraph content 로 인식해 paragraph 노드
 * 자체가 살아남는다. 재직렬화 시에도 같은 형태로 stable.
 */
const ZERO_WIDTH_SPACE = "​";

/** URL 끝에 붙은 구두점은 링크에서 제외 (문장 끝 마침표·괄호 등). */
const URL_TRAILING_PUNCT = /[)\]}.,;:!?]+$/;

function normalizeExternalUrl(raw: string) {
  let url = raw.trim().replace(URL_TRAILING_PUNCT, "");
  if (/^www\./i.test(url)) url = `https://${url}`;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

/**
 * 한 텍스트 안의 외부 URL 들을 찾아 visible 구간(start/end)과 resolve 된 href 를 돌려준다.
 * 클릭 hit-test(urlAtTextOffset)와 하이라이트(buildUrlDecorations)가 같은 출처를 쓰게 해
 * "파란 밑줄 범위 == 클릭 가능 범위 == 열리는 URL" 이 코드상 항상 일치하도록 한다.
 */
function findUrls(text: string): { start: number; end: number; href: string }[] {
  const pattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  const found: { start: number; end: number; href: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const href = normalizeExternalUrl(match[0]);
    if (!href) continue;
    const visible = match[0].replace(URL_TRAILING_PUNCT, "");
    found.push({ start: match.index, end: match.index + visible.length, href });
  }
  return found;
}

function urlAtTextOffset(text: string, offset: number): string | null {
  const hit = findUrls(text).find((u) => offset >= u.start && offset <= u.end);
  return hit ? hit.href : null;
}

/**
 * 본문 텍스트에서 외부 URL 구간을 찾아 .md-link inline 데코레이션으로 표시.
 * 링크는 별도 노드/마크가 아니라 plain text 라 시각 표시가 없으므로, findUrls 가 고른
 * 구간에 파란 링크 스타일을 입힌다. code block 내부는 제외.
 */
function buildUrlDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.spec.code) return false;
    if (!node.isTextblock) return true;
    for (const u of findUrls(node.textContent)) {
      decorations.push(Decoration.inline(pos + 1 + u.start, pos + 1 + u.end, { class: "md-link" }));
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

const urlDecorationKey = new PluginKey("urlDecoration");

/** URL 구간에 .md-link 데코레이션을 적용하는 plugin 을 제공하는 익스텐션. */
const UrlHighlighter = Extension.create({
  name: "urlHighlighter",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: urlDecorationKey,
        state: {
          init: (_config, state) => buildUrlDecorations(state.doc),
          apply: (tr, deco) => (tr.docChanged ? buildUrlDecorations(tr.doc) : deco),
        },
        props: {
          decorations(state) {
            return urlDecorationKey.getState(state);
          },
        },
      }),
    ];
  },
});

export const ParagraphPreserveEmpty = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: ProseMirrorNode) {
          if (node.childCount === 0) {
            state.write(ZERO_WIDTH_SPACE);
          } else {
            state.renderInline(node);
          }
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

export interface MarkdownEditorHandle {
  focus: () => void;
}

interface MarkdownEditorProps {
  /** mount 시점·인스턴스 전환 시점에 한 번 doc 에 주입할 markdown.
   *  이후 typing 은 TipTap 내부 상태가 단일 진실 원천이며, onChange 로 외부에 보고만 함. */
  initialMarkdown: string;
  /** typing 추적용 onChange — markdown 문자열. readOnly 모드에서는 생략 가능. */
  onChange?: (markdown: string) => void;
  /** 인스턴스 전환을 감지해 doc 을 다시 로드하기 위한 키 (예: 메모 id, todo id). */
  resetKey: string | number | null;
  /** placeholder 텍스트. */
  placeholder?: string;
  /** 툴바 우측에 렌더할 상태 표시 (선택). */
  saveIndicator?: React.ReactNode;
  /** true 면 편집 불가 + 툴바 숨김 (뷰어 모드). 기본 false. */
  readOnly?: boolean;
}

const BulletListWithShortcut = BulletList.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-7": () => this.editor.commands.toggleBulletList(),
    };
  },
});

const OrderedListWithShortcut = OrderedList.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-8": () => this.editor.commands.toggleOrderedList(),
    };
  },
});

const TaskListWithShortcut = TaskList.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-9": () => this.editor.commands.toggleTaskList(),
    };
  },
});

/**
 * TipTap 기반 WYSIWYG markdown 에디터. 활성 노드: H1~H6, paragraph, bullet/ordered/task list,
 * code block, marks: bold/italic/strike/code (총 14종). 직렬화는 tiptap-markdown.
 *
 * 제목은 포함하지 않으며, 본문 + 툴바 + 선택적 saveIndicator 슬롯만 제공한다.
 */
export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      initialMarkdown,
      onChange,
      resetKey,
      placeholder = "내용을 입력하세요",
      saveIndicator,
      readOnly = false,
    },
    ref,
  ) {
    const resetKeyRef = useRef<string | number | null>(null);
    const initialMarkdownRef = useRef(initialMarkdown);
    initialMarkdownRef.current = initialMarkdown;
    const tableButtonRef = useRef<HTMLButtonElement>(null);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          blockquote: false,
          link: false,
          underline: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          paragraph: false,
        }),
        ParagraphPreserveEmpty,
        ListItem,
        BulletListWithShortcut,
        OrderedListWithShortcut,
        TaskListWithShortcut,
        TaskItem.configure({ nested: true }),
        Table.configure({
          resizable: true,
          handleWidth: 8,
          cellMinWidth: 48,
          HTMLAttributes: { class: "markdown-table" },
        }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({ placeholder }),
        Markdown.configure({
          html: false,
          tightLists: true,
          bulletListMarker: "-",
          linkify: false,
          breaks: false,
          transformPastedText: true,
          transformCopiedText: true,
        }),
        PlainPasteShortcut,
        CodeBlockMergeShortcut,
        UrlHighlighter,
      ],
      content: initialMarkdown,
      editable: !readOnly,
      onUpdate: ({ editor: ed }: { editor: Editor }) => {
        if (!onChange) return;
        const md = (ed.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
        onChange(md);
      },
      editorProps: {
        attributes: {
          class: readOnly ? "markdown-editor markdown-editor--readonly" : "markdown-editor",
        },
        // 클립보드에 HTML 이 함께 들어있으면 TipTap 은 HTML 경로를 우선 채택해서
        // tiptap-markdown 의 transformPastedText 가 동작하지 않는다.
        // text 에 강한 markdown 마크가 보일 때만 HTML 을 버리고 plain text 경로로 강제한다.
        handlePaste: (view, event) => {
          const cd = event.clipboardData;
          if (!cd) return false;
          const text = cd.getData("text/plain");
          const html = cd.getData("text/html");
          if (!text || !html) return false;
          const hasMd =
            /(^|\n)#{1,6}\s/.test(text) ||
            /(^|\n)```/.test(text) ||
            /(^|\n)[-*+]\s/.test(text) ||
            /(^|\n)\d+\.\s/.test(text) ||
            /(^|\n)>\s/.test(text) ||
            /(^|\n)\|.+\|/.test(text);
          if (!hasMd) return false;
          event.preventDefault();
          let transformed = text;
          view.someProp("transformPastedText", (fn) => {
            const cast = fn as (t: string, plain: boolean, v: EditorView) => string;
            transformed = cast(transformed, true, view);
          });
          const $from = view.state.selection.$from;
          let handled = false;
          view.someProp("clipboardTextParser", (parser) => {
            const cast = parser as (
              t: string,
              $ctx: ResolvedPos,
              plain: boolean,
              v: EditorView,
            ) => Slice;
            const slice = cast(transformed, $from, false, view);
            if (slice) {
              view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
              handled = true;
            }
          });
          return handled;
        },
        handleClick: (view, pos, event) => {
          if (!event.metaKey) return false;
          const $pos = view.state.doc.resolve(pos);
          const parent = $pos.parent;
          if (!parent.isTextblock) return false;
          const url = urlAtTextOffset(parent.textContent, $pos.parentOffset);
          if (!url) return false;
          event.preventDefault();
          void invoke<void>("open_url", { url }).catch((error) => {
            console.error("failed to open url", error);
          });
          return true;
        },
      },
    });

    // resetKey 와 별개로 readOnly 토글에 즉시 반응하도록 동기화.
    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    // Cmd/Ctrl 을 누르고 있는 동안에만 링크 위에서 pointer 커서로 바꿔 "지금 누르면 열린다"
    // 를 알린다. (열기는 Cmd+클릭이라 평소엔 캐럿 편집을 방해하지 않도록 text 커서 유지.)
    useEffect(() => {
      if (!editor) return;
      const dom = editor.view.dom as HTMLElement;
      const sync = (e: KeyboardEvent) => {
        dom.classList.toggle("cmd-pressed", e.metaKey || e.ctrlKey);
      };
      const clear = () => dom.classList.remove("cmd-pressed");
      document.addEventListener("keydown", sync);
      document.addEventListener("keyup", sync);
      window.addEventListener("blur", clear);
      return () => {
        document.removeEventListener("keydown", sync);
        document.removeEventListener("keyup", sync);
        window.removeEventListener("blur", clear);
      };
    }, [editor]);

    useEffect(() => {
      if (!editor) return;
      if (resetKeyRef.current !== resetKey) {
        resetKeyRef.current = resetKey;
        editor.commands.setContent(initialMarkdownRef.current, {
          emitUpdate: false,
        });
      }
    }, [editor, resetKey]);

    useImperativeHandle(ref, () => ({
      focus: () => editor?.commands.focus(),
    }), [editor]);

    if (!editor) return null;

    const setHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) =>
      editor.chain().focus().toggleHeading({ level }).run();
    const setParagraph = () => editor.chain().focus().setParagraph().run();
    const toggleBullet = () => editor.chain().focus().toggleBulletList().run();
    const toggleOrdered = () => editor.chain().focus().toggleOrderedList().run();
    const toggleTask = () => editor.chain().focus().toggleTaskList().run();
    const toggleCodeBlock = () => toggleCodeBlockMerged(editor);
    const insertTable = () =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

    return (
      <div
        className={
          readOnly ? "markdown-editor-shell markdown-editor-shell--readonly" : "markdown-editor-shell"
        }
      >
        {!readOnly && (
        <div className="markdown-editor-toolbar" role="toolbar" aria-label="formatting">
          <button
            type="button"
            className={editor.isActive("paragraph") ? "active" : ""}
            onClick={setParagraph}
            title="본문 (⌘⌥0)"
          >
            P
          </button>
          {([1, 2, 3, 4, 5, 6] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={editor.isActive("heading", { level: l }) ? "active" : ""}
              onClick={() => setHeading(l)}
              title={`H${l} (⌘⌥${l})`}
            >
              H{l}
            </button>
          ))}
          <span className="markdown-toolbar-sep" />
          <button
            type="button"
            className={editor.isActive("bold") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (⌘B)"
          >
            <b>B</b>
          </button>
          <button
            type="button"
            className={editor.isActive("italic") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (⌘I)"
          >
            <i>I</i>
          </button>
          <button
            type="button"
            className={editor.isActive("strike") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <s>S</s>
          </button>
          <button
            type="button"
            className={editor.isActive("code") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline code (⌘E)"
          >
            {"<>"}
          </button>
          <span className="markdown-toolbar-sep" />
          <button
            type="button"
            className={editor.isActive("bulletList") ? "active" : ""}
            onClick={toggleBullet}
            title="Bullet list (⌘⌥7)"
          >
            •
          </button>
          <button
            type="button"
            className={editor.isActive("orderedList") ? "active" : ""}
            onClick={toggleOrdered}
            title="Ordered list (⌘⌥8)"
          >
            1.
          </button>
          <button
            type="button"
            className={editor.isActive("taskList") ? "markdown-toolbar-task active" : "markdown-toolbar-task"}
            onClick={toggleTask}
            title="Task list (⌘⌥9)"
          >
            ☑
          </button>
          <button
            type="button"
            className={editor.isActive("codeBlock") ? "active" : ""}
            onClick={toggleCodeBlock}
            title="Code block (```)"
          >
            {"</>"}
          </button>
          <button
            ref={tableButtonRef}
            type="button"
            className={editor.isActive("table") ? "markdown-toolbar-table active" : "markdown-toolbar-table"}
            onClick={insertTable}
            title="표 삽입 (3×3)"
          >
            ⊞
          </button>
          <span className="markdown-toolbar-sep" />
          <button
            type="button"
            onClick={() => void pastePlainText(editor)}
            title="텍스트만 붙여넣기 — 클립보드 내용을 마크다운 해석 없이 코드 블록으로 삽입 (⌘⇧V)"
          >
            텍스트
          </button>
          {saveIndicator && <span className="markdown-save-indicator">{saveIndicator}</span>}
        </div>
        )}
        {!readOnly && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor: ed }) => ed.isActive("table")}
            updateDelay={120}
            getReferencedVirtualElement={() => {
              const el = tableButtonRef.current;
              if (!el) return null;
              return {
                getBoundingClientRect: () => el.getBoundingClientRect(),
                contextElement: el,
              };
            }}
            options={{ placement: "bottom-start", offset: 6 }}
            className="markdown-table-bubble"
          >
            <div className="markdown-table-bubble-group">
              <span className="markdown-table-bubble-label">행</span>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowBefore().run()}
                title="위에 행 추가"
              >
                ↑+
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="아래에 행 추가"
              >
                ↓+
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                title="행 삭제"
              >
                −
              </button>
            </div>
            <span className="markdown-table-bubble-sep" />
            <div className="markdown-table-bubble-group">
              <span className="markdown-table-bubble-label">열</span>
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                title="왼쪽에 열 추가"
              >
                ←+
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="오른쪽에 열 추가"
              >
                →+
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                title="열 삭제"
              >
                −
              </button>
            </div>
            <span className="markdown-table-bubble-sep" />
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              title="헤더 행 전환"
            >
              헤더
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              title="표 삭제"
              className="markdown-table-bubble-danger"
            >
              표 삭제
            </button>
          </BubbleMenu>
        )}
        <EditorContent
          editor={editor}
          className={
            readOnly
              ? "markdown-editor-content markdown-editor-content--readonly"
              : "markdown-editor-content"
          }
        />
      </div>
    );
  },
);
