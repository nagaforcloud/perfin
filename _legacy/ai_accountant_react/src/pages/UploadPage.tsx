import { useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { ReceiptCapture } from '@/components/ReceiptCapture';

export function UploadPage() {
  const { selectedAccount, showToast } = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('account', selectedAccount || 'Default');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      showToast(`Imported ${data.imported || data.inserted} transactions${data.ocr_used ? ' (OCR used)' : ''}`, 'success');
      setFile(null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-5">Upload Statement</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div
            className={`h-80 flex flex-col items-center justify-center border-2 border-dashed rounded-[var(--radius-xl)] transition-colors cursor-pointer ${
              dragOver ? 'border-[var(--primary)] bg-[var(--primary-soft)]' : 'border-[var(--border)] bg-[var(--surface)]'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--primary-soft)] flex items-center justify-center mb-4">
              <Upload size={24} className="text-[var(--primary)]" />
            </div>
            <p className="text-base font-medium mb-1">Drop your bank statement here</p>
            <p className="text-sm text-[var(--text-muted)] mb-4">or click to browse</p>
            <input id="file-input" type="file" className="hidden" accept=".pdf,.csv,.xlsx,.xls,.qif,.ofx,.qfx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">Browse files</Button>
              <span className="text-sm text-[var(--text-muted)] self-center">or</span>
              <ReceiptCapture onCapture={setFile} />
            </div>
          </div>
          {file && (
            <div className="mt-4 flex items-center justify-between px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)]">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-[var(--text-muted)]" />
                <span className="text-sm font-medium truncate">{file.name}</span>
              </div>
              <Button variant="primary" size="sm" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Importing...' : 'Upload'}
              </Button>
            </div>
          )}
        </div>
        <Card title="Supported Formats">
          <div className="space-y-2 text-sm text-[var(--text-muted)]">
            <div className="flex items-center gap-2"><FileText size={14} /> PDF (text + scanned)</div>
            <div className="flex items-center gap-2"><FileText size={14} /> CSV bank exports</div>
            <div className="flex items-center gap-2"><FileText size={14} /> Excel (.xlsx, .xls)</div>
            <div className="flex items-center gap-2"><FileText size={14} /> Quicken (.qif)</div>
            <div className="flex items-center gap-2"><FileText size={14} /> OFX / QFX</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
