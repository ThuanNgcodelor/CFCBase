import { useEffect, useState } from 'react';
import { Download, Eye, FilePenLine, FileText, FolderPlus, Inbox, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { HrError, HrLoading, HrStatusBadge } from './HrUi';
import { HrDocumentViewerModal } from './HrDocumentViewerModal';
import { HrDocumentUploadModal } from './HrDocumentUploadModal';
import { hrEmployeeDocumentApi } from '../../api/hrEmployeeDocumentApi';
import { HR_DOCUMENT_CATEGORIES, documentCategoryLabel, documentCategoryTone, formatFileSize } from '../../utils/hrDocuments';
import { apiErrorMessage, formatHrDate, formatHrDateTime } from '../../utils/hr';
import { downloadResponseBlob } from '../../utils/downloadResponseBlob';

export function HrEmployeeDocumentsSection({ employeeId, employeeName }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [reloadKey, setReloadKey] = useState(0);

  const [viewerDoc, setViewerDoc] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!employeeId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const catParam = selectedCategory === 'ALL' ? null : selectedCategory;
    hrEmployeeDocumentApi.getDocuments(employeeId, catParam)
      .then((data) => {
        if (!controller.signal.aborted) setDocuments(data || []);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(apiErrorMessage(requestError, 'Không thể tải danh sách hồ sơ đính kèm.'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [employeeId, selectedCategory, reloadKey]);

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    try {
      const response = await hrEmployeeDocumentApi.downloadDocument(doc.id);
      downloadResponseBlob(response, doc.fileName || `${doc.documentName}.pdf`);
      toast.success('Đã tải file PDF về máy.');
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tải file PDF.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa hồ sơ "${doc.documentName}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }

    setDeletingId(doc.id);
    try {
      await hrEmployeeDocumentApi.deleteDocument(doc.id, doc.rowVersion ?? 0);
      toast.success('Đã xóa hồ sơ thành công.');
      setReloadKey((prev) => prev + 1);
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể xóa hồ sơ.'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="documents-section" className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Hồ sơ & Giấy tờ đính kèm</h2>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {documents.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {employeeName ? `Quản lý và xem trực tiếp hồ sơ PDF của ${employeeName}` : 'Xem trực tiếp file PDF không cần tải file, tải xuống và quản lý tài liệu của nhân sự'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => {
            setEditingDoc(null);
            setUploadModalOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Thêm hồ sơ
        </Button>
      </div>

      {/* Category filter pills */}
      <div className="border-b border-gray-100 bg-slate-50/70 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
              selectedCategory === 'ALL'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-slate-200/70 border border-gray-200'
            }`}
          >
            Tất cả
          </button>
          {HR_DOCUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setSelectedCategory(cat.value)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                selectedCategory === cat.value
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-slate-200/70 border border-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {loading && <HrLoading label="Đang tải danh sách hồ sơ..." />}

        {error && !loading && (
          <HrError message={error} onRetry={() => setReloadKey((prev) => prev + 1)} />
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-gray-700">Chưa có hồ sơ đính kèm nào</p>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              Bạn có thể tải lên các tài liệu như CCCD, Sơ yếu lý lịch, Bằng cấp, Giấy khám sức khỏe, HĐ scan...
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingDoc(null);
                setUploadModalOpen(true);
              }}
              className="mt-4"
            >
              <FolderPlus className="mr-1.5 h-4 w-4" /> Tải lên hồ sơ đầu tiên
            </Button>
          </div>
        )}

        {!loading && !error && documents.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                      <FileText className="h-5 w-5" />
                    </div>
                    <HrStatusBadge
                      status={documentCategoryTone(doc.documentCategory)}
                      label={documentCategoryLabel(doc.documentCategory)}
                    />
                  </div>

                  <h3
                    onClick={() => setViewerDoc(doc)}
                    className="cursor-pointer font-semibold text-gray-900 text-sm hover:text-emerald-700 transition line-clamp-2"
                    title={doc.documentName}
                  >
                    {doc.documentName}
                  </h3>

                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                    {doc.documentNumber && (
                      <p className="truncate">Số hiệu: <span className="font-medium text-gray-700">{doc.documentNumber}</span></p>
                    )}
                    {doc.issueDate && (
                      <p>Ngày cấp: <span className="text-gray-700">{formatHrDate(doc.issueDate)}</span></p>
                    )}
                    {doc.expiryDate && (
                      <p>Hạn dùng: <span className="text-gray-700">{formatHrDate(doc.expiryDate)}</span></p>
                    )}
                    <p className="truncate">File: {doc.fileName} ({formatFileSize(doc.fileSizeBytes)})</p>
                    <p className="text-[11px] text-gray-400">Tải lên: {formatHrDateTime(doc.createdAt)}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setViewerDoc(doc)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    <Eye className="h-3.5 w-3.5" /> Xem trực tiếp
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100 hover:text-gray-800 transition"
                      title="Tải file về máy"
                      aria-label="Tải về"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoc(doc);
                        setUploadModalOpen(true);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100 hover:text-gray-800 transition"
                      title="Chỉnh sửa thông tin"
                      aria-label="Chỉnh sửa"
                    >
                      <FilePenLine className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                      title="Xóa hồ sơ"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viewer Modal */}
      <HrDocumentViewerModal
        isOpen={Boolean(viewerDoc)}
        onClose={() => setViewerDoc(null)}
        document={viewerDoc}
      />

      {/* Upload / Edit Modal */}
      <HrDocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setEditingDoc(null);
        }}
        employeeId={employeeId}
        employeeName={employeeName}
        documentToEdit={editingDoc}
        onSuccess={() => setReloadKey((prev) => prev + 1)}
      />
    </section>
  );
}
