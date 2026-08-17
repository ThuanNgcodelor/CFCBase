import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FilePlus2, Files, FileText, Trash2, UploadCloud, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { HR_DOCUMENT_CATEGORIES, formatFileSize } from '../../utils/hrDocuments';
import { apiErrorMessage } from '../../utils/hr';
import { hrEmployeeDocumentApi } from '../../api/hrEmployeeDocumentApi';

const INPUT_CLASS = 'h-10 w-full rounded-lg border border-gray-300 px-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm';
const SELECT_CLASS = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm';

export function HrDocumentUploadModal({
  isOpen,
  onClose,
  employeeId,
  employeeName = '',
  documentToEdit = null,
  initialMode = 'single', // 'single' | 'batch'
  onSuccess,
}) {
  const fileInputRef = useRef(null);
  const batchFileInputRef = useRef(null);
  const isEditMode = Boolean(documentToEdit);

  const [mode, setMode] = useState(initialMode); // 'single' | 'batch'
  const [file, setFile] = useState(null);
  const [batchFiles, setBatchFiles] = useState([]); // [{ file, documentName, documentCategory }]
  const [defaultBatchCategory, setDefaultBatchCategory] = useState('DEGREE_CERTIFICATE');
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    documentCategory: 'CITIZEN_ID',
    documentName: '',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    issuingAuthority: '',
    note: '',
  });

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setBatchFiles([]);
      setSaving(false);
      setDragOver(false);
      return;
    }

    setMode(initialMode);

    if (documentToEdit) {
      setForm({
        documentCategory: documentToEdit.documentCategory || 'CITIZEN_ID',
        documentName: documentToEdit.documentName || '',
        documentNumber: documentToEdit.documentNumber || '',
        issueDate: documentToEdit.issueDate || '',
        expiryDate: documentToEdit.expiryDate || '',
        issuingAuthority: documentToEdit.issuingAuthority || '',
        note: documentToEdit.note || '',
      });
    } else {
      setForm({
        documentCategory: 'CITIZEN_ID',
        documentName: '',
        documentNumber: '',
        issueDate: '',
        expiryDate: '',
        issuingAuthority: '',
        note: '',
      });
    }
  }, [isOpen, documentToEdit, initialMode]);

  if (!isOpen) return null;

  const handleSingleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      toast.error('Chỉ chấp nhận file định dạng PDF.');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('Dung lượng file vượt quá giới hạn 15MB.');
      return;
    }

    setFile(selectedFile);
    if (!form.documentName.trim()) {
      const cleanName = selectedFile.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();
      setForm((prev) => ({ ...prev, documentName: cleanName }));
    }
  };

  const handleBatchFilesSelect = (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const newItems = [];
    for (let i = 0; i < fileList.length; i++) {
      const current = fileList[i];
      if (!current.name.toLowerCase().endsWith('.pdf') && current.type !== 'application/pdf') {
        toast.error(`File "${current.name}" không phải PDF nên đã bị bỏ qua.`);
        continue;
      }
      if (current.size > 15 * 1024 * 1024) {
        toast.error(`File "${current.name}" vượt quá 15MB nên đã bị bỏ qua.`);
        continue;
      }

      const cleanName = current.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ').trim();
      newItems.push({
        file: current,
        documentName: cleanName || 'Tài liệu',
        documentCategory: defaultBatchCategory,
      });
    }

    if (newItems.length > 0) {
      setBatchFiles((prev) => {
        const combined = [...prev, ...newItems];
        if (combined.length > 20) {
          toast.error('Mỗi lần tải lên tối đa 20 file. Hệ thống giữ 20 file đầu tiên.');
          return combined.slice(0, 20);
        }
        return combined;
      });
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      if (mode === 'batch') {
        handleBatchFilesSelect(event.dataTransfer.files);
      } else {
        handleSingleFileSelect(event.dataTransfer.files[0]);
      }
    }
  };

  const handleApplyDefaultCategory = (cat) => {
    setDefaultBatchCategory(cat);
    setBatchFiles((prev) => prev.map((item) => ({ ...item, documentCategory: cat })));
  };

  const handleRemoveBatchFile = (index) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateBatchFileName = (index, name) => {
    setBatchFiles((prev) => prev.map((item, i) => i === index ? { ...item, documentName: name } : item));
  };

  const handleUpdateBatchFileCategory = (index, cat) => {
    setBatchFiles((prev) => prev.map((item, i) => i === index ? { ...item, documentCategory: cat } : item));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isEditMode) {
      if (!form.documentName.trim()) {
        toast.error('Vui lòng nhập tên hồ sơ.');
        return;
      }
      if (form.issueDate && form.expiryDate && form.expiryDate < form.issueDate) {
        toast.error('Ngày hết hạn không được trước ngày cấp.');
        return;
      }

      setSaving(true);
      try {
        await hrEmployeeDocumentApi.updateDocument(documentToEdit.id, {
          documentCategory: form.documentCategory,
          documentName: form.documentName.trim(),
          documentNumber: form.documentNumber.trim() || null,
          issueDate: form.issueDate || null,
          expiryDate: form.expiryDate || null,
          issuingAuthority: form.issuingAuthority.trim() || null,
          note: form.note.trim() || null,
          rowVersion: documentToEdit.rowVersion ?? 0,
        });
        toast.success('Đã cập nhật thông tin hồ sơ.');
        onSuccess?.();
        onClose();
      } catch (requestError) {
        toast.error(apiErrorMessage(requestError, 'Không thể cập nhật hồ sơ.'));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === 'single') {
      if (!form.documentName.trim()) {
        toast.error('Vui lòng nhập tên hồ sơ.');
        return;
      }
      if (!file) {
        toast.error('Vui lòng chọn file PDF đính kèm.');
        return;
      }
      if (form.issueDate && form.expiryDate && form.expiryDate < form.issueDate) {
        toast.error('Ngày hết hạn không được trước ngày cấp.');
        return;
      }

      setSaving(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentCategory', form.documentCategory);
        formData.append('documentName', form.documentName.trim());
        if (form.documentNumber.trim()) formData.append('documentNumber', form.documentNumber.trim());
        if (form.issueDate) formData.append('issueDate', form.issueDate);
        if (form.expiryDate) formData.append('expiryDate', form.expiryDate);
        if (form.issuingAuthority.trim()) formData.append('issuingAuthority', form.issuingAuthority.trim());
        if (form.note.trim()) formData.append('note', form.note.trim());

        await hrEmployeeDocumentApi.uploadDocument(employeeId, formData);
        toast.success('Đã tải lên hồ sơ nhân sự thành công.');
        onSuccess?.();
        onClose();
      } catch (requestError) {
        toast.error(apiErrorMessage(requestError, 'Không thể tải lên hồ sơ.'));
      } finally {
        setSaving(false);
      }
    } else {
      // Batch mode
      if (batchFiles.length === 0) {
        toast.error('Vui lòng chọn ít nhất 1 file PDF để tải lên.');
        return;
      }

      setSaving(true);
      try {
        // Upload each file with its custom documentName and category
        let successCount = 0;
        for (const item of batchFiles) {
          const formData = new FormData();
          formData.append('file', item.file);
          formData.append('documentCategory', item.documentCategory);
          formData.append('documentName', item.documentName.trim() || item.file.name);

          await hrEmployeeDocumentApi.uploadDocument(employeeId, formData);
          successCount++;
        }

        toast.success(`Đã tải lên thành công ${successCount} hồ sơ.`);
        onSuccess?.();
        onClose();
      } catch (requestError) {
        toast.error(apiErrorMessage(requestError, 'Có lỗi xảy ra khi tải lên danh sách hồ sơ.'));
      } finally {
        setSaving(false);
      }
    }
  };

  const totalBatchSize = batchFiles.reduce((acc, cur) => acc + (cur.file?.size || 0), 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4" role="presentation">
      <div
        className="fixed inset-0 bg-[var(--cfc-navy)]/50 backdrop-blur-[2px]"
        onClick={saving ? undefined : onClose}
      />

      <section
        aria-labelledby="upload-modal-title"
        aria-modal="true"
        className={`relative z-50 flex max-h-[92dvh] w-full ${mode === 'batch' && !isEditMode ? 'max-w-3xl' : 'max-w-2xl'} flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden transition-all`}
        role="dialog"
      >
        {/* Header */}
        <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-gray-100 px-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              {mode === 'batch' ? <Files className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="upload-modal-title" className="text-lg font-semibold text-gray-900">
                {isEditMode
                  ? 'Chỉnh sửa thông tin hồ sơ'
                  : (mode === 'batch'
                    ? (employeeName ? `Tải lên nhiều hồ sơ cho ${employeeName}` : 'Tải lên nhiều hồ sơ cùng lúc')
                    : (employeeName ? `Thêm hồ sơ cho ${employeeName}` : 'Thêm hồ sơ / giấy tờ đính kèm'))}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-slate-100 hover:text-gray-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Mode switcher tabs (only in create mode) */}
        {!isEditMode && (
          <div className="flex border-b border-gray-200 bg-slate-50/80 px-5 sm:px-6 pt-2">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                mode === 'single'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FilePlus2 className="h-4 w-4" /> Tải lên 1 hồ sơ (Chi tiết)
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                mode === 'batch'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Files className="h-4 w-4" /> Tải lên nhiều hồ sơ cùng lúc (Batch)
              {batchFiles.length > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {batchFiles.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="cfc-scrollbar overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* SINGLE MODE */}
          {(isEditMode || mode === 'single') && (
            <>
              {!isEditMode && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1.5">
                    File tài liệu PDF <span className="text-rose-500">*</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleSingleFileSelect(e.target.files[0])}
                  />

                  {!file ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                        dragOver
                          ? 'border-emerald-500 bg-emerald-50/60'
                          : 'border-gray-300 hover:border-emerald-400 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-2">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-medium text-gray-800">
                        Nhấn để chọn file hoặc kéo thả file PDF vào đây
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Định dạng hỗ trợ: PDF (dung lượng tối đa 15MB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        Chọn file khác
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                    Phân loại hồ sơ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.documentCategory}
                    onChange={(e) => setForm((prev) => ({ ...prev, documentCategory: e.target.value }))}
                    className={SELECT_CLASS}
                  >
                    {HR_DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                    Tên hồ sơ / văn bản <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.documentName}
                    onChange={(e) => setForm((prev) => ({ ...prev, documentName: e.target.value }))}
                    placeholder="Ví dụ: Bằng Cử nhân Kinh tế"
                    className={INPUT_CLASS}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                    Số hiệu văn bản
                  </label>
                  <input
                    type="text"
                    value={form.documentNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, documentNumber: e.target.value }))}
                    placeholder="Ví dụ: 034098001234 hoặc QD-2024/01"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                    Cơ quan / Nơi cấp
                  </label>
                  <input
                    type="text"
                    value={form.issuingAuthority}
                    onChange={(e) => setForm((prev) => ({ ...prev, issuingAuthority: e.target.value }))}
                    placeholder="Ví dụ: Cục CSQLHC về TTXH"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                    Ngày cấp / Ban hành
                  </label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                    Ngày hết hạn
                  </label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                  Ghi chú bổ sung
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Nhập ghi chú thêm cho hồ sơ này (nếu có)..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:text-sm"
                />
              </div>
            </>
          )}

          {/* BATCH MODE */}
          {!isEditMode && mode === 'batch' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={batchFileInputRef}
                multiple
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => e.target.files && handleBatchFilesSelect(e.target.files)}
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => batchFileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${
                  dragOver
                    ? 'border-emerald-500 bg-emerald-50/60'
                    : 'border-gray-300 hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-2">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-gray-800">
                  Nhấn để chọn nhiều file hoặc kéo thả nhiều file PDF vào đây
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Hỗ trợ tải lên tối đa 20 file PDF cùng một lúc (tối đa 15MB/file)
                </p>
              </div>

              {batchFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 border border-gray-200">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Đã chọn <strong>{batchFiles.length} file</strong> ({formatFileSize(totalBatchSize)})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Áp dụng phân loại chung:</span>
                      <select
                        value={defaultBatchCategory}
                        onChange={(e) => handleApplyDefaultCategory(e.target.value)}
                        className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-800 outline-none focus:border-emerald-500"
                      >
                        {HR_DOCUMENT_CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 cfc-scrollbar">
                    {batchFiles.map((item, index) => (
                      <div
                        key={`${item.file.name}-${index}`}
                        className="flex flex-wrap items-center gap-2.5 rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm sm:flex-nowrap"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                          <FileText className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={item.documentName}
                            onChange={(e) => handleUpdateBatchFileName(index, e.target.value)}
                            placeholder="Tên hồ sơ..."
                            className="h-8 w-full rounded border border-gray-200 px-2 text-xs font-medium text-gray-800 outline-none focus:border-emerald-500"
                          />
                          <p className="truncate text-[11px] text-gray-400 mt-0.5">
                            {item.file.name} ({formatFileSize(item.file.size)})
                          </p>
                        </div>

                        <select
                          value={item.documentCategory}
                          onChange={(e) => handleUpdateBatchFileCategory(index, e.target.value)}
                          className="h-8 shrink-0 rounded border border-gray-200 bg-slate-50 px-2 text-xs text-gray-700 outline-none focus:border-emerald-500"
                        >
                          {HR_DOCUMENT_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveBatchFile(index)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition"
                          aria-label="Xóa khỏi danh sách"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? 'Đang lưu...'
                : (isEditMode
                  ? 'Lưu thay đổi'
                  : (mode === 'batch'
                    ? `Tải lên tất cả (${batchFiles.length} file)`
                    : 'Tải lên hồ sơ'))}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
