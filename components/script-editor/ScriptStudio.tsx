"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  EditorView,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
  type PluginValue,
  keymap,
  type KeyBinding,
  placeholder,
} from "@codemirror/view";
import { RangeSetBuilder, type Text } from "@codemirror/state";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { ScriptDocument } from "@/lib/script/types";

type ScriptStudioProps = {
  document: ScriptDocument;
  title: string;
  onChange: (document: ScriptDocument) => void;
  onSave: () => void;
  onClose: () => void;
};

// ---------------------------------------------------------------------
// Grammar for the real ComicWriter shorthand:
//
//   Page 1            (or "Page 3-4" for a spread)
//   Panel 1
//   <plain description text>
//   	NAME (MODIFIER): dialogue text
//   	CAPTION (): caption text
//   	SFX (): sound effect text
//   (Page turner)
// ---------------------------------------------------------------------

type LineKind = "page" | "panel" | "pageTurner" | "dialogue" | "caption" | "sfx" | "paragraph" | "blank";

const PAGE_RE = /^page\s+(\d+)(?:\s*-\s*(\d+))?\s*$/i;
const PANEL_RE = /^panel\s+(\d+)\s*$/i;
const PAGE_TURNER_RE = /^\(page turner\)\s*$/i;
const DIALOGUE_RE = /^\t([A-Z][A-Z0-9' ]*)(?:\s*(\([^)]*\)))?:\s*(.*)$/;

function classifyLine(text: string): LineKind {
  const trimmed = text.trim();
  if (PAGE_RE.test(trimmed)) return "page";
  if (PANEL_RE.test(trimmed)) return "panel";
  if (PAGE_TURNER_RE.test(trimmed)) return "pageTurner";
  const lettering = text.match(DIALOGUE_RE);
  if (lettering) {
    const subject = lettering[1].trim().toUpperCase();
    if (subject === "CAPTION") return "caption";
    if (subject === "SFX") return "sfx";
    return "dialogue";
  }
  if (trimmed === "") return "blank";
  return "paragraph";
}

// ---------------------------------------------------------------------
// Editor decorations: line classes + inline dialogue token spans.
// ---------------------------------------------------------------------

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      const kind = classifyLine(text);

      if (kind !== "blank") {
        builder.add(line.from, line.from, Decoration.line({ class: `cm-${kind}` }));
      }

      if (kind === "dialogue") {
        const match = text.match(DIALOGUE_RE);
        if (match) {
          const [, subject, modifier, content] = match;

          const subjectStart = line.from + text.indexOf(subject);
          builder.add(
            subjectStart,
            subjectStart + subject.length,
            Decoration.mark({ class: "cm-lettering-subject" })
          );

          if (modifier) {
            const inner = modifier.slice(1, -1);
            const modifierStart = line.from + text.indexOf(inner, subjectStart - line.from);
            if (inner.length > 0) {
              builder.add(
                modifierStart,
                modifierStart + inner.length,
                Decoration.mark({ class: "cm-lettering-modifier" })
              );
            }
          }

          if (content && content.length > 0) {
            const contentStart = line.to - content.length;
            builder.add(
              contentStart,
              contentStart + content.length,
              Decoration.mark({ class: "cm-lettering-content" })
            );
          }
        }
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

class ScriptHighlightPlugin implements PluginValue {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }
  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = buildDecorations(update.view);
    }
  }
}

const scriptHighlightPlugin = ViewPlugin.fromClass(ScriptHighlightPlugin, {
  decorations: (v) => v.decorations,
});

// ---------------------------------------------------------------------
// Outline (page/panel sidebar) — computed from plain source text, same
// data the parent already holds, so no dependency on live editor state.
// ---------------------------------------------------------------------

type OutlineEntry = { line: number; label: string; isPage: boolean };

function buildOutline(lines: string[]): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  let pageNumber = 0;
  let openPanelLine: number | null = null;
  let description = "";

  const flushPanel = () => {
    if (openPanelLine !== null) {
      entries.push({ line: openPanelLine, label: description || "Enter description...", isPage: false });
    }
    openPanelLine = null;
    description = "";
  };

  lines.forEach((text, index) => {
    const lineNumber = index + 1;
    const kind = classifyLine(text);

    if (kind === "page") {
      flushPanel();
      const match = text.trim().match(PAGE_RE);
      const start = pageNumber + 1;
      const isSpread = Boolean(match?.[2]);
      pageNumber += isSpread ? 2 : 1;
      entries.push({
        line: lineNumber,
        label: isSpread ? `Page ${start}-${start + 1}` : `Page ${start}`,
        isPage: true,
      });
    } else if (kind === "panel") {
      flushPanel();
      openPanelLine = lineNumber;
    } else if (openPanelLine !== null && !description && text.trim() && !["dialogue", "caption", "sfx"].includes(kind)) {
      description = text.trim();
    }
  });

  flushPanel();
  return entries;
}

function rememberedNamesFromLines(lines: string[]): string[] {
  const names = new Set<string>();
  lines.forEach((text) => {
    const match = text.match(DIALOGUE_RE);
    if (match && !["CAPTION", "SFX"].includes(match[1].trim().toUpperCase())) names.add(match[1].trim());
  });
  return [...names];
}

// ---------------------------------------------------------------------
// Character-name autocomplete, triggered while typing a dialogue
// subject (tab, then the name, before the colon).
// ---------------------------------------------------------------------

function rememberedNamesFromDoc(doc: Text): string[] {
  const names = new Set<string>();
  for (let i = 1; i <= doc.lines; i++) {
    const match = doc.line(i).text.match(DIALOGUE_RE);
    if (match && !["CAPTION", "SFX"].includes(match[1].trim().toUpperCase())) names.add(match[1].trim());
  }
  return [...names];
}

function dialogueNameCompletions(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const match = before.match(/^\t([A-Z][A-Z0-9' ]*)$/);
  if (!match) return null;

  const query = match[1];
  const options = rememberedNamesFromDoc(context.state.doc).filter(
    (name) => name.toLowerCase().startsWith(query.toLowerCase()) && name.toLowerCase() !== query.toLowerCase()
  );
  if (!options.length) return null;

  return {
    from: line.from + 1, // right after the tab
    options: options.map((name) => ({ label: name, type: "text" })),
  };
}

const characterAutocomplete = autocompletion({ override: [dialogueNameCompletions] });

// ---------------------------------------------------------------------
// Command-bar / Alt+1-5 actions, operating directly on the EditorView.
// ---------------------------------------------------------------------

function nextPageNumber(doc: Text, throughLine: number): number {
  let pageNumber = 0;
  for (let lineNumber = 1; lineNumber <= throughLine; lineNumber++) {
    const match = doc.line(lineNumber).text.trim().match(PAGE_RE);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;
      pageNumber += Math.max(1, end - start + 1);
    }
  }
  return pageNumber + 1;
}

function nextPanelNumber(doc: Text, throughLine: number): number {
  let panelNumber = 0;
  for (let lineNumber = 1; lineNumber <= throughLine; lineNumber++) {
    const text = doc.line(lineNumber).text.trim();
    if (PAGE_RE.test(text)) panelNumber = 0;
    else if (PANEL_RE.test(text)) panelNumber += 1;
  }
  return panelNumber + 1;
}

function insertNextPageOrPanel(view: EditorView, kind: "page" | "panel") {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const label =
    kind === "page"
      ? `Page ${nextPageNumber(state.doc, line.number)}`
      : `Panel ${nextPanelNumber(state.doc, line.number)}`;
  const onBlankLine = line.text.trim() === "";
  const insertText = onBlankLine ? label : `\n${label}`;
  const from = line.to;

  view.dispatch({
    changes: { from, to: from, insert: insertText },
    selection: { anchor: from + insertText.length },
  });
  view.focus();
}

function insertDialogueSkeleton(view: EditorView) {
  const pos = view.state.selection.main.head;
  const insertText = "\t (): ";
  view.dispatch({
    changes: { from: pos, insert: insertText },
    selection: { anchor: pos + 1 }, // right after the tab, ready to type the name
  });
  view.focus();
}

function insertLetteringTag(view: EditorView, label: "CAPTION" | "SFX") {
  const pos = view.state.selection.main.head;
  const insertText = `\t${label} (): `;
  view.dispatch({
    changes: { from: pos, insert: insertText },
    selection: { anchor: pos + insertText.length },
  });
  view.focus();
}

// Enter on an already-blank line inserts the next Panel (Shift-Enter:
// the next Page) — same auto-numbering behavior as the base editor.
function insertNextBlockOnEnter(view: EditorView, kind: "page" | "panel"): boolean {
  const { state } = view;
  const line = state.doc.lineAt(state.selection.main.head);
  const prevLine = line.number > 1 ? state.doc.line(line.number - 1) : null;
  const onBlankLine = line.text.trim() === "";
  const prevBlank = prevLine ? prevLine.text.trim() === "" : false;
  if (!onBlankLine || !prevBlank) return false;

  const label =
    kind === "page"
      ? `Page ${nextPageNumber(state.doc, line.number)}`
      : `Panel ${nextPanelNumber(state.doc, line.number)}`;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: label },
    selection: { anchor: line.from + label.length },
  });
  return true;
}

const editorKeymap = keymap.of([
  { key: "Enter", run: (view) => insertNextBlockOnEnter(view, "panel") },
  { key: "Shift-Enter", run: (view) => insertNextBlockOnEnter(view, "page") },
  {
    key: "Alt-1",
    run: (view) => {
      insertNextPageOrPanel(view, "page");
      return true;
    },
  },
  {
    key: "Alt-2",
    run: (view) => {
      insertNextPageOrPanel(view, "panel");
      return true;
    },
  },
  {
    key: "Alt-3",
    run: (view) => {
      insertDialogueSkeleton(view);
      return true;
    },
  },
  {
    key: "Alt-4",
    run: (view) => {
      insertLetteringTag(view, "CAPTION");
      return true;
    },
  },
  {
    key: "Alt-5",
    run: (view) => {
      insertLetteringTag(view, "SFX");
      return true;
    },
  },
] satisfies KeyBinding[]);

// ---------------------------------------------------------------------
// Visual styling — same cm-* class names as the base editor, plus the
// original script-* class names on the surrounding chrome so any
// existing stylesheet targeting them keeps working unchanged.
// ---------------------------------------------------------------------

const scriptTheme = EditorView.baseTheme({
  "&": { fontSize: "15px" },
  ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, monospace)" },
  ".cm-page": { fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.04em", opacity: "0.85" },
  ".cm-panel": { fontWeight: "700" },
  ".cm-pageTurner": { fontStyle: "italic", opacity: "0.6" },
  ".cm-paragraph": { opacity: "0.85" },
  ".cm-dialogue": { paddingLeft: "1.5em" },
  ".cm-lettering-subject": { fontWeight: "700" },
  ".cm-lettering-modifier": { fontStyle: "italic", opacity: "0.7" },
  ".cm-lettering-content": {},
});

// ---------------------------------------------------------------------

export function ScriptStudio({ document: script, title, onChange, onSave, onClose }: ScriptStudioProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [fileStatus, setFileStatus] = useState("");

  const lines = useMemo(() => script.source.replace(/\r/g, "").split("\n"), [script.source]);
  const outline = useMemo(() => buildOutline(lines), [lines]);
  const names = useMemo(() => rememberedNamesFromLines(lines), [lines]);
  const stats = useMemo(() => getStats(lines), [lines]);

  const extensions = useMemo(
    () => [
      scriptTheme,
      scriptHighlightPlugin,
      characterAutocomplete,
      editorKeymap,
      EditorView.lineWrapping,
      placeholder("Press Alt+1 to add a page"),
    ],
    []
  );

  const handleChange = useCallback(
    (value: string) => {
      // Spreads the incoming document so any fields beyond source/version
      // (or version logic owned elsewhere) survive untouched.
      onChange({ ...script, source: value });
    },
    [onChange, script]
  );

  const runCommand = useCallback((fn: (view: EditorView) => void) => {
    const view = editorRef.current?.view;
    if (view) fn(view);
  }, []);

  const jumpToLine = useCallback((lineNumber: number) => {
    const view = editorRef.current?.view;
    if (!view) return;
    const line = view.state.doc.line(lineNumber);
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    view.focus();
  }, []);

  const selectAll = useCallback(() => {
    const view = editorRef.current?.view;
    if (!view) return;
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
    view.focus();
  }, []);

  const importFile = useCallback((file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        setFileStatus("Could not open that script file");
        return;
      }
      let source = reader.result;
      if (/\.cwscript$/i.test(file.name)) {
        try {
          const parsed: unknown = JSON.parse(source);
          if (!parsed || typeof parsed !== "object" || !("source" in parsed) || typeof parsed.source !== "string") {
            throw new Error("Invalid script document");
          }
          source = parsed.source;
        } catch {
          setFileStatus("Invalid .cwscript file");
          return;
        }
      }
      onChange({ ...script, source });
      setFileStatus(`Opened ${file.name}`);
    });
    reader.addEventListener("error", () => setFileStatus("Could not open that script file"));
    reader.readAsText(file);
  }, [onChange, script]);

  const exportFile = useCallback(() => {
    const blob = new Blob([JSON.stringify({ source: script.source, version: 1 }, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(title)}.cwscript`;
    link.click();
    URL.revokeObjectURL(url);
    setFileStatus("Script exported");
  }, [script.source, title]);

  const closeMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
  };

  return (
    <section className="script-studio">
      <header className="script-menubar">
        <strong>Story Writer</strong>
        <span className="script-document-title">{title}</span>
        <details className="script-menu-group">
          <summary>File</summary>
          <div className="script-menu-popover">
            <button type="button" onClick={(event) => { fileInputRef.current?.click(); closeMenu(event); }}>Open script...</button>
            <button type="button" onClick={(event) => { exportFile(); closeMenu(event); }}>Export .cwscript</button>
            <button type="button" onClick={(event) => { onSave(); closeMenu(event); }}>Save project</button>
            <button type="button" onClick={(event) => { window.print(); closeMenu(event); }}>Print</button>
          </div>
        </details>
        <details className="script-menu-group">
          <summary>Edit</summary>
          <div className="script-menu-popover">
            <button type="button" onClick={(event) => { selectAll(); closeMenu(event); }}>Select all</button>
          </div>
        </details>
        <details className="script-menu-group">
          <summary>View</summary>
          <div className="script-menu-popover">
            <button type="button" onClick={(event) => { setIsInsightsOpen((open) => !open); closeMenu(event); }}>Toggle insights</button>
          </div>
        </details>
        <span className="script-file-status" role="status">{fileStatus}</span>
      </header>
      <input
        ref={fileInputRef}
        className="script-file-input"
        type="file"
        accept=".cwscript,.txt,text/plain,application/json"
        onChange={(event) => {
          importFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div className="script-commandbar">
        <button type="button" onClick={onClose}>Back to chapter</button>
        <span className="script-toolbar-label">Insert</span>
        <button type="button" title="Alt+1" onClick={() => runCommand((view) => insertNextPageOrPanel(view, "page"))}>Page</button>
        <button type="button" title="Alt+2" onClick={() => runCommand((view) => insertNextPageOrPanel(view, "panel"))}>Panel</button>
        <button type="button" title="Alt+3" onClick={() => runCommand(insertDialogueSkeleton)}>Dialogue</button>
        <button type="button" title="Alt+4" onClick={() => runCommand((view) => insertLetteringTag(view, "CAPTION"))}>Caption</button>
        <button type="button" title="Alt+5" onClick={() => runCommand((view) => insertLetteringTag(view, "SFX"))}>SFX</button>
        <span className="script-stats-inline">{stats.pages} {stats.pages === 1 ? "page" : "pages"} · {stats.panels} {stats.panels === 1 ? "panel" : "panels"} · {stats.spokenWords} spoken words</span>
        <button type="button" className="script-insights-toggle" aria-pressed={isInsightsOpen} onClick={() => setIsInsightsOpen((open) => !open)}>Insights</button>
      </div>
      <div className="script-workspace">
        <nav className="script-outline" aria-label="Script outline">
          <span>Outline</span>
          {outline.map((entry) => (
            <button
              key={entry.line}
              type="button"
              className={entry.isPage ? "script-outline-page" : "script-outline-panel"}
              onClick={() => jumpToLine(entry.line)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <main className="script-document" aria-label={`${title} script editor`}>
          <CodeMirror
            ref={editorRef}
            value={script.source}
            height="100%"
            basicSetup={{ lineNumbers: false, foldGutter: false }}
            extensions={extensions}
            onChange={handleChange}
            className="script-editor-shell"
          />
        </main>
        {isInsightsOpen && <aside className="script-insights" aria-label="Script insights">
          <h2>Script insights</h2>
          <div className="script-metric"><span>Pages</span><strong>{stats.pages}</strong></div>
          <div className="script-metric"><span>Panels</span><strong>{stats.panels}</strong></div>
          <div className="script-metric"><span>Spoken words</span><strong>{stats.spokenWords}</strong></div>
          <div className="script-metric"><span>Total words</span><strong>{stats.words}</strong></div>
          <div className="script-metric"><span>Characters</span><strong>{names.length}</strong></div>
        </aside>}
      </div>
    </section>
  );
}

function getStats(lines: string[]) {
  let pages = 0;
  let panels = 0;
  let spokenText = "";

  for (const line of lines) {
    const page = line.trim().match(PAGE_RE);
    if (page) {
      pages += page[2] ? Math.max(1, Number(page[2]) - Number(page[1]) + 1) : 1;
      continue;
    }
    if (PANEL_RE.test(line.trim())) panels += 1;
    const lettering = line.match(DIALOGUE_RE);
    if (lettering && lettering[1].trim().toUpperCase() !== "SFX") spokenText += ` ${lettering[3]}`;
  }

  const countWords = (text: string) => text.match(/[\p{L}\p{N}'’-]+/gu)?.length ?? 0;
  return { pages, panels, spokenWords: countWords(spokenText), words: countWords(lines.join(" ")) };
}

function safeFilename(title: string) {
  return title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-") || "comic-script";
}