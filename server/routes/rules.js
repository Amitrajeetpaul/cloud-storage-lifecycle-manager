import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { TIER_ORDER } from '../engine/costEngine.js';
import { FILE_TYPES } from '../engine/classification.js';

const router = Router();
const VALID_FROM = ['Any', ...TIER_ORDER];
const VALID_FILE_TYPE = [null, ...FILE_TYPES];

router.get('/', (req, res) => {
  const rules = db.prepare('SELECT * FROM rules ORDER BY sort_order ASC').all();
  res.json(rules);
});

router.post('/', (req, res) => {
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
  const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM rules').get().m ?? -1;
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
  db.prepare(`
    INSERT INTO rules (id, name, from_tier, to_tier, condition_days, action, sort_order, file_type)
    VALUES (@id, @name, @from_tier, @to_tier, @condition_days, @action, @sort_order, @file_type)
  `).run(rule);
  res.status(201).json(rule);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM rules WHERE id = ?').get(req.params.id);
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
  db.prepare(`
    UPDATE rules SET name = @name, from_tier = @from_tier, to_tier = @to_tier,
      condition_days = @condition_days, action = @action, sort_order = @sort_order, file_type = @file_type
    WHERE id = @id
  `).run({ ...updated, id: req.params.id });

  res.json(db.prepare('SELECT * FROM rules WHERE id = ?').get(req.params.id));
});

router.post('/reorder', (req, res) => {
  const { order } = req.body; // array of rule ids in desired order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of rule ids' });

  const stmt = db.prepare('UPDATE rules SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    order.forEach((id, index) => stmt.run(index, id));
  });
  reorder();
  res.json(db.prepare('SELECT * FROM rules ORDER BY sort_order ASC').all());
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM rules WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'rule not found' });
  db.prepare('DELETE FROM rules WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
