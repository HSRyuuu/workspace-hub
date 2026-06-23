import { MarkdownEditor } from "../../components/ui/MarkdownEditor";

interface FrontmatterEntry {
  readonly key: string;
  readonly value: string;
}

interface PreviewContent {
  readonly body: string;
  readonly frontmatter: readonly FrontmatterEntry[];
}

function splitFrontmatter(content: string): PreviewContent {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") return { body: content, frontmatter: [] };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) return { body: content, frontmatter: [] };

  const frontmatter: FrontmatterEntry[] = [];
  let current: FrontmatterEntry | null = null;
  for (const line of lines.slice(1, end)) {
    if (line.trim() === "") continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) {
      const key = match[1];
      if (!key) continue;
      if (current) frontmatter.push(current);
      current = { key, value: match[2] ?? "" };
    } else if (current && /^\s+/.test(line)) {
      current = { key: current.key, value: `${current.value} ${line.trim()}`.trim() };
    }
  }
  if (current) frontmatter.push(current);

  return {
    body: lines.slice(end + 1).join("\n").replace(/^\n/, ""),
    frontmatter,
  };
}

export function MarkdownPreview({ path, content }: { readonly path: string; readonly content: string }) {
  const preview = splitFrontmatter(content);
  return (
    <div className="files-md-preview">
      {preview.frontmatter.length > 0 && (
        <section className="files-frontmatter" aria-label="문서 메타데이터">
          {preview.frontmatter.map((entry) => (
            <div className="files-frontmatter-row" key={entry.key}>
              <span className="files-frontmatter-key">{entry.key}</span>
              <span className="files-frontmatter-value">{entry.value || "-"}</span>
            </div>
          ))}
        </section>
      )}
      <MarkdownEditor
        resetKey={`${path}:${preview.body}`}
        initialMarkdown={preview.body}
        readOnly
      />
    </div>
  );
}
