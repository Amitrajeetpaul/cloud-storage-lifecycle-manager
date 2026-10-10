import { describe, it, expect } from 'vitest';
import {
  classifyFileType,
  classifyAccessFrequency,
  recommendTierForFrequency,
  isColderTier,
  retrievalClassFor,
} from './classification.js';

describe('classifyFileType', () => {
  it('matches known filename patterns', () => {
    expect(classifyFileType('log-archive-1234.dat')).toBe('Logs');
    expect(classifyFileType('db-snapshot-5678.dat')).toBe('Backup');
    expect(classifyFileType('video-render-99.dat')).toBe('Media');
    expect(classifyFileType('invoice-42.dat')).toBe('Document');
    expect(classifyFileType('ml-checkpoint-7.dat')).toBe('ML/Dataset');
  });

  it('falls back to Other for unrecognized names and extensions', () => {
    expect(classifyFileType('mystery-blob-1.dat')).toBe('Other');
  });

  it('falls back to file extension for real-world uploaded filenames with no keyword match', () => {
    expect(classifyFileType('quarterly-results.pdf')).toBe('Document');
    expect(classifyFileType('IMG_4821.jpg')).toBe('Media');
    expect(classifyFileType('holiday-clip.mp4')).toBe('Media');
    expect(classifyFileType('project-archive.zip')).toBe('Archive');
  });

  it('prefers a keyword match over the extension when both are present', () => {
    // "log" keyword wins even though .csv would otherwise map to Document.
    expect(classifyFileType('server-log-export.csv')).toBe('Logs');
  });
});

describe('classifyAccessFrequency', () => {
  it('classifies by access count in the rolling window', () => {
    expect(classifyAccessFrequency(0)).toBe('Rare');
    expect(classifyAccessFrequency(1)).toBe('Occasional');
    expect(classifyAccessFrequency(2)).toBe('Occasional');
    expect(classifyAccessFrequency(3)).toBe('Frequent');
    expect(classifyAccessFrequency(10)).toBe('Frequent');
  });
});

describe('recommendTierForFrequency', () => {
  it('maps frequency to the cheapest tier that still fits its retrieval needs', () => {
    expect(recommendTierForFrequency('Frequent')).toBe('Hot');
    expect(recommendTierForFrequency('Occasional')).toBe('Warm');
    expect(recommendTierForFrequency('Rare')).toBe('Archive');
  });
});

describe('isColderTier', () => {
  it('compares tier order', () => {
    expect(isColderTier('Cold', 'Hot')).toBe(true);
    expect(isColderTier('Hot', 'Cold')).toBe(false);
    expect(isColderTier('Hot', 'Hot')).toBe(false);
  });
});

describe('retrievalClassFor', () => {
  it('classifies Hot/Warm as fast and Cold/Archive as slow', () => {
    expect(retrievalClassFor('Hot')).toBe('fast');
    expect(retrievalClassFor('Warm')).toBe('fast');
    expect(retrievalClassFor('Cold')).toBe('slow');
    expect(retrievalClassFor('Archive')).toBe('slow');
  });
});
