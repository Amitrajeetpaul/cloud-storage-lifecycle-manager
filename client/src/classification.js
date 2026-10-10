// Mirrors server/engine/classification.js's category list — kept here only
// for the Rules form's file-type dropdown; actual classification always
// happens server-side (the API returns file_type/access_frequency already
// computed on every object).
export const FILE_TYPES = ['Logs', 'Backup', 'Media', 'Document', 'ML/Dataset', 'Archive', 'User Upload', 'Other'];

export const ACCESS_FREQUENCY_STYLES = {
  Frequent: { color: '#1A7E76', bg: '#E9FBF9' },
  Occasional: { color: '#B58200', bg: '#FFF8E8' },
  Rare: { color: '#6A6A8C', bg: '#F2F2F6' },
};
