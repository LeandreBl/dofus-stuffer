import { useCallback, useEffect, useState } from "react";

/** Short status message that hides itself after a few seconds. */
export function useToast() {
  const [toast, setToast] = useState("");
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return [toast, notify] as const;
}
