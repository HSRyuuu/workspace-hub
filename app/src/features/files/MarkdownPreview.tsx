import { useMemo } from "react";
import { marked } from "marked";

export function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(
    () => marked.parse(content, { async: false }) as string,
    [content],
  );
  return (
    <div
      className="files-md-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
