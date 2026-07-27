import React from 'react';

export function AppFooter() {
  return (
    <footer className="mt-auto hidden shrink-0 items-center justify-between gap-5 border-t border-[var(--cfc-border)] bg-white px-6 py-4 md:flex xl:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <img src="/logo2.png" alt="CFC" className="h-9 w-12 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-[var(--cfc-ink)]">CÔNG TY CỔ PHẦN PHÂN BÓN & HÓA CHẤT CẦN THƠ</p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--cfc-muted)]">© CFC · Hệ thống vận hành nội bộ</p>
        </div>
      </div>
      <div className="hidden text-right text-[10px] leading-4 text-[var(--cfc-muted)] xl:block">
        <p>Trục Chính KCN Trà Nóc 1, P. Thới An Đông, TP. Cần Thơ</p>
        <p>1900 5307 · info@cfccobay.com</p>
      </div>
    </footer>
  );
}
