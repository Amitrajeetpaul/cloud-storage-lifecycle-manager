import db from '../db.js';
import { classifyFileType, classifyAccessFrequency } from './classification.js';

const ACCESS_WINDOW_DAYS = 30;
const ACCESS_WINDOW_MS = ACCESS_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const accessCountsStmt = db.prepare(`
  SELECT object_id, COUNT(*) AS cnt FROM audit_log
  WHERE action = 'access' AND created_at >= ?
  GROUP BY object_id
`);

// Adds derived, read-only classification fields to each object: file_type
// (pattern-matched from the name) and access_count_30d/access_frequency
// (observed 'access' audit events in the rolling window). Nothing here is
// stored — it's computed fresh on every read so it always reflects the
// current rolling window and rule evaluation hasn't drifted from the data.
export function enrichObjects(objects, now = Date.now()) {
  const rows = accessCountsStmt.all(now - ACCESS_WINDOW_MS);
  const countByObject = new Map(rows.map((r) => [r.object_id, r.cnt]));

  return objects.map((obj) => {
    const accessCount30d = countByObject.get(obj.id) ?? 0;
    return {
      ...obj,
      file_type: classifyFileType(obj.name),
      access_count_30d: accessCount30d,
      access_frequency: classifyAccessFrequency(accessCount30d),
    };
  });
}
