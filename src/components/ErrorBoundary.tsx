import React from 'react';
import { RotateCcw, Home, AlertTriangle } from 'lucide-react';
import { BuddyAvatar } from './BuddyAvatar';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra lỗi hiển thị không mong muốn.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Buddy ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  handleResetStorageAndReload = () => {
    try {
      window.localStorage.removeItem('buddy_ai_personal_buddy_state_v1');
    } catch {
      // ignore storage errors
    }
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F9FD] text-[#23324D] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-[24px] bg-white border border-[#23324D]/10 p-6 md:p-8 text-center shadow-sm space-y-5">
            <div className="flex justify-center">
              <BuddyAvatar size="lg" mood="thinking" />
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#FFF0C9] text-amber-800 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Chế độ bảo vệ màn hình an toàn</span>
            </div>

            <h1 className="font-kids text-2xl font-extrabold text-[#23324D]">
              Ôi, Buddy cần khởi động lại một chút!
            </h1>

            <p className="text-sm text-[#23324D]/75 leading-relaxed">
              Ứng dụng vừa gặp một trục trặc nhỏ khi hiển thị. Con hoặc ba mẹ hãy bấm nút bên dưới để quay về màn hình chính ngay nhé.
            </p>

            {this.state.errorMessage && (
              <p className="text-xs text-[#23324D]/55 bg-[#F7F9FD] rounded-xl p-3 font-mono break-words">
                Chi tiết: {this.state.errorMessage}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-[16px] bg-[#3978F6] hover:bg-[#2964DF] text-white font-kids font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Tải lại màn hình chính</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetStorageAndReload}
                className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 rounded-[16px] bg-[#EAF3FF] hover:bg-[#d8e9ff] text-[#23324D] font-kids font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#3978F6]" />
                <span>Khôi phục dữ liệu mẫu</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
