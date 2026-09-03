import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Camera,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Key,
  Loader2,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { HrDrawer } from './HrUi';
import { hrOcrApi } from '../../api/hrOcrApi';
import { apiErrorMessage } from '../../utils/hr';

export default function HrOcrModal({ isOpen, onClose, onApply }) {
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'settings'
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [settings, setSettings] = useState({
    provider: 'GEMINI',
    geminiApiKey: '',
    geminiModel: 'gemini-3.6-flash',
    groqApiKey: '',
    groqModel: 'qwen/qwen3.6-27b',
    hasGeminiKey: false,
    hasGroqKey: false,
  });
  const [settingsForm, setSettingsForm] = useState({ ...settings });
  const [savingSettings, setSavingSettings] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const data = await hrOcrApi.getSettings();
      setSettings(data);
      setSettingsForm(data);
    } catch {
      // Ignored
    }
  };

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    addFiles(selectedFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const compressImage = async (file) => {
    if (!file.type.startsWith('image/') || file.size < 1024 * 1024) return file;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 2048;
          let w = img.width;
          let h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) {
              h = Math.round((h * MAX) / w);
              w = MAX;
            } else {
              w = Math.round((w * MAX) / h);
              h = MAX;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' }));
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const addFiles = async (newFiles) => {
    const validFiles = newFiles.filter((file) => file.type.startsWith('image/') || file.type === 'application/pdf');
    if (!validFiles.length) {
      toast.error('Vui lòng chọn file ảnh (JPG, PNG, WebP) hoặc PDF.');
      return;
    }

    const processedFiles = await Promise.all(validFiles.map(compressImage));

    setFiles((prev) => [...prev, ...processedFiles]);

    const newPreviews = processedFiles.map((file) => ({
      name: file.name,
      size: (file.size / 1024).toFixed(0) + ' KB',
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      type: file.type,
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index) => {
    const fileToRemove = previews[index];
    if (fileToRemove?.url) {
      URL.revokeObjectURL(fileToRemove.url);
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      addFiles(Array.from(event.dataTransfer.files));
    }
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    try {
      const updated = await hrOcrApi.updateSettings(settingsForm);
      setSettings(updated);
      setSettingsForm(updated);
      toast.success('Đã lưu cấu hình AI OCR thành công!');
      setActiveTab('scan');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Không thể lưu cấu hình.'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleQuickSwitchProvider = async (provider) => {
    try {
      const nextSettings = { ...settings, provider };
      const updated = await hrOcrApi.updateSettings(nextSettings);
      setSettings(updated);
      setSettingsForm(updated);
      toast.success(`Đã chuyển sang dùng ${provider === 'GEMINI' ? 'Google Gemini' : 'Groq Cloud'}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Không thể chuyển đổi nhà cung cấp.'));
    }
  };

  const handleStartScan = async () => {
    if (!files.length) {
      toast.error('Vui lòng tải lên ít nhất 1 ảnh hồ sơ (CCCD hoặc tờ khai).');
      return;
    }

    const isGemini = settings.provider === 'GEMINI';
    const hasKey = isGemini ? settings.hasGeminiKey : settings.hasGroqKey;
    if (!hasKey) {
      toast.error(`Chưa cấu hình API Key cho ${isGemini ? 'Google Gemini' : 'Groq'}. Vui lòng nhập API Key.`);
      setActiveTab('settings');
      return;
    }

    setScanning(true);
    setExtractedData(null);
    try {
      const result = await hrOcrApi.extractProfile(files);
      setExtractedData(result);
      toast.success(`AI đã trích xuất xong bằng ${result.providerUsed || 'AI Vision'}!`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Không thể trích xuất thông tin ảnh.'));
    } finally {
      setScanning(false);
    }
  };

  const handleApplyToForm = () => {
    if (!extractedData) return;
    if (onApply) {
      onApply(extractedData);
    }
    toast.success('Đã tự động điền toàn bộ dữ liệu vào biểu mẫu!');
    handleClose();
  };

  const handleClose = () => {
    previews.forEach((p) => {
      if (p.url) URL.revokeObjectURL(p.url);
    });
    setFiles([]);
    setPreviews([]);
    setExtractedData(null);
    setActiveTab('scan');
    onClose();
  };

  return (
    <HrDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Trích xuất hồ sơ bằng AI (OCR)"
      description="Quét tự động CCCD (mặt trước / mặt sau), sơ yếu lý lịch và đơn xin việc viết tay."
      size="wide"
    >
      <div className="flex min-h-full flex-col">
        {/* Top Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-slate-50/70 px-5 py-3 sm:px-7">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Đang dùng:</span>
            <button
              type="button"
              onClick={() => handleQuickSwitchProvider(settings.provider === 'GEMINI' ? 'GROQ' : 'GEMINI')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm transition ${
                settings.provider === 'GEMINI'
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
              title="Bấm để chuyển đổi nhanh giữa Gemini và Groq"
            >
              {settings.provider === 'GEMINI' ? <Sparkles className="h-3.5 w-3.5 text-blue-600" /> : <Zap className="h-3.5 w-3.5 text-amber-600" />}
              {settings.provider === 'GEMINI' ? `Google Gemini ${settings.geminiModel || '3.6 Flash'}` : `Groq Cloud (${settings.groqModel || 'Qwen 3.6 Vision'})`}
              <span className="ml-1 text-[10px] text-gray-500 underline">(Đổi)</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('scan')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'scan' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              📷 Quét hồ sơ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'settings' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Cài đặt API Key
            </button>
          </div>
        </div>

        {/* Tab 1: Scan Profile */}
        {activeTab === 'scan' && (
          <div className="flex-1 space-y-6 px-5 py-6 sm:px-7">
            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/30 p-6 text-center transition hover:border-emerald-500 hover:bg-emerald-50/60"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition group-hover:scale-110">
                <Upload className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                Nhấp để tải ảnh lên hoặc kéo thả ảnh vào đây
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Có thể chọn cùng lúc: <strong>Mặt trước CCCD + Mặt sau CCCD + Tờ khai viết tay</strong>
              </p>
            </div>

            {/* Selected Previews */}
            {previews.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Ảnh đã chọn ({previews.length})
                </h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {previews.map((item, index) => (
                    <div
                      key={index}
                      className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
                    >
                      {item.url ? (
                        <img
                          src={item.url}
                          alt={item.name}
                          className="h-28 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-28 w-full items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                          <FileText className="h-8 w-8" />
                        </div>
                      )}
                      <p className="mt-1.5 truncate text-xs font-medium text-gray-700">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{item.size}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white opacity-90 shadow-md transition hover:scale-110 hover:opacity-100"
                        title="Xóa ảnh này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scan Action Button */}
            <div className="flex justify-center">
              <Button
                type="button"
                size="lg"
                disabled={scanning || files.length === 0}
                onClick={handleStartScan}
                className="w-full sm:w-auto"
              >
                {scanning ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    AI đang trích xuất thông tin (khoảng 1-2 giây)...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5 text-amber-300" />
                    Bắt đầu trích xuất AI ({files.length} ảnh)
                  </>
                )}
              </Button>
            </div>

            {/* Extracted Data Result Preview */}
            {extractedData && (
              <div className="rounded-2xl border border-emerald-300 bg-white p-5 shadow-md">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-semibold text-gray-900">Kết quả trích xuất thành công</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    {extractedData.providerUsed}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-xs text-gray-400">Họ và tên</span>
                    <strong className="text-gray-900">{extractedData.fullName || '—'}</strong>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-xs text-gray-400">Ngày sinh & Giới tính</span>
                    <strong className="text-gray-900">
                      {extractedData.dateOfBirth || '—'} ({extractedData.gender === 'MALE' ? 'Nam' : extractedData.gender === 'FEMALE' ? 'Nữ' : 'Khác'})
                    </strong>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-xs text-gray-400">Số CCCD / CMND</span>
                    <strong className="text-gray-900">{extractedData.citizenIdentityNumber || extractedData.legacyIdentityNumber || '—'}</strong>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-xs text-gray-400">Ngày cấp & Nơi cấp</span>
                    <span className="font-medium text-gray-800">
                      {extractedData.issuedDate ? `${extractedData.issuedDate} · ` : ''}{extractedData.issuedPlace || '—'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-xs text-gray-400">Dân tộc & Tôn giáo</span>
                    <span className="font-medium text-gray-800">
                      {extractedData.ethnicity || '—'} / {extractedData.religion || '—'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5">
                    <span className="block text-xs text-gray-400">Số điện thoại</span>
                    <strong className="text-gray-900">{extractedData.phone || '—'}</strong>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5 sm:col-span-2">
                    <span className="block text-xs text-gray-400">Địa chỉ thường trú</span>
                    <span className="font-medium text-gray-800">{extractedData.permanentAddress || '—'}</span>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2.5 sm:col-span-2">
                    <span className="block text-xs text-gray-400">Người liên hệ khẩn cấp</span>
                    <span className="font-medium text-gray-800">
                      {extractedData.emergencyContactName ? `${extractedData.emergencyContactName} (${extractedData.emergencyContactRelation || 'Thân nhân'}) - SĐT: ${extractedData.emergencyContactPhone || '—'}` : '—'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Button type="button" size="lg" onClick={handleApplyToForm} className="w-full sm:w-auto">
                    <Check className="mr-1.5 h-5 w-5" />
                    Áp dụng toàn bộ vào Form
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Settings */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="flex-1 space-y-6 px-5 py-6 sm:px-7">
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
              <p className="font-semibold">💡 Hướng dẫn lấy API Key Miễn Phí (Free 100%):</p>
              <p className="mt-1 leading-5">
                Cả <strong>Google Gemini</strong> và <strong>Groq</strong> đều cung cấp gói miễn phí vĩnh viễn không cần thẻ Visa. Bạn chỉ cần vào trang web lấy key và dán vào bên dưới.
              </p>
            </div>

            {/* Provider Selection */}
            <div>
              <label className="text-sm font-semibold text-gray-900">Nhà cung cấp AI mặc định</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSettingsForm((prev) => ({ ...prev, provider: 'GEMINI' }))}
                  className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                    settingsForm.provider === 'GEMINI'
                      ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold text-blue-900">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Google Gemini
                  </span>
                  <span className="mt-1 text-xs text-gray-500">Free 1.500 lượt/ngày. Đọc chữ viết tay tiếng Việt xuất sắc nhất.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSettingsForm((prev) => ({ ...prev, provider: 'GROQ' }))}
                  className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                    settingsForm.provider === 'GROQ'
                      ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-200'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Zap className="h-4 w-4 text-amber-600" />
                    Groq Cloud
                  </span>
                  <span className="mt-1 text-xs text-gray-500">Nhận diện hình ảnh nhanh, hỗ trợ JSON. Dùng Qwen 3.6 Vision.</span>
                </button>
              </div>
            </div>

            {/* Gemini Settings */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Cấu hình Google Gemini
                </h4>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
                >
                  Lấy API Key Google miễn phí <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Google Gemini API Key {settings.hasGeminiKey && <span className="text-emerald-600 font-semibold">(Đã có key)</span>}
                </label>
                <input
                  type="password"
                  value={settingsForm.geminiApiKey}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                  placeholder={settings.hasGeminiKey ? '•••••••••••••••••••• (Nhập key mới nếu muốn đổi)' : 'Dán API Key bắt đầu bằng AIzaSy...'}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Model Vision</label>
                <select
                  value={settingsForm.geminiModel}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, geminiModel: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="gemini-3.6-flash">gemini-3.6-flash (Khuyên dùng - theo API hiện tại)</option>
                  <option value="gemini-3.7-flash">gemini-3.7-flash (Mới nhất)</option>
                </select>
              </div>
            </div>

            {/* Groq Settings */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  Cấu hình Groq Cloud
                </h4>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs font-semibold text-amber-700 hover:underline"
                >
                  Lấy API Key Groq miễn phí <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Groq API Key {settings.hasGroqKey && <span className="text-emerald-600 font-semibold">(Đã có key)</span>}
                </label>
                <input
                  type="password"
                  value={settingsForm.groqApiKey}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, groqApiKey: e.target.value }))}
                  placeholder={settings.hasGroqKey ? '•••••••••••••••••••• (Nhập key mới nếu muốn đổi)' : 'Dán API Key bắt đầu bằng gsk_...'}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Model Vision</label>
                <select
                  value={settingsForm.groqModel}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, groqModel: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                >
                  <option value="qwen/qwen3.6-27b">qwen/qwen3.6-27b (Khuyên dùng - Vision & OCR)</option>
                  <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Bản mới hơn)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setActiveTab('scan')}>
                Quay lại quét
              </Button>
              <Button type="submit" disabled={savingSettings}>
                <Save className="mr-1.5 h-4 w-4" />
                {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </HrDrawer>
  );
}
