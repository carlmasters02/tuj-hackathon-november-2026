/**
 * The plain-text projection of a ProseMirror document that provenance events refer to.
 * Both the browser editor and the server call `doc.textBetween` with exactly these
 * arguments, so their offsets agree.
 */
export const BLOCK_SEPARATOR = "\n";

interface PMNodeLike {
  content: { size: number };
  textBetween(from: number, to: number, blockSeparator?: string, leafText?: string | ((leaf: any) => string)): string;
}

export function leafText(node: { type: { name: string } }): string {
  return node.type.name === "hardBreak" ? "\n" : "";
}

export function pmDocToText(doc: PMNodeLike): string {
  return doc.textBetween(0, doc.content.size, BLOCK_SEPARATOR, leafText);
}

interface PMNodeWalk {
  descendants(f: (node: any, pos: number) => boolean | void): void;
  content: { size: number };
}

/**
 * Maps an offset in the plain-text projection back to a ProseMirror position
 * (used to highlight RedPen flags). Mirrors textBetween's separator rules.
 */
export function posAtTextOffset(doc: PMNodeWalk, offset: number): number {
  let text = 0;
  let first = true;
  let result = -1;
  doc.descendants((node, pos) => {
    if (result >= 0) return false;
    if (node.isBlock && node.isTextblock) {
      if (!first) {
        if (offset <= text) {
          result = pos;
          return false;
        }
        text += BLOCK_SEPARATOR.length;
      }
      first = false;
      return true;
    }
    if (node.isText) {
      const len = node.text.length;
      if (offset <= text + len) {
        result = pos + (offset - text);
        return false;
      }
      text += len;
    } else if (node.isLeaf && node.isInline) {
      const len = leafText(node).length;
      if (offset < text + len || (len === 0 && offset === text)) {
        result = pos;
        return false;
      }
      text += len;
    }
    return true;
  });
  return result >= 0 ? result : doc.content.size;
}
