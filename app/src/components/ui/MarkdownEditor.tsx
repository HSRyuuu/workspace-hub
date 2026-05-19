import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { EditorView } from "@tiptap/pm/view";
import type { Slice } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
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
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

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
 * code block, marks: bold/italic/code (총 13종). 직렬화는 tiptap-markdown.
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
          horizontalRule: false,
          strike: false,
          link: false,
          underline: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
        }),
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
      },
    });

    // resetKey 와 별개로 readOnly 토글에 즉시 반응하도록 동기화.
    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!readOnly);
    }, [editor, readOnly]);

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
    const toggleCodeBlock = () => editor.chain().focus().toggleCodeBlock().run();
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
            본문
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
            className={editor.isActive("taskList") ? "active" : ""}
            onClick={toggleTask}
            title="Task list (⌘⌥9)"
          >
            ☐
          </button>
          <button
            type="button"
            className={editor.isActive("codeBlock") ? "active" : ""}
            onClick={toggleCodeBlock}
            title="Code block (```)"
          >
            {"{}"}
          </button>
          <button
            ref={tableButtonRef}
            type="button"
            className={editor.isActive("table") ? "active" : ""}
            onClick={insertTable}
            title="표 삽입 (3×3)"
          >
            ⊞
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
