import { describe, it, expect } from 'vitest';
import { RULE_TEMPLATES, getTemplate } from './ruleTemplates.js';
import { TIER_ORDER } from './costEngine.js';
import { FILE_TYPES } from './classification.js';

const VALID_FROM = ['Any', ...TIER_ORDER];

describe('RULE_TEMPLATES', () => {
  it('has at least one template', () => {
    expect(RULE_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('every template has unique id, a name, a description, and at least one rule', () => {
    const ids = new Set();
    for (const template of RULE_TEMPLATES) {
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.rules.length).toBeGreaterThan(0);
      expect(ids.has(template.id)).toBe(false);
      ids.add(template.id);
    }
  });

  it('every rule in every template is structurally valid', () => {
    for (const template of RULE_TEMPLATES) {
      for (const rule of template.rules) {
        expect(VALID_FROM).toContain(rule.from_tier);
        expect(['transition', 'delete']).toContain(rule.action);
        expect(rule.condition_days).toBeGreaterThanOrEqual(0);
        if (rule.action === 'transition') {
          expect(TIER_ORDER).toContain(rule.to_tier);
        } else {
          expect(rule.to_tier).toBeNull();
        }
        if (rule.file_type) {
          expect(FILE_TYPES).toContain(rule.file_type);
        }
      }
    }
  });
});

describe('getTemplate', () => {
  it('returns a template by id', () => {
    expect(getTemplate('log-retention-90d')?.name).toBe('Log Retention (90 days)');
  });

  it('returns null for an unknown id', () => {
    expect(getTemplate('does-not-exist')).toBeNull();
  });
});
