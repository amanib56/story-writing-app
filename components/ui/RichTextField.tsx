"use client";

import { useEffect, useRef } from "react";

type RichTextFieldProps = {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

export function RichTextField({ label, onChange, placeholder, value }: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  const updateValue = () => onChange(editorRef.current?.innerHTML ?? "");
  const format = (command: "bold" | "italic" | "insertUnorderedList") => {
    editorRef.current?.focus();
    document.execCommand(command);
    updateValue();
  };

  return <div className="rich-text-shell">
    <div className="format-toolbar" aria-label={`${label} formatting`}>
      <button type="button" title="Bold" aria-label="Bold" onMouseDown={(event) => { event.preventDefault(); format("bold"); }}><strong>B</strong></button>
      <button type="button" title="Italic" aria-label="Italic" onMouseDown={(event) => { event.preventDefault(); format("italic"); }}><em>I</em></button>
      <button type="button" title="Bulleted list" aria-label="Bulleted list" onMouseDown={(event) => { event.preventDefault(); format("insertUnorderedList"); }}>•</button>
    </div>
    <div className="rich-text-editor" ref={editorRef} contentEditable role="textbox" aria-label={label} aria-multiline="true" data-placeholder={placeholder} suppressContentEditableWarning onInput={updateValue} onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        format("bold");
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        format("italic");
        return;
      }
      if (event.key === " " && window.getSelection()?.toString() === "") {
        const selection = window.getSelection();
        const text = selection?.anchorNode?.textContent;
        if (text === "-" && selection?.anchorOffset === 1) {
          event.preventDefault();
          const editor = editorRef.current!;
          const bulletList = document.createElement("ul");
          const bulletItem = document.createElement("li");
          bulletItem.append(document.createElement("br"));
          bulletList.append(bulletItem);
          const line = selection.anchorNode?.parentElement?.closest("div, p");
          if (line && line.parentElement === editor) editor.replaceChild(bulletList, line);
          else editor.replaceChildren(bulletList);
          const range = document.createRange();
          range.selectNodeContents(bulletItem);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          updateValue();
          return;
        }
      }
      if (event.key !== "Tab") return;
      event.preventDefault();
      document.execCommand(event.shiftKey ? "outdent" : "indent");
      updateValue();
    }} />
  </div>;
}

type AutoResizeTextAreaProps = { label: string; onChange: (value: string) => void; placeholder: string; value: string };

export function AutoResizeTextArea({ label, onChange, placeholder, value }: AutoResizeTextAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${textarea.scrollHeight}px`; }
  }, [value]);
  return <textarea className="auto-resize-textarea" ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} rows={1} spellCheck />;
}