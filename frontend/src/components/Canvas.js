import React, { useRef, useEffect, useState } from "react";
import { socket } from "../socket";

export default function Canvas({ roomId, drawerId }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const historyRef = useRef([]); // full drawing + fill history

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("black"); // active drawing color
  const [selectedColor, setSelectedColor] = useState("black"); // UI highlight
  const [size, setSize] = useState(4);
  const [selectedTool, setSelectedTool] = useState("brush"); // brush | eraser | bucket

  // ============================================================
  // INITIALIZE CANVAS + SOCKET EVENTS
  // ============================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;

    // ------------------------------
    // SOCKET EVENT HANDLERS
    // ------------------------------
    function handleClearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      historyRef.current = [];
    }

    function handleDraw({ x, y, drawing, color, size }) {
      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = size;

      if (!drawing) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        historyRef.current.push({ type: "stroke", color, size, points: [{ x, y }] });
      } else {
        ctx.lineTo(x, y);
        ctx.stroke();

        const current = historyRef.current[historyRef.current.length - 1];
        if (current?.type === "stroke") current.points.push({ x, y });
      }
    }

    function handleUpdateHistory({ history }) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;

      historyRef.current = history;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      history.forEach((item) => {
        if (item.type === "stroke") {
          ctx.strokeStyle = item.color;
          ctx.lineWidth = item.size;
          ctx.beginPath();
          const [first, ...rest] = item.points;
          ctx.moveTo(first.x, first.y);
          rest.forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        } else if (item.type === "fillArea") {
          floodFill(canvas, ctx, item.x, item.y, item.color, false);
        }
      });
    }

    function handleBucketFill({ x, y, color }) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      floodFill(canvas, ctx, x, y, color, false);

      historyRef.current.push({ type: "fillArea", color, x, y });
    }

    // REGISTER SOCKET LISTENERS
    socket.on("clearCanvas", handleClearCanvas);
    socket.on("draw", handleDraw);
    socket.on("updateHistory", handleUpdateHistory);
    socket.on("bucketFill", handleBucketFill);

    return () => {
      socket.off("clearCanvas", handleClearCanvas);
      socket.off("draw", handleDraw);
      socket.off("updateHistory", handleUpdateHistory);
      socket.off("bucketFill", handleBucketFill);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // UPDATE LIVE DRAWING PROPERTIES
  // ============================================================
  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = size;
    }
  }, [color, size]);

  // ============================================================
  // DRAWING
  // ============================================================
  const getScaledCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    if (
      socket.id !== drawerId ||
      (selectedTool !== "brush" && selectedTool !== "eraser")
    )
      return;

    const { x, y } = getScaledCoords(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
    setIsDrawing(true);

    historyRef.current.push({
      type: "stroke",
      color,
      size,
      points: [{ x, y }],
    });

    socket.emit("draw", { roomId, x, y, drawing: false, color, size });
  };

  const draw = (e) => {
    if (
      !isDrawing ||
      socket.id !== drawerId ||
      (selectedTool !== "brush" && selectedTool !== "eraser")
    )
      return;

    const { x, y } = getScaledCoords(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();

    historyRef.current[historyRef.current.length - 1]?.points.push({ x, y });

    socket.emit("draw", { roomId, x, y, drawing: true, color, size });
  };

  const endDrawing = () => {
    setIsDrawing(false);
    ctxRef.current.closePath();
  };

  // ============================================================
  // UNDO
  // ============================================================
  const handleUndo = () => {
    if (socket.id !== drawerId) return;
    if (historyRef.current.length === 0) return;

    historyRef.current.pop();

    socket.emit("undo", {
      roomId,
      history: historyRef.current,
    });
  };

  // ============================================================
  // BUCKET FILL
  // ============================================================
  const handleBucketFill = (e) => {
    if (socket.id !== drawerId) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const rect = canvas.getBoundingClientRect();

    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));

    floodFill(canvas, ctx, x, y, selectedColor, true);

    historyRef.current.push({ type: "fillArea", color: selectedColor, x, y });

    socket.emit("bucketFill", { roomId, x, y, color: selectedColor });
  };

  // ============================================================
  // FLOOD FILL ALGO
  // ============================================================
  function floodFill(canvas, ctx, startX, startY, fillColor, writeHistory) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const width = canvas.width;
    const height = canvas.height;

    const startIndex = (startY * width + startX) * 4;
    const targetColor = [
      data[startIndex],
      data[startIndex + 1],
      data[startIndex + 2],
      data[startIndex + 3],
    ];

    const fillRGBA = cssColorToRGBA(fillColor);

    if (
      fillRGBA[0] === targetColor[0] &&
      fillRGBA[1] === targetColor[1] &&
      fillRGBA[2] === targetColor[2]
    )
      return;

    const queue = [{ x: startX, y: startY }];
    const visited = new Set();

    const inside = (x, y) => x >= 0 && x < width && y >= 0 && y < height;

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const index = (y * width + x) * 4;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (
        data[index] === targetColor[0] &&
        data[index + 1] === targetColor[1] &&
        data[index + 2] === targetColor[2]
      ) {
        data[index] = fillRGBA[0];
        data[index + 1] = fillRGBA[1];
        data[index + 2] = fillRGBA[2];
        data[index + 3] = 255;

        if (inside(x + 1, y)) queue.push({ x: x + 1, y });
        if (inside(x - 1, y)) queue.push({ x: x - 1, y });
        if (inside(x, y + 1)) queue.push({ x, y: y + 1 });
        if (inside(x, y - 1)) queue.push({ x, y: y - 1 });
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function cssColorToRGBA(color) {
    const fake = document.createElement("canvas").getContext("2d");

    // write any CSS color
    fake.fillStyle = color;

    // normalized string always becomes #rrggbb or rgba(...)
    const computed = fake.fillStyle;

    // HEX (#rrggbb)
    if (computed.startsWith("#")) {
      const r = parseInt(computed.slice(1, 3), 16);
      const g = parseInt(computed.slice(3, 5), 16);
      const b = parseInt(computed.slice(5, 7), 16);
      return [r, g, b, 255];
    }

    // RGB or RGBA → extract numbers
    const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/);

    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] !== undefined ? Math.round(parseFloat(match[4]) * 255) : 255;
      return [r, g, b, a];
    }

    // fallback (should never happen)
    return [0, 0, 0, 255];
  }


  // ============================================================
  // UI
  // ============================================================
  return (
    <div style={{ width: "100%" }}>
      <canvas
        ref={canvasRef}
        width={1200}
        height={650}
        onMouseDown={(e) =>
          selectedTool === "bucket" ? handleBucketFill(e) : startDrawing(e)
        }
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        style={{
          background: "#FFFFFF",
          border: "2px solid #2e1f10",
          display: "block",
          margin: "0 auto",
          borderRadius: "6px",
          maxWidth: "100%",
        }}
      />

      <div className="canvas-tools">
        {/* COLORS */}
        {[
          "black",
          "grey",
          "darkred",
          "red",
          "saddlebrown",
          "orange",
          "yellow",
          "green",
          "lightblue",
          "blue",
          "darkblue",
          "purple",
          "violet",
          "pink",
        ].map((c) => (
          <button
            key={c}
            className="color-dot"
            style={{
              background: c,
              outline: selectedColor === c ? "3px solid #e6d7b8" : "none",
              transform: selectedColor === c ? "scale(1.2)" : "scale(1)",
            }}
            onClick={() => {
              setSelectedColor(c);
              setSelectedTool("brush");
              setColor(c);
              setSize(4);
            }}
          />
        ))}

        {/* ERASER */}
        <button
          className="dl-btn"
          style={{
            background: selectedTool === "eraser" ? "#e6d7b8" : "",
            border: selectedTool === "eraser" ? "2px solid #2e1f10" : "",
          }}
          onClick={() => {
            setSelectedTool("eraser");
            setColor("#FFFFFF");
            setSize(25);
          }}
        >
          Eraser
        </button>

        {/* BUCKET */}
        <button
          className="dl-btn"
          style={{
            background: selectedTool === "bucket" ? "#e6d7b8" : "",
            border: selectedTool === "bucket" ? "2px solid #2e1f10" : "",
          }}
          onClick={() => {
            setSelectedTool("bucket");
            setColor(selectedColor);
            setSize(-1);
          }}
        >
          Bucket
        </button>

        {/* UNDO */}
        <button className="dl-btn" onClick={handleUndo}>
          Undo
        </button>
      </div>
    </div>
  );
}
