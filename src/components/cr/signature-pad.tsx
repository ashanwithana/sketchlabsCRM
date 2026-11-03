"use client";

import * as React from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Draw-to-sign canvas. Works with mouse, pen, and touch. Each stroke ends by exporting a PNG
 * data URL through onChange, so the parent form always holds the latest signature.
 */
export function SignaturePad({
  value,
  onChange,
  label,
  id,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label: string;
  id: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = React.useState(!value);

  // Size the canvas to its box and scale for high-density screens.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    // Only the initial value is drawn here. Later changes come from the user's strokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const next = point(e);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    last.current = next;
    setEmpty(false);
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    onChange(e.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={empty}>
          <Eraser /> Clear
        </Button>
      </div>
      <canvas
        id={id}
        ref={canvasRef}
        role="img"
        aria-label={`${label}. Draw with the mouse, pen, or finger.`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="block h-40 w-full touch-none cursor-crosshair rounded-xl border-2 border-dashed border-border-strong bg-surface"
      />
      <p className="text-xs text-muted">{empty ? "Sign inside the box." : "Signature captured."}</p>
    </div>
  );
}
