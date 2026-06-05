import React, { useEffect, useState, useRef } from "react";
import { toastStore } from "../core/toast";

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    message: string;
    type: "success" | "error" | "info" | "warning";
    exiting: boolean;
  }>>([]);
  const timeoutRefs = useRef<Map<string, { exit: number; remove: number }>>(new Map());

  useEffect(() => {
    const sub = toastStore.subscribe((toast) => {
      const toastWithId = {
        id: toast.id,
        message: toast.message,
        type: (toast.type ?? "info") as "success" | "error" | "info" | "warning",
        exiting: false,
      };
      setToasts(prev => [...prev, toastWithId]);

      const exitTimeout = window.setTimeout(() => {
        setToasts(prev => {
          const index = prev.findIndex(t => t.id === toastWithId.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = { ...updated[index], exiting: true };
            return updated;
          }
          return prev;
        });
        const removeTimeout = window.setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== toastWithId.id));
          timeoutRefs.current.delete(toastWithId.id);
        }, 300);
        timeoutRefs.current.set(toastWithId.id, { exit: exitTimeout, remove: removeTimeout });
      }, 3000);

      // cleanup on unsubscribe
      return () => {
        window.clearTimeout(exitTimeout);
      };
    });

    return () => {
      sub();
      timeoutRefs.current.forEach(({ exit, remove }) => {
        window.clearTimeout(exit);
        window.clearTimeout(remove);
      });
      timeoutRefs.current.clear();
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            toast-item
            toast-item-${t.type}
            ${t.exiting ? "toast-item-exit" : ""}
          `}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
};
