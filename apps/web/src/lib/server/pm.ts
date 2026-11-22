import "server-only";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { pmDocToText } from "@hm/shared/provenance/pmText";
import { editorExtensions } from "../editorExtensions";
import { HttpError } from "../http";

const schema = getSchema(editorExtensions());

/** Validates TipTap JSON against the one editor schema shared with the browser. */
export function contentNode(json: unknown): PMNode {
  try {
    const node = PMNode.fromJSON(schema, json as any);
    node.check();
    return node;
  } catch {
    throw new HttpError(400, "This document contains formatting that can't be saved. Undo your last change, or reload the page.");
  }
}

/** Validates TipTap JSON against the editor schema and returns its plain-text projection. */
export function contentToText(json: unknown): string {
  return pmDocToText(contentNode(json));
}

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
