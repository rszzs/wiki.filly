import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let display = error.message;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        display = parsed.error.includes('Quota exceeded')
          ? 'تم تجاوز حصة القراءة أو الكتابة اليومية المجانية لقاعدة البيانات؛ يُرجى المحاولة لاحقاً.'
          : `تعذر إتمام العملية (${parsed.operationType ?? 'database'}): ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, errorMessage: display };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 text-[#202122]"
        >
          <div className="max-w-md w-full bg-white border border-[#a2a9b1] rounded-xs p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-[#d33]">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h1 className="wiki-title text-xl font-bold">
                حدث خطأ غير متوقع في الاتصال بالبيانات
              </h1>
            </div>
            <p className="text-xs text-[#54595d] leading-relaxed">
              {this.state.errorMessage || 'يرجى إعادة تحميل الصفحة للمحاولة مجدداً.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#3366cc] hover:bg-[#2a4b8d] text-white text-xs font-bold rounded inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة تحميل الصفحة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
