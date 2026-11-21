import StarterKit from "@tiptap/starter-kit";

/**
 * The one editor schema, shared by the browser editor and the server validator so their
 * plain-text projections agree. Links/code blocks are disabled to keep documents to prose.
 */
export function editorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      code: false,
      link: false,
      horizontalRule: false,
    }),
  ];
}
