import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, LoaderCircle, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { HrStatusBadge } from './HrUi';
import { hrEmployeeDocumentApi } from '../../api/hrEmployeeDocumentApi';
import { documentCategoryLabel, documentCategoryTone, formatFileSize } from '../../utils/hrDocuments';
import { apiErrorMessage } from '../../utils/hr';
import { downloadResponseBlob } from '../../utils/downloadResponseBlob';

export function HrDocumentViewerModal({ isOpen, onClose, document: doc }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !doc?.id) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        setBlobUrl(null);
      }
      setError('');
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');

    hrEmployeeDocumentApi.viewDocumentBlob(doc.id)
      .then((response) => {
        if (!controller.signal.aborted) {
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
          }
          const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
          blobUrlRef.current = url;
          setBlobUrl(url);
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(apiErrorMessage(requestError, 'Không thể tải nội dung file PDF.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      controller.abort();
      document.removeEventListener('keydown', handleKeyDown);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [isOpen, doc?.id, onClose]);

  if (!isOpen || !doc) return null;

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await hrEmployeeDocumentApi.downloadDocument(doc.id);
      downloadResponseBlob(response, doc.fileName || `${doc.documentName}.pdf`);
      toast.success('Đã tải file PDF về máy.');
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tải file PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4" role="presentation">
      <div
        className="fixed inset-0 bg-[var(--cfc-navy)]/60 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
      />

      <section
        aria-labelledby="pdf-viewer-title"
        aria-modal="true"
        className="relative z-50 flex h-[94dvh] w-full max-w-6xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        role="dialog"
      >
        {/* Header toolbar */}
        <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="pdf-viewer-title" className="truncate font-semibold text-gray-900 text-base sm:text-lg">
                  {doc.documentName}
                </h2>
                <HrStatusBadge
                  status={documentCategoryTone(doc.documentCategory)}
                  label={documentCategoryLabel(doc.documentCategory)}
                />
              </div>
              <p className="truncate text-xs text-gray-500 mt-0.5">
                {doc.fileName} · {formatFileSize(doc.fileSizeBytes)}
                {doc.documentNumber && ` · Số: ${doc.documentNumber}`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenInNewTab}
              disabled={!blobUrl}
              title="Mở tài liệu trong tab mới"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Tab mới
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              title="Tải file PDF về máy tính"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {downloading ? 'Đang tải...' : 'Tải về'}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
              aria-label="Đóng trình xem"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* PDF Frame Viewer Area */}
        <div className="relative min-h-0 flex-1 bg-slate-100">
          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
              <LoaderCircle className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Đang tải và hiển thị file PDF...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-rose-600 font-medium">{error}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setError('');
                    setLoading(true);
                    hrEmployeeDocumentApi.viewDocumentBlob(doc.id)
                      .then((response) => {
                        const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                        setBlobUrl(url);
                      })
                      .catch((err) => setError(apiErrorMessage(err, 'Không thể tải file PDF.')))
                      .finally(() => setLoading(false));
                  }}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Thử lại
                </Button>
                <Button type="button" size="sm" onClick={handleDownload}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Tải về máy
                </Button>
              </div>
            </div>
          )}

          {blobUrl && !loading && !error && (
            <>
              {doc.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i) || doc.fileType?.startsWith('image/') ? (
                <div className="flex h-full items-center justify-center overflow-auto p-4 bg-slate-900/10">
                  <img
                    src={blobUrl}
                    alt={doc.documentName}
                    className="max-h-full max-w-full rounded-lg shadow-lg object-contain"
                  />
                </div>
              ) : doc.fileName?.toLowerCase().endsWith('.pdf') || doc.fileType === 'application/pdf' ? (
                <iframe
                  src={blobUrl}
                  className="h-full w-full border-0"
                  title={doc.documentName}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shadow-sm mb-4">
                    <FileText className="h-10 w-10" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 max-w-md">{doc.documentName}</h3>
                  <p className="mt-1 text-sm text-gray-500 max-w-md">
                    File {doc.fileName} ({formatFileSize(doc.fileSizeBytes)})
                  </p>
                  <p className="mt-2 text-xs text-slate-600 max-w-md bg-blue-50/70 border border-blue-200 rounded-lg p-3">
                    Định dạng tài liệu Word / Office. Hãy bấm nút bên dưới để tải về và chỉnh sửa trực tiếp trên Microsoft Word / WPS Office.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button type="button" onClick={handleDownload} disabled={downloading}>
                      <Download className="mr-1.5 h-4 w-4" />
                      {downloading ? 'Đang tải...' : 'Tải file Word về máy'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={handleOpenInNewTab}>
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      Mở liên kết file
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
