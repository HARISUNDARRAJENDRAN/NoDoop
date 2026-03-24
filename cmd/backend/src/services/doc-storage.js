import crypto from "node:crypto";
import { randomUUID } from "node:crypto";

import { DocVersion } from "../models/DocVersion.js";
import { Document } from "../models/Document.js";
import { putBlob } from "./dfs-client.js";

export async function persistDocumentVersion({
  docId,
  authorId,
  payload,
  parentVersionId = null
}) {
  const versionId = randomUUID();
  const dfsKey = `docs/${docId}/versions/${versionId}.bin`;
  const checksum = crypto.createHash("sha256").update(payload).digest("hex");

  await putBlob(dfsKey, payload);

  const version = await DocVersion.create({
    docId,
    versionId,
    parentVersionId,
    dfsKey,
    authorId,
    size: payload.length,
    checksum
  });

  await Document.updateOne(
    { _id: docId },
    {
      $set: {
        latestVersionId: versionId,
        updatedAtLogical: new Date()
      }
    }
  );

  return version;
}
