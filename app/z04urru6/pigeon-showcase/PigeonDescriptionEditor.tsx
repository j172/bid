"use client";

// Simplified sibling of app/z04urru6/listings/DescriptionEditor.tsx (issue
// #54) — reuses the same self-hosted TinyMCE script approach
// (tinymceScriptSrc="/tinymce/tinymce.min.js", licenseKey="gpl") but drops
// the image-upload machinery: pigeon_showcase has no per-row image storage
// endpoint (unlike listings, which uploads description images alongside its
// photos), so the "image" plugin is left out entirely rather than wired up
// to nothing.

import { Editor } from "@tinymce/tinymce-react";
import { COLOR_MAP } from "@/lib/editorColorMap";
import { descriptionPlainTextLength } from "@/lib/listingValidation";
import { DESCRIPTION_MAX } from "@/lib/pigeonShowcaseValidation";

interface PigeonDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  error?: string | null;
}

export default function PigeonDescriptionEditor({ value, onChange, error }: PigeonDescriptionEditorProps) {
  const plainTextLength = descriptionPlainTextLength(value);
  const counterClass = `text-xs ${plainTextLength > DESCRIPTION_MAX ? "text-ended" : "text-ink-light"}`;

  return (
    <div className="flex flex-col gap-1">
      <Editor
        tinymceScriptSrc="/tinymce/tinymce.min.js"
        licenseKey="gpl"
        value={value}
        onEditorChange={onChange}
        init={{
          height: 320,
          menubar: false,
          branding: false,
          promotion: false,
          language: "zh-TW",
          // Native statusbar would duplicate the custom counter below.
          statusbar: false,
          plugins: "lists link table fullscreen searchreplace code",
          toolbar:
            "undo redo | blocks fontsize | bold italic underline strikethrough | forecolor backcolor | " +
            "alignleft aligncenter alignright | bullist numlist | blockquote hr | link table removeformat | " +
            "searchreplace fullscreen code",
          block_formats: "段落=p; 標題=h2; 副標題=h3",
          color_map: COLOR_MAP,
        }}
      />
      <div className="flex items-center justify-between">
        <span>{error && <span className="text-sm text-ended">{error}</span>}</span>
        <span className={counterClass}>
          {plainTextLength}/{DESCRIPTION_MAX}
        </span>
      </div>
    </div>
  );
}
