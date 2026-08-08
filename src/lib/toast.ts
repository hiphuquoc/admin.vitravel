import hotToast from 'react-hot-toast';

/** API thông báo dùng chung — brand toast qua AppToaster */
export const notify = {
  success: (message: string) => hotToast.success(message),
  error: (message: string) => hotToast.error(message),
  info: (message: string) => hotToast(message, { icon: undefined }),
  loading: (message: string) => hotToast.loading(message),
  dismiss: (id?: string) => hotToast.dismiss(id),
  /** Shortcut lưu form — cùng success, message rõ ràng */
  saved: (message = 'Đã lưu thay đổi') => hotToast.success(message),
};

export const toast = hotToast;
export default hotToast;
