import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../db.js';
import { TIER_ORDER } from '../engine/costEngine.js';
import { FILE_TYPES } from '../engine/classification.js';
import { RULE_TEMPLATES, getTemplate } from '../engine/ruleTemplates.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();
const VALID_FROM = ['Any', ...TIER_ORDER];
const VALID_FILE_TYPE = [null, ...FILE_TYPES];

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM rules ORDER BY sort_order ASC');
  res.json(rows);
}));

router.get('/templates', (req, res) => {
  res.json(RULE_TEMPLATES.map(({ id, name, description, rules }) => ({
    id, name, description, rule_count: rules.length,
  })));
});

router.post('/templates/:id/apply', asyncHandler(async (req, res) => {
  const template = getTemplate(req.params.id);
  if (!template) return res.status(404).json({ error: 'template not found' });

  const { rows: maxRows } = await query('SELECT MAX(sort_order) AS m FROM rules');
  let nextOrder = (maxRows[0].m ?? -1) + 1;

  const created = await withTransaction(async (client) => {
    const rows = [];
    for (const r of template.rules) {
      const rule = {
        id: uuidv4(),
        name: r.name,
        from_tier: r.from_tier,
        to_tier: r.action === 'delete' ? null : r.to_tier,
        condition_days: r.condition_days,
        action: r.action,
        sort_order: nextOrder++,
        file_type: r.file_type || null,
      };
      await client.query(
        `INSERT INTO rules (id, name, from_tier, to_tier, condition_days, action, sort_order, file_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [rule.id, rule.name, rule.from_tier, rule.to_tier, rule.condition_days, rule.action, rule.sort_order, rule.file_type]
      );
      rows.push(rule);
    }
    return rows;
  });

  res.status(201).json(created);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, from_tier, to_tier, condition_days, action, file_type } = req.body;
  if (!name || !VALID_FROM.includes(from_tier) || !['transition', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'invalid rule payload' });
  }
  if (action === 'transition' && !TIER_ORDER.includes(to_tier)) {
    return res.status(400).json({ error: 'to_tier required for transition rules' });
  }
  if (!Number.isFinite(condition_days) || condition_days < 0) {
    return res.status(400).json({ error: 'condition_days must be a non-negative number' });
  }
  const normalizedFileType = file_type || null;
  if (!VALID_FILE_TYPE.includes(normalizedFileType)) {
    return res.status(400).json({ error: `file_type must be one of ${FILE_TYPES.join(', ')}, or omitted for any type` });
  }
  const { rows: maxRows } = await query('SELECT MAX(sort_order) AS m FROM rules');
  const maxOrder = maxRows[0].m ?? -1;
  const rule = {
    id: uuidv4(),
    name,
    from_tier,
    to_tier: action === 'delete' ? null : to_tier,
    condition_days,
    action,
    sort_order: maxOrder + 1,
    file_type: normalizedFileType,
  };
  await query(
    `INSERT INTO rules (id, name, from_tier, to_tier, condition_days, action, sort_order, file_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [rule.id, rule.name, rule.from_tier, rule.to_tier, rule.condition_days, rule.action, rule.sort_order, rule.file_type]
  );
  res.status(201).json(rule);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM rules WHERE id = $1', [req.params.id]);
  const existing = rows[0];
  if (!existing) return res.status(404).json({ error: 'rule not found' });

  const { name, from_tier, to_tier, condition_days, action, sort_order, file_type } = req.body;
  const normalizedFileType = file_type === undefined ? existing.file_type : (file_type || null);
  if (!VALID_FILE_TYPE.includes(normalizedFileType)) {
    return res.status(400).json({ error: `file_type must be one of ${FILE_TYPES.join(', ')}, or omitted for any type` });
  }
  const updated = {
    name: name ?? existing.name,
    from_tier: from_tier ?? existing.from_tier,
    to_tier: action === 'delete' ? null : (to_tier ?? existing.to_tier),
    condition_days: condition_days ?? existing.condition_days,
    action: action ?? existing.action,
    sort_order: sort_order ?? existing.sort_order,
    file_type: normalizedFileType,
  };
  await query(
    `UPDATE rules SET name = $1, from_tier = $2, to_tier = $3,
       condition_days = $4, action = $5, sort_order = $6, file_type = $7
     WHERE id = $8`,
    [updated.name, updated.from_tier, updated.to_tier, updated.condition_days, updated.action, updated.sort_order, updated.file_type, req.params.id]
  );

  const { rows: updatedRows } = await query('SELECT * FROM rules WHERE id = $1', [req.params.id]);
  res.json(updatedRows[0]);
}));

router.post('/reorder', asyncHandler(async (req, res) => {
  const { order } = req.body; // array of rule ids in desired order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of rule ids' });

  await withTransaction(async (client) => {
    for (let index = 0; index < order.length; index++) {
      await client.query('UPDATE rules SET sort_order = $1 WHERE id = $2', [index, order[index]]);
    }
  });
  const { rows } = await query('SELECT * FROM rules ORDER BY sort_order ASC');
  res.json(rows);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM rules WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'rule not found' });
  await query('DELETE FROM rules WHERE id = $1', [req.params.id]);
  res.status(204).send();
}));

export default router;
