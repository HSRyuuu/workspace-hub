import { describe, expect, it } from "vitest";
import { extOf, isHiddenInTree, isMarkdown, languageForFile } from "../helpers";

describe("extOf", () => {
  it("returns lowercase extension", () => {
    expect(extOf("Note.MD")).toBe("md");
    expect(extOf("a.tar.gz")).toBe("gz");
  });
  it("returns empty for no-extension and dotfiles", () => {
    expect(extOf("Makefile")).toBe("");
    expect(extOf(".gitignore")).toBe("");
  });
});

describe("languageForFile", () => {
  it("maps major extensions", () => {
    expect(languageForFile("main.py")).toBe("python");
    expect(languageForFile("App.JAVA")).toBe("java");
    expect(languageForFile("index.tsx")).toBe("typescript");
    expect(languageForFile("util.js")).toBe("javascript");
    expect(languageForFile("data.json")).toBe("json");
    expect(languageForFile("page.html")).toBe("html");
    expect(languageForFile("style.css")).toBe("css");
    expect(languageForFile("note.md")).toBe("markdown");
  });
  it("returns null for unknown text files", () => {
    expect(languageForFile("notes.txt")).toBeNull();
    expect(languageForFile("Makefile")).toBeNull();
  });
});

describe("isMarkdown", () => {
  it("detects .md / .markdown only", () => {
    expect(isMarkdown("a.md")).toBe(true);
    expect(isMarkdown("a.markdown")).toBe(true);
    expect(isMarkdown("a.txt")).toBe(false);
  });
});

describe("isHiddenInTree", () => {
  it("hides binary extensions and .DS_Store", () => {
    expect(isHiddenInTree("photo.PNG")).toBe(true);
    expect(isHiddenInTree("movie.mp4")).toBe(true);
    expect(isHiddenInTree("archive.tar.gz")).toBe(true);
    expect(isHiddenInTree("lib.dylib")).toBe(true);
    expect(isHiddenInTree(".DS_Store")).toBe(true);
  });
  it("keeps text-ish files including dotfiles and no-extension", () => {
    expect(isHiddenInTree(".gitignore")).toBe(false);
    expect(isHiddenInTree("Dockerfile")).toBe(false);
    expect(isHiddenInTree("read.me.md")).toBe(false);
    expect(isHiddenInTree("script.sh")).toBe(false);
  });
});
