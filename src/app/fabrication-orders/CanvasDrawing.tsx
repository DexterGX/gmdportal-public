"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Minus, Pencil, RotateCcw, Square, Type } from "lucide-react";

export type CanvasShape =
  | { type: "path"; points: { x: number; y: number }[]; color: string }
  | { type: "rect"; x: number; y: number; w: number; h: number; color: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; color: string }
  | { type: "text"; x: number; y: number; text: string; color: string };

const COLORS = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#ca8a04"];
const CANVAS_WIDTH = 760;
const CANVAS_HEIGHT = 440;

interface Props {
  value: CanvasShape[];
  onChange: (shapes: CanvasShape[]) => void;
  readOnly?: boolean;
}

export default function CanvasDrawing({ value, onChange, readOnly }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<"pen" | "rect" | "line" | "text">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const drawingRef = useRef<{
    active: boolean;
    start: { x: number; y: number } | null;
    current: CanvasShape | null;
  }>({ active: false, start: null, current: null });

  function draw(shapes: CanvasShape[], preview?: CanvasShape | null) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const all = preview ? [...shapes, preview] : shapes;
    for (const shape of all) {
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineWidth = 2;
      if (shape.type === "path") {
        if (shape.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (const pt of shape.points.slice(1)) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else if (shape.type === "rect") {
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (shape.type === "line") {
        ctx.beginPath();
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
      } else if (shape.type === "text") {
        ctx.font = "14px sans-serif";
        ctx.fillText(shape.text, shape.x, shape.y);
      }
    }
  }

  useEffect(() => {
    draw(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly) return;
    const pos = getPos(e);
    if (tool === "text") {
      const text = window.prompt("Label text:");
      if (text && text.trim()) {
        onChange([...value, { type: "text", x: pos.x, y: pos.y, text: text.trim(), color }]);
      }
      return;
    }
    drawingRef.current = { active: true, start: pos, current: null };
    if (tool === "pen") {
      drawingRef.current.current = { type: "path", points: [pos], color };
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly || !drawingRef.current.active) return;
    const pos = getPos(e);
    if (tool === "pen" && drawingRef.current.current?.type === "path") {
      drawingRef.current.current.points.push(pos);
      draw(value, drawingRef.current.current);
    } else if (tool === "rect" && drawingRef.current.start) {
      const start = drawingRef.current.start;
      const preview: CanvasShape = {
        type: "rect",
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        w: Math.abs(pos.x - start.x),
        h: Math.abs(pos.y - start.y),
        color,
      };
      drawingRef.current.current = preview;
      draw(value, preview);
    } else if (tool === "line" && drawingRef.current.start) {
      const start = drawingRef.current.start;
      const preview: CanvasShape = {
        type: "line",
        x1: start.x,
        y1: start.y,
        x2: pos.x,
        y2: pos.y,
        color,
      };
      drawingRef.current.current = preview;
      draw(value, preview);
    }
  }

  function handlePointerUp() {
    if (readOnly || !drawingRef.current.active) return;
    drawingRef.current.active = false;
    const shape = drawingRef.current.current;
    drawingRef.current.current = null;
    drawingRef.current.start = null;
    if (!shape) return;
    if (shape.type === "path" && shape.points.length < 2) return;
    if (shape.type === "rect" && (shape.w < 2 || shape.h < 2)) return;
    onChange([...value, shape]);
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setTool("pen")}
            className={`rounded p-1.5 ${tool === "pen" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200 dark:text-gray-300"}`}
            title="Pen"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("rect")}
            className={`rounded p-1.5 ${tool === "rect" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200 dark:text-gray-300"}`}
            title="Rectangle"
          >
            <Square className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("line")}
            className={`rounded p-1.5 ${tool === "line" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200 dark:text-gray-300"}`}
            title="Line / Edge marker"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTool("text")}
            className={`rounded p-1.5 ${tool === "text" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200 dark:text-gray-300"}`}
            title="Text label"
          >
            <Type className="h-4 w-4" />
          </button>
          <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-5 w-5 rounded-full border-2 ${color === c ? "border-gray-900 dark:border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <div className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => onChange(value.slice(0, -1))}
            className="rounded p-1.5 text-gray-600 hover:bg-gray-200 dark:text-gray-300"
            title="Undo last shape"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded p-1.5 text-gray-600 hover:bg-gray-200 dark:text-gray-300"
            title="Clear"
          >
            <Eraser className="h-4 w-4" />
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full max-w-full touch-none rounded-md border border-gray-300 bg-white dark:border-gray-600"
      />
    </div>
  );
}
