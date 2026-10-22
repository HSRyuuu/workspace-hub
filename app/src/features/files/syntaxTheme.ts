import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * 코드 하이라이트 색. 값은 tokens.css 의 --syntax-* 라서 테마(라이트/다크)가 바뀌면 에디터를 다시 만들지 않아도 따라간다.
 * basicSetup 의 기본 하이라이트(라이트 전용 색)는 fallback 이라 이 스타일이 있으면 쓰이지 않는다.
 */
export const syntaxTheme = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "var(--syntax-keyword)" },
    { tag: [t.string, t.special(t.string), t.regexp], color: "var(--syntax-string)" },
    { tag: [t.number, t.bool, t.null, t.atom], color: "var(--syntax-number)" },
    {
      tag: [t.comment, t.lineComment, t.blockComment],
      color: "var(--syntax-comment)",
      fontStyle: "italic",
    },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: "var(--syntax-function)",
    },
    { tag: [t.typeName, t.className, t.namespace], color: "var(--syntax-type)" },
    { tag: [t.propertyName, t.attributeName], color: "var(--syntax-property)" },
    { tag: [t.tagName, t.angleBracket], color: "var(--syntax-keyword)" },
    { tag: [t.heading], color: "var(--syntax-function)", fontWeight: "bold" },
    { tag: [t.link, t.url], color: "var(--color-link-blue)", textDecoration: "underline" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: [t.meta, t.processingInstruction], color: "var(--syntax-comment)" },
  ]),
);
