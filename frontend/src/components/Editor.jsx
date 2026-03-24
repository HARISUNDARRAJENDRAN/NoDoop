import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Color } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Collaboration from "@tiptap/extension-collaboration";

import EditorToolbar from "./EditorToolbar.jsx";

export default function Editor({ ydoc, provider, readOnly = false }) {
  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ history: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Start typing..." }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Image,
      Color,
      FontFamily,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Collaboration.configure({ document: ydoc })
    ],
    editorProps: {
      attributes: {
        class: "tiptap-editor"
      }
    }
  }, [ydoc]);

  if (!editor) return null;

  return (
    <div className="editor-container">
      {!readOnly && <EditorToolbar editor={editor} />}
      <div className="editor-page-wrapper">
        <div className="editor-page">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
