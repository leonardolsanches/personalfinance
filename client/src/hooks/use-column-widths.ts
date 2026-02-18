import { useState, useCallback, useRef } from "react";

export function useColumnWidths<T extends Record<string, number>>(
  storageKey: string,
  defaults: T
): {
  colWidths: T;
  setColWidths: React.Dispatch<React.SetStateAction<T>>;
  handleResizeStart: (col: string, e: React.MouseEvent) => void;
} {
  const [colWidths, setColWidths] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`colWidths_${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed } as T;
      }
    } catch {}
    return defaults;
  });

  const resizingCol = useRef<{ col: string; startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[col as keyof T] || 80;
    resizingCol.current = { col, startX, startW: startW as number };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = ev.clientX - resizingCol.current.startX;
      const newW = Math.max(30, resizingCol.current.startW + delta);
      setColWidths(prev => {
        const updated = { ...prev, [resizingCol.current!.col]: newW };
        try { localStorage.setItem(`colWidths_${storageKey}`, JSON.stringify(updated)); } catch {}
        return updated;
      });
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [colWidths, storageKey]);

  return { colWidths, setColWidths, handleResizeStart };
}
