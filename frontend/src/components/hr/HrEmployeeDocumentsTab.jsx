import { useEffect, useState } from 'react';
import { Download, Eye, FilePenLine, Files, FileText, FolderPlus, Inbox, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { HrError, HrLoading, HrStatusBadge } from './HrUi';
import { HrDocumentViewerModal } from './HrDocumentViewerModal';
import { HrDocumentUploadModal } from './HrDocumentUploadModal';
import { hrEmployeeDocumentApi } from '../../api/hrEmployeeDocumentApi';
import { HR_DOCUMENT_CATEGORIES, documentCategoryLabel, documentCategoryTone, formatFileSize } from '../../utils/hrDocuments';
import { apiErrorMessage, formatHrDate, formatHrDateTime } from '../../utils/hr';
import { downloadResponseBlob } from '../../utils/downloadResponseBlob';

export function HrEmployeeDocumentsTab({ employeeId, employeeName, onDocumentCountChange }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [viewerDoc, setViewerDoc] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalInitialMode, setUploadModalInitialMode] = useState('single');
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
        if (!controller.signal.aborted) {
          const list = data || [];
          setDocuments(list);
          if (selectedCategory === 'ALL' && onDocumentCountChange) {
            onDocumentCountChange(list.length);
          }
        }
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
  }, [employeeId, selectedCategory, reloadKey, onDocumentCountChange]);

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    try {
      const response = await hrEmployeeDocumentApi.downloadDocument(doc.id);
      downloadResponseBlob(response, doc.fileName || doc.documentName);
      toast.success('Đã tải file tài liệu về máy.');
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError, 'Không thể tải file tài liệu.'));
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

  const filteredDocuments = documents.filter((doc) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (doc.documentName && doc.documentName.toLowerCase().includes(q)) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(q)) ||
      (doc.documentNumber && doc.documentNumber.toLowerCase().includes(q)) ||
      (doc.issuingAuthority && doc.issuingAuthority.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Banner Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Hồ sơ & Giấy tờ đính kèm</h2>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                {documents.length} tài liệu
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {employeeName ? `Quản lý, xem và lưu trữ hồ sơ tài liệu (Word, PDF, Excel, Ảnh) cho ${employeeName}` : 'Quản lý, xem và lưu trữ hồ sơ tài liệu (Word, PDF, Excel, Ảnh) của nhân sự'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingDoc(null);
              setUploadModalInitialMode('batch');
              setUploadModalOpen(true);
            }}
          >
            <Files className="mr-1.5 h-4 w-4" /> Thêm nhiều file (Batch)
          </Button>

          <Button
            type="button"
            onClick={() => {
              setEditingDoc(null);
              setUploadModalInitialMode('single');
              setUploadModalOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Thêm 1 hồ sơ
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/60">
          {/* Category tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-slate-200/70 border border-gray-200'
              }`}
            >
              Tất cả ({documents.length})
            </button>
            {HR_DOCUMENT_CATEGORIES.map((cat) => {
              const count = documents.filter((d) => d.documentCategory === cat.value).length;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    selectedCategory === cat.value
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-slate-200/70 border border-gray-200'
                  }`}
                >
                  {cat.label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, số hiệu..."
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="p-5">
          {loading && <HrLoading label="Đang tải danh sách hồ sơ..." />}

          {error && !loading && (
            <HrError message={error} onRetry={() => setReloadKey((prev) => prev + 1)} />
          )}

          {!loading && !error && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <Inbox className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-gray-800">Chưa có hồ sơ đính kèm nào</p>
              <p className="mt-1 text-xs text-gray-500 max-w-md">
                Bạn có thể tải lên 1 hoặc nhiều tài liệu cùng lúc như CCCD, Sơ yếu lý lịch, Bằng cấp & Chứng chỉ, Giấy khám sức khỏe, HĐ scan...
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingDoc(null);
                    setUploadModalInitialMode('batch');
                    setUploadModalOpen(true);
                  }}
                >
                  <Files className="mr-1.5 h-4 w-4" /> Tải lên nhiều file
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditingDoc(null);
                    setUploadModalInitialMode('single');
                    setUploadModalOpen(true);
                  }}
                >
                  <FolderPlus className="mr-1.5 h-4 w-4" /> Thêm hồ sơ đầu tiên
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && documents.length > 0 && filteredDocuments.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">
              Không tìm thấy hồ sơ nào phù hợp với từ khóa "{searchTerm}".
            </div>
          )}

          {!loading && !error && filteredDocuments.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc) => (
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
                      {doc.issuingAuthority && (
                        <p className="truncate">Nơi cấp: <span className="text-gray-700">{doc.issuingAuthority}</span></p>
                      )}
                      {doc.issueDate && (
                        <p>Ngày cấp: <span className="text-gray-700">{formatHrDate(doc.issueDate)}</span></p>
                      )}
                      {doc.expiryDate && (
                        <p>Hạn dùng: <span className="text-gray-700">{formatHrDate(doc.expiryDate)}</span></p>
                      )}
                      <p className="truncate text-gray-400">File: {doc.fileName} ({formatFileSize(doc.fileSizeBytes)})</p>
                      <p className="text-[11px] text-gray-400">Tải lên: {formatHrDateTime(doc.createdAt)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setViewerDoc(doc)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
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
        initialMode={uploadModalInitialMode}
        onSuccess={() => setReloadKey((prev) => prev + 1)}
      />
    </div>
  );
}
