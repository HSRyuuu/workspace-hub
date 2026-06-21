import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { describe, expect, it } from "vitest";
import { ParagraphPreserveEmpty } from "../../../components/ui/MarkdownEditor";

type DocNode = { type: string; content?: DocNode[] };

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        blockquote: false,
        horizontalRule: false,
        strike: false,
        link: false,
        underline: false,
        paragraph: false,
      }),
      ParagraphPreserveEmpty,
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
  });
}

function md(editor: Editor): string {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
}

describe("empty paragraph round-trip", () => {
  it("preserves a single blank line between two paragraphs across save/load", () => {
    const ed = makeEditor();
    ed.commands.setContent({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "first" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "second" }] },
      ],
    });
    const saved = md(ed);
    // 빈 paragraph 가 ZWSP 로 저장되어 markdown-it 가 paragraph 로 인식
    expect(saved).toBe("first\n\n​\n\nsecond");

    // 재로딩
    ed.commands.setContent(saved);
    const json = ed.getJSON() as DocNode;
    const paragraphs = (json.content ?? []).filter((n: DocNode) => n.type === "paragraph");
    expect(paragraphs.length).toBe(3);
    expect(paragraphs[1]?.content?.[0]).toMatchObject({ type: "text", text: "​" });

    // 재직렬화는 stable (같은 markdown)
    expect(md(ed)).toBe(saved);
    ed.destroy();
  });

  it("preserves multiple consecutive blank lines", () => {
    const ed = makeEditor();
    ed.commands.setContent({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
        { type: "paragraph" },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "b" }] },
      ],
    });
    const saved = md(ed);
    expect(saved).toBe("a\n\n​\n\n​\n\nb");

    ed.commands.setContent(saved);
    const json = ed.getJSON() as DocNode;
    const paragraphs = (json.content ?? []).filter((n: DocNode) => n.type === "paragraph");
    expect(paragraphs.length).toBe(4);
    ed.destroy();
  });

  it("regular content (no blanks) is unaffected", () => {
    const ed = makeEditor();
    ed.commands.setContent("hello\n\nworld");
    expect(md(ed)).toBe("hello\n\nworld");
    ed.destroy();
  });
});
