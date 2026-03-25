'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import type { MouseEvent, TouchEvent } from 'react';

const COLORS = [
    '#000000',
    '#ffffff',
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
];

const BRUSH_SIZES = [2, 5, 10, 18, 28];

type Pos = { x: number; y: number };
type DrawEvent = MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>;

export default function Playground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPos = useRef<Pos | null>(null);
    const initializedRef = useRef(false);

    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

    const initCanvas = useCallback((preserveContent = false) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const { width, height } = container.getBoundingClientRect();
        if (width === 0 || height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const physW = Math.floor(width * dpr);
        const physH = Math.floor(height * dpr);

        let snapshot: HTMLCanvasElement | null = null;
        if (preserveContent && canvas.width > 0 && canvas.height > 0) {
            snapshot = document.createElement('canvas');
            snapshot.width = canvas.width;
            snapshot.height = canvas.height;
            snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
        }

        canvas.width = physW;
        canvas.height = physH;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        if (snapshot) ctx.drawImage(snapshot, 0, 0, width, height);
    }, []);

    useEffect(() => {
        if (!initializedRef.current) {
            initializedRef.current = true;
            initCanvas(false);
        }
    }, [initCanvas]);

    useEffect(() => {
        const ro = new ResizeObserver(() => initCanvas(true));
        const el = containerRef.current;
        if (el) ro.observe(el);
        return () => ro.disconnect();
    }, [initCanvas]);

    // ─── Coordinate helper ────────────────────────────────────────────────────
    const getPos = useCallback((e: DrawEvent): Pos => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();

        if ('touches' in e) {
            const touch = e.touches[0];
            return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    // ─── Drawing handlers ─────────────────────────────────────────────────────
    const startDrawing = useCallback(
        (e: DrawEvent) => {
            e.preventDefault();
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

            const pos = getPos(e);
            setIsDrawing(true);
            lastPos.current = pos;

            ctx.beginPath();
            ctx.arc(
                pos.x,
                pos.y,
                (tool === 'eraser' ? brushSize * 2 : brushSize) / 2,
                0,
                Math.PI * 2,
            );
            ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
            ctx.fill();
        },
        [color, brushSize, tool, getPos],
    );

    const draw = useCallback(
        (e: DrawEvent) => {
            e.preventDefault();
            if (!isDrawing || !lastPos.current) return;

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (!canvas || !ctx) return;

            const pos = getPos(e);

            ctx.beginPath();
            ctx.moveTo(lastPos.current.x, lastPos.current.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
            ctx.lineWidth = tool === 'eraser' ? brushSize * 2.5 : brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            lastPos.current = pos;
        },
        [isDrawing, color, brushSize, tool, getPos],
    );

    const stopDrawing = useCallback(() => {
        setIsDrawing(false);
        lastPos.current = null;
    }, []);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const { width, height } = canvas.getBoundingClientRect();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="h-screen w-screen flex justify-center items-center bg-zinc-100 p-4 box-border">
            <div className="w-full max-w-6xl h-full max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200">
                {/* Toolbar */}
                <div
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-50 border-b border-zinc-200 flex-wrap"
                    style={{ flexShrink: 0 }}
                >
                    {/* Tool toggle */}
                    <div className="flex items-center gap-1 bg-zinc-200 rounded-lg p-1">
                        {(['pen', 'eraser'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTool(t)}
                                title={t}
                                className={`w-8 h-8 rounded-md flex items-center justify-center transition-all text-sm
                  ${tool === t ? 'bg-white shadow text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
                            >
                                {t === 'pen' ? '✏️' : '🧹'}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-5 bg-zinc-300" />

                    {/* Colors */}
                    <div className="flex items-center gap-1 flex-wrap">
                        {COLORS.map((c) => {
                            const active = color === c && tool === 'pen';
                            return (
                                <button
                                    key={c}
                                    onClick={() => {
                                        setColor(c);
                                        setTool('pen');
                                    }}
                                    className="rounded-full transition-transform hover:scale-110 flex-shrink-0"
                                    style={{
                                        width: active ? 24 : 18,
                                        height: active ? 24 : 18,
                                        background: c,
                                        border: active
                                            ? '3px solid #3b82f6'
                                            : c === '#ffffff'
                                              ? '2px solid #d1d5db'
                                              : '2px solid transparent',
                                        boxShadow: active ? '0 0 0 1px #bfdbfe' : 'none',
                                        transition: 'all 0.15s',
                                    }}
                                    title={c}
                                />
                            );
                        })}
                    </div>

                    <div className="w-px h-5 bg-zinc-300" />

                    {/* Brush sizes */}
                    <div className="flex items-center gap-1">
                        {BRUSH_SIZES.map((s) => (
                            <button
                                key={s}
                                onClick={() => setBrushSize(s)}
                                className="flex items-center justify-center rounded-full transition-all hover:bg-zinc-200 flex-shrink-0"
                                style={{
                                    width: 28,
                                    height: 28,
                                    outline: brushSize === s ? '2px solid #3b82f6' : 'none',
                                    outlineOffset: 1,
                                    background: brushSize === s ? '#eff6ff' : 'transparent',
                                }}
                                title={`${s}px`}
                            >
                                <span
                                    className="rounded-full bg-zinc-700 block"
                                    style={{
                                        width: Math.min(s * 1.4, 20),
                                        height: Math.min(s * 1.4, 20),
                                    }}
                                />
                            </button>
                        ))}
                    </div>

                    <div className="flex-1" />

                    <button
                        onClick={clearCanvas}
                        className="px-2.5 py-1 text-xs font-medium text-zinc-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all border border-zinc-200 hover:border-red-200 flex-shrink-0"
                    >
                        Clear
                    </button>
                </div>

                {/* Canvas */}
                <div ref={containerRef} className="flex-1 relative overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'block',
                            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
                            touchAction: 'none',
                        }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                </div>
            </div>
        </div>
    );
}
