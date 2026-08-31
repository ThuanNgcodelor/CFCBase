import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bot, ExternalLink, Key, Loader2, Save, Sparkles, X, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { HrDrawer } from './HrUi';
import { hrOcrApi } from '../../api/hrOcrApi';
import { apiErrorMessage } from '../../utils/hr';

export default function HrOcrSettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState({
    provider: 'GEMINI',
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    groqApiKey: '',
    groqModel: 'llama-3.2-11b-vision-preview',
    hasGeminiKey: false,
    hasGroqKey: false,
  });
  const [form, setForm] = useState({ ...settings });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await hrOcrApi.getSettings();
      setSettings(data);
      setForm(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Không thể tải cấu hình OCR.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await hrOcrApi.updateSettings(form);
      setSettings(updated);
      setForm(updated);
      toast.success('Đã lưu cấu hình AI OCR thành công!');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Không thể lưu cài đặt.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <HrDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Cài đặt AI (OCR Trích xuất hồ sơ)"
      description="Cấu hình trực tiếp API Key của Google Gemini và Groq Cloud để bóc tách CCCD và hồ sơ viết tay."
      size="standard"
    >
      <form onSubmit={handleSave} className="flex min-h-full flex-col">
        <div className="flex-1 space-y-6 px-5 py-6 sm:px-7">
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-950">
            <div className="flex gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="font-semibold">Cài đặt trực tiếp tại đây - Không cần sửa file code / yml</p>
                <p className="mt-1 leading-5 text-xs text-blue-800">
                  Cả <strong>Google Gemini</strong> và <strong>Groq</strong> đều cung cấp gói miễn phí (Free Tier 100% vĩnh viễn). Bạn chỉ cần lấy API Key dán vào đây và bấm <strong>Lưu cài đặt</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div>
            <label className="text-sm font-semibold text-gray-900">Nhà cung cấp AI mặc định</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, provider: 'GEMINI' }))}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  form.provider === 'GEMINI'
                    ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-1.5 font-bold text-blue-900 text-sm">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Google Gemini
                </span>
                <span className="mt-1 text-xs text-gray-500">Free 1.500 lượt/ngày. Đọc chữ viết tay tiếng Việt xuất sắc nhất.</span>
              </button>

              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, provider: 'GROQ' }))}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  form.provider === 'GROQ'
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
                  <Zap className="h-4 w-4 text-amber-600" />
                  Groq Cloud
                </span>
                <span className="mt-1 text-xs text-gray-500">Free Tier. Tốc độ cực nhanh (&lt;1s). Dùng Llama 3.2 Vision.</span>
              </button>
            </div>
          </div>

          {/* Gemini Settings Box */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-blue-600" />
                Google Gemini API
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
                API Key {settings.hasGeminiKey && <span className="text-emerald-600 font-semibold">(Đã có key)</span>}
              </label>
              <input
                type="password"
                value={form.geminiApiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                placeholder={settings.hasGeminiKey ? '•••••••••••••••••••• (Nhập key mới nếu muốn đổi)' : 'Dán API Key bắt đầu bằng AIzaSy...'}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Model Vision</label>
              <select
                value={form.geminiModel}
                onChange={(e) => setForm((prev) => ({ ...prev, geminiModel: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="gemini-1.5-flash">gemini-1.5-flash (Khuyên dùng - Nhanh & Chuẩn)</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash (Thế hệ mới nhất)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Độ chính xác cao)</option>
              </select>
            </div>
          </div>

          {/* Groq Settings Box */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-amber-600" />
                Groq Cloud API
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
                API Key {settings.hasGroqKey && <span className="text-emerald-600 font-semibold">(Đã có key)</span>}
              </label>
              <input
                type="password"
                value={form.groqApiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, groqApiKey: e.target.value }))}
                placeholder={settings.hasGroqKey ? '•••••••••••••••••••• (Nhập key mới nếu muốn đổi)' : 'Dán API Key bắt đầu bằng gsk_...'}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Model Vision</label>
              <select
                value={form.groqModel}
                onChange={(e) => setForm((prev) => ({ ...prev, groqModel: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              >
                <option value="llama-3.2-11b-vision-preview">llama-3.2-11b-vision-preview (Mặc định)</option>
                <option value="llama-3.2-90b-vision-preview">llama-3.2-90b-vision-preview (Bản lớn)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex shrink-0 gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:justify-end sm:px-7">
          <Button type="button" variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </Button>
        </div>
      </form>
    </HrDrawer>
  );
}
