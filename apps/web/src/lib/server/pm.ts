import "server-only";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { pmDocToText } from "@hm/shared/provenance/pmText";
import { editorExtensions } from "../editorExtensions";
import { HttpError } from "../http";

const schema = getSchema(editorExtensions());

/** Validates TipTap JSON against the editor schema and returns its plain-text projection. */
export function contentToText(json: unknown): string {
  let node: PMNode;
  try {
    node = PMNode.fromJSON(schema, json as any);
    node.check();
  } catch {
    throw new HttpError(400, "Document content doesn't match the editor schema");
  }
  return pmDocToText(node);
}

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
