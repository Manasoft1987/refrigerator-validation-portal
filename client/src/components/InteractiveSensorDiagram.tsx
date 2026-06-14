import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface Position {
  x: number;
  y: number;
}

interface InteractiveSensorDiagramProps {
  sensors: Array<{ id: string; x: number; y: number; label: string }>;
  coolingUnitPos?: Position;
  doorPos?: Position;
  onCoolingUnitPosChange?: (pos: Position) => void;
  onDoorPosChange?: (pos: Position) => void;
  readonly?: boolean;
}

const DIAGRAM_WIDTH = 600;
const DIAGRAM_HEIGHT = 400;
const GRID_SIZE = 20;

export function InteractiveSensorDiagram({
  sensors,
  coolingUnitPos = { x: 50, y: 50 },
  doorPos = { x: 550, y: 200 },
  onCoolingUnitPosChange,
  onDoorPosChange,
  readonly = false,
}: InteractiveSensorDiagramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggingElement, setDraggingElement] = useState<
    "coolingUnit" | "door" | null
  >(null);
  const [localCoolingUnitPos, setLocalCoolingUnitPos] =
    useState<Position>(coolingUnitPos ?? { x: 50, y: 50 });
  const [localDoorPos, setLocalDoorPos] = useState<Position>(doorPos ?? { x: 550, y: 200 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (coolingUnitPos) setLocalCoolingUnitPos(coolingUnitPos);
  }, [coolingUnitPos]);

  useEffect(() => {
    if (doorPos) setLocalDoorPos(doorPos);
  }, [doorPos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, DIAGRAM_WIDTH, DIAGRAM_HEIGHT);

    // Draw grid
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= DIAGRAM_WIDTH; i += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, DIAGRAM_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i <= DIAGRAM_HEIGHT; i += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(DIAGRAM_WIDTH, i);
      ctx.stroke();
    }

    // Draw border
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, DIAGRAM_WIDTH, DIAGRAM_HEIGHT);

    // Draw cooling unit (rectangle)
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(localCoolingUnitPos.x - 20, localCoolingUnitPos.y - 20, 40, 40);
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2;
    ctx.strokeRect(localCoolingUnitPos.x - 20, localCoolingUnitPos.y - 20, 40, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Агрегат", localCoolingUnitPos.x, localCoolingUnitPos.y);

    // Draw door (line)
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(localDoorPos.x, localDoorPos.y - 30);
    ctx.lineTo(localDoorPos.x, localDoorPos.y + 30);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Дверь", localDoorPos.x, localDoorPos.y + 35);

    // Draw sensors (circles)
    sensors.forEach((sensor) => {
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(sensor.x, sensor.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = "#1e293b";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(sensor.label, sensor.x, sensor.y + 10);
    });
  }, [sensors, localCoolingUnitPos, localDoorPos]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readonly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on cooling unit
    if (
      Math.abs(x - localCoolingUnitPos.x) < 25 &&
      Math.abs(y - localCoolingUnitPos.y) < 25
    ) {
      setDraggingElement("coolingUnit");
      setOffset({
        x: x - localCoolingUnitPos.x,
        y: y - localCoolingUnitPos.y,
      });
    }
    // Check if clicking on door
    else if (
      Math.abs(x - localDoorPos.x) < 15 &&
      Math.abs(y - localDoorPos.y) < 35
    ) {
      setDraggingElement("door");
      setOffset({
        x: x - localDoorPos.x,
        y: y - localDoorPos.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingElement || readonly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - offset.x, DIAGRAM_WIDTH));
    const y = Math.max(0, Math.min(e.clientY - rect.top - offset.y, DIAGRAM_HEIGHT));

    if (draggingElement === "coolingUnit") {
      setLocalCoolingUnitPos({ x, y });
    } else if (draggingElement === "door") {
      setLocalDoorPos({ x, y });
    }
  };

  const handleMouseUp = () => {
    if (draggingElement === "coolingUnit" && onCoolingUnitPosChange) {
      onCoolingUnitPosChange(localCoolingUnitPos);
    } else if (draggingElement === "door" && onDoorPosChange) {
      onDoorPosChange(localDoorPos);
    }
    setDraggingElement(null);
  };

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Расстановка датчиков</h3>
          {!readonly && (
            <p className="text-xs text-muted-foreground">
              Перетягивайте агрегат (синий) и дверь (красная)
            </p>
          )}
        </div>
        <div className="flex justify-center border rounded-lg bg-slate-50">
          <canvas
            ref={canvasRef}
            width={DIAGRAM_WIDTH}
            height={DIAGRAM_HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={readonly ? "cursor-default" : "cursor-move"}
            style={{ display: "block" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded" />
            <span>Агрегат ({localCoolingUnitPos.x}, {localCoolingUnitPos.y})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-red-500" />
            <span>Дверь ({localDoorPos.x}, {localDoorPos.y})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>Датчики ({sensors.length})</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
