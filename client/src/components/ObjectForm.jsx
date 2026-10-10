import { useState } from 'react';
import { TIER_ORDER } from '../tierConfig';

const initialSimulated = { name: '', size_mb: '', tier: 'Hot' };

export default function ObjectForm({ onCreateObject, onUploadObject }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'simulated'

  // --- real file upload ---
  const [file, setFile] = useState(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadTier, setUploadTier] = useState('Hot');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !uploadName) setUploadName(f.name);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Choose a file to upload.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await onUploadObject(file, uploadTier, uploadName.trim() || file.name);
      setFile(null);
      setUploadName('');
      e.target.reset();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // --- simulated object (typed-in size, no real file content) ---
  const [simForm, setSimForm] = useState(initialSimulated);
  const [simSubmitting, setSimSubmitting] = useState(false);
  const [simError, setSimError] = useState(null);

  const handleSimSubmit = async (e) => {
    e.preventDefault();
    const sizeMb = parseFloat(simForm.size_mb);
    if (!simForm.name.trim() || !Number.isFinite(sizeMb) || sizeMb <= 0) {
      setSimError('Enter a name and a positive size in MB.');
      return;
    }
    setSimSubmitting(true);
    setSimError(null);
    try {
      await onCreateObject({ name: simForm.name.trim(), size_mb: sizeMb, tier: simForm.tier });
      setSimForm(initialSimulated);
    } catch (err) {
      setSimError(err.message);
    } finally {
      setSimSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-cream-300 p-1 sm:w-fit" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          onClick={() => setMode('upload')}
          className={`focus-ring rounded-md px-4 py-2 text-sm font-medium transition ${
            mode === 'upload' ? 'bg-white text-navy-700 shadow-soft' : 'text-navy-400 hover:text-navy-600'
          }`}
        >
          Upload a file
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'simulated'}
          onClick={() => setMode('simulated')}
          className={`focus-ring rounded-md px-4 py-2 text-sm font-medium transition ${
            mode === 'simulated' ? 'bg-white text-navy-700 shadow-soft' : 'text-navy-400 hover:text-navy-600'
          }`}
        >
          Add simulated object (custom size)
        </button>
      </div>

      {mode === 'upload' ? (
        <form onSubmit={handleUploadSubmit}>
          <p className="mb-3 text-xs text-navy-400">
            Uploads the real file bytes to MinIO — size is read from the actual file, not typed in.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <div>
              <label htmlFor="upload-file" className="mb-1 block text-xs font-medium text-navy-400">File</label>
              <input
                id="upload-file"
                type="file"
                onChange={handleFileChange}
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2 text-sm text-navy-700 transition file:mr-3 file:rounded-md file:border-0 file:bg-coral-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
            </div>
            <div>
              <label htmlFor="upload-name" className="mb-1 block text-xs font-medium text-navy-400">Display name</label>
              <input
                id="upload-name"
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="optional override"
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm text-navy-700 transition placeholder:text-navy-300 focus:border-coral-300"
              />
            </div>
            <div>
              <label htmlFor="upload-tier" className="mb-1 block text-xs font-medium text-navy-400">Initial tier</label>
              <select
                id="upload-tier"
                value={uploadTier}
                onChange={(e) => setUploadTier(e.target.value)}
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm text-navy-700 transition focus:border-coral-300"
              >
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={uploading}
                className="focus-ring w-full rounded-lg bg-coral-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-coral-600 active:bg-coral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
          {uploadError && <p className="mt-2 text-xs font-medium text-coral-600">{uploadError}</p>}
        </form>
      ) : (
        <form onSubmit={handleSimSubmit}>
          <p className="mb-3 text-xs text-navy-400">
            No real file — just a placeholder object with a size you type in. Useful for quickly demoing
            cost math for large objects (e.g. "5000 MB") without needing an actual 5 GB file.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <div>
              <label htmlFor="obj-name" className="mb-1 block text-xs font-medium text-navy-400">Name</label>
              <input
                id="obj-name"
                type="text"
                placeholder="quarterly-report.pdf"
                value={simForm.name}
                onChange={(e) => setSimForm((f) => ({ ...f, name: e.target.value }))}
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm text-navy-700 transition placeholder:text-navy-300 focus:border-coral-300"
              />
            </div>
            <div>
              <label htmlFor="obj-size" className="mb-1 block text-xs font-medium text-navy-400">Size (MB)</label>
              <input
                id="obj-size"
                type="number"
                min="0.1"
                step="0.1"
                placeholder="250"
                value={simForm.size_mb}
                onChange={(e) => setSimForm((f) => ({ ...f, size_mb: e.target.value }))}
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm text-navy-700 transition placeholder:text-navy-300 focus:border-coral-300"
              />
            </div>
            <div>
              <label htmlFor="obj-tier" className="mb-1 block text-xs font-medium text-navy-400">Initial tier</label>
              <select
                id="obj-tier"
                value={simForm.tier}
                onChange={(e) => setSimForm((f) => ({ ...f, tier: e.target.value }))}
                className="focus-ring w-full rounded-lg border border-navy-100 bg-cream-200/40 px-3 py-2.5 text-sm text-navy-700 transition focus:border-coral-300"
              >
                {TIER_ORDER.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={simSubmitting}
                className="focus-ring w-full rounded-lg bg-coral-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-coral-600 active:bg-coral-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {simSubmitting ? 'Adding…' : 'Add object'}
              </button>
            </div>
          </div>
          {simError && <p className="mt-2 text-xs font-medium text-coral-600">{simError}</p>}
        </form>
      )}
    </div>
  );
}
