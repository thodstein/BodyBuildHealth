// Simple toast store using callbacks
export type Toast = {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
};

class ToastStore {
  private callbacks: ((toast: Toast) => void)[] = [];
  private id = 0;

  subscribe(cb: (toast: Toast) => void) {
    this.callbacks.push(cb);
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb);
    };
  }

  publish(toast: Omit<Toast, 'id'>) {
    const id = String(++this.id);
    const toastWithId: Toast = { id, ...toast };
    this.callbacks.forEach(cb => cb(toastWithId));
  }

  success(message: string) {
    this.publish({ message, type: 'success' });
  }

  error(message: string) {
    this.publish({ message, type: 'error' });
  }

  info(message: string) {
    this.publish({ message, type: 'info' });
  }

  warning(message: string) {
    this.publish({ message, type: 'warning' });
  }
}

export const toastStore = new ToastStore();
