import { GripVertical } from "lucide-react";

export function ResizeHandle({ col, onResizeStart }: { col: string; onResizeStart: (col: string, e: React.MouseEvent) => void }) {
  return (
    <span
      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
      onMouseDown={(e) => onResizeStart(col, e)}
      data-testid={`resize-${col}`}
    >
      <GripVertical className="w-2.5 h-2.5 text-muted-foreground/50" />
    </span>
  );
}
