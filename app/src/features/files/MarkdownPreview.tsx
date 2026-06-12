import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

export function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(content, { async: false }) as string),
    [content],
  );
  return (
    <div
      className="files-md-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
