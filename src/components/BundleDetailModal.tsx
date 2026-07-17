import React, { useState, useEffect, useRef } from 'react';
import { Bundle } from '../types';
import { 
  Building2, 
  Layers, 
  Scale, 
  Calendar, 
  MapPin, 
  Tv, 
  Cpu, 
  Compass, 
  RotateCw, 
  Play, 
  Pause, 
  Info,
  Package,
  CheckCircle2,
  Bookmark,
  TrendingUp
} from 'lucide-react';

interface BundleDetailModalProps {
  bundle: Bundle | null;
  onClose: () => void;
}

// Technical standards mapping based on ASTM A615 (Black) and ASTM A775 (Epoxy)
interface BarSizeSpecs {
  diameterIn: number;
  diameterMm: number;
  areaIn2: number;
  areaMm2: number;
  weightLbFt: number;
  weightKgM: number;
}

const BAR_SIZE_STANDARDS: Record<string, BarSizeSpecs> = {
  '#3': { diameterIn: 0.375, diameterMm: 9.525, areaIn2: 0.11, areaMm2: 71, weightLbFt: 0.376, weightKgM: 0.560 },
  '#4': { diameterIn: 0.500, diameterMm: 12.7, areaIn2: 0.20, areaMm2: 129, weightLbFt: 0.668, weightKgM: 0.994 },
  '#5': { diameterIn: 0.625, diameterMm: 15.875, areaIn2: 0.31, areaMm2: 200, weightLbFt: 1.043, weightKgM: 1.552 },
  '#6': { diameterIn: 0.750, diameterMm: 19.05, areaIn2: 0.44, areaMm2: 284, weightLbFt: 1.502, weightKgM: 2.235 },
  '#7': { diameterIn: 0.875, diameterMm: 22.225, areaIn2: 0.60, areaMm2: 387, weightLbFt: 2.044, weightKgM: 3.042 },
  '#8': { diameterIn: 1.000, diameterMm: 25.4, areaIn2: 0.79, areaMm2: 510, weightLbFt: 2.670, weightKgM: 3.973 },
  '#9': { diameterIn: 1.128, diameterMm: 28.65, areaIn2: 1.00, areaMm2: 645, weightLbFt: 3.400, weightKgM: 5.060 },
  '#10': { diameterIn: 1.270, diameterMm: 32.258, areaIn2: 1.27, areaMm2: 819, weightLbFt: 4.303, weightKgM: 6.404 },
  '#11': { diameterIn: 1.410, diameterMm: 35.814, areaIn2: 1.56, areaMm2: 1006, weightLbFt: 5.313, weightKgM: 7.907 }
};

// 3D Point representations
type Point3D = [number, number, number];

export default function BundleDetailModal({ bundle, onClose }: BundleDetailModalProps) {
  if (!bundle) return null;

  const rotXRef = useRef<number>(0.4); // rotation in radians
  const rotYRef = useRef<number>(-0.6);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(75);
  const [activePreset, setActivePreset] = useState<string>('ISO');
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDragging = useRef<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const requestRef = useRef<number | null>(null);

  const isBending = bundle.status === 'BENDING';

  // Get technical specifications for the selected bar size
  const specs = BAR_SIZE_STANDARDS[bundle.barSize] || {
    diameterIn: 0.500,
    diameterMm: 12.7,
    areaIn2: 0.20,
    areaMm2: 129,
    weightLbFt: 0.668,
    weightKgM: 0.994
  };

  // Convert weight to kilograms (1 lb = 0.45359237 kg)
  const weightKg = Math.round(bundle.weight * 0.45359237 * 10) / 10;
  
  // Calculate quantity count based on standard weight-per-foot
  const rebarUnitWeightLbs = specs.weightLbFt * bundle.length;
  const calculatedCount = rebarUnitWeightLbs > 0 ? Math.round(bundle.weight / rebarUnitWeightLbs) : 0;

  // Set angle presets
  const handleApplyPreset = (preset: string) => {
    setActivePreset(preset);
    if (preset === 'ISO') {
      rotXRef.current = 0.4;
      rotYRef.current = -0.6;
    } else if (preset === 'FRONT') {
      rotXRef.current = 0;
      rotYRef.current = 0;
    } else if (preset === 'TOP') {
      rotXRef.current = Math.PI / 2;
      rotYRef.current = 0;
    } else if (preset === 'SIDE') {
      rotXRef.current = 0;
      rotYRef.current = Math.PI / 2;
    }

    // Sync to elements directly
    const xElem = document.getElementById('modal-rot-x');
    if (xElem) xElem.innerText = `${(rotXRef.current % (2 * Math.PI)).toFixed(2)} rad`;
    const yElem = document.getElementById('modal-rot-y');
    if (yElem) yElem.innerText = `${(rotYRef.current % (2 * Math.PI)).toFixed(2)} rad`;
  };

  // Define 3D bend geometry lines based on bundle's ID or description
  const getBendGeometry = (): { name: string; points: Point3D[]; angleLabels: { pos: Point3D; text: string }[] } => {
    // Generate distinct shapes based on bundle tagId
    const sumIdChars = bundle.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const shapeId = sumIdChars % 5;

    if (shapeId === 0) {
      // 1. Stirrup / closed rectangular box tie
      return {
        name: 'Stirrup Closed Tie',
        points: [
          [-0.6, -0.6, 0],
          [0.6, -0.6, 0],
          [0.6, 0.6, 0],
          [-0.6, 0.6, 0],
          [-0.6, -0.4, 0],
          [-0.3, -0.4, 0.2],
          [-0.4, -0.6, 0.3],
        ],
        angleLabels: [
          { pos: [0.6, -0.6, 0], text: '90°' },
          { pos: [0.6, 0.6, 0], text: '90°' },
          { pos: [-0.6, 0.6, 0], text: '90°' },
          { pos: [-0.6, -0.4, 0], text: '135° Hook' }
        ]
      };
    } else if (shapeId === 1) {
      // 2. Standard L-Bend
      return {
        name: 'Standard L-Hook',
        points: [
          [-1.2, 0.5, 0],
          [0.3, 0.5, 0],
          [0.3, -0.9, 0]
        ],
        angleLabels: [
          { pos: [0.3, 0.5, 0], text: '90° Standard' }
        ]
      };
    } else if (shapeId === 2) {
      // 3. U-shape / Hairpin slab tie
      return {
        name: 'Slab Hairpin (U-Bend)',
        points: [
          [-1.1, -0.6, 0],
          [0.5, -0.6, 0],
          [0.5, 0.6, 0],
          [-1.1, 0.6, 0]
        ],
        angleLabels: [
          { pos: [0.5, -0.6, 0], text: '90° Corner' },
          { pos: [0.5, 0.6, 0], text: '90° Corner' }
        ]
      };
    } else if (shapeId === 3) {
      // 4. Double-crank pile bracket (3D Offset bend!)
      return {
        name: '3D Offset Pile Bracket',
        points: [
          [-1.2, -0.3, -0.3],
          [-0.4, -0.3, -0.3],
          [-0.4, 0.3, -0.3],
          [0.4, 0.3, -0.3],
          [0.4, 0.3, 0.3],
          [1.2, 0.3, 0.3]
        ],
        angleLabels: [
          { pos: [-0.4, -0.3, -0.3], text: '90° offset' },
          { pos: [0.4, 0.3, -0.3], text: '90° plane shift' }
        ]
      };
    } else {
      // 5. Pier Cage Spiral / Curved Ring Hook
      const ringPoints: Point3D[] = [];
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * 1.5 * Math.PI; // 270 degrees hook
        const rx = 0.6 * Math.cos(theta);
        const ry = 0.6 * Math.sin(theta);
        const rz = (i / steps) * 0.3 - 0.15; // slide slightly along Z
        ringPoints.push([rx, rz, ry]);
      }
      return {
        name: 'Pier Cage Spiral Hook',
        points: ringPoints,
        angleLabels: [
          { pos: [0.6, 0, 0], text: 'R=15" Radius' },
          { pos: [0, 0.15, -0.6], text: '270° Hook Offset' }
        ]
      };
    }
  };

  const bend = React.useMemo(() => getBendGeometry(), [bundle.id]);

  // Mouse drag handlers on SVG/Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    setAutoRotate(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    rotYRef.current += dx * 0.01;
    rotXRef.current += dy * 0.01;

    // Sync to elements directly
    const xElem = document.getElementById('modal-rot-x');
    if (xElem) xElem.innerText = `${(rotXRef.current % (2 * Math.PI)).toFixed(2)} rad`;
    const yElem = document.getElementById('modal-rot-y');
    if (yElem) yElem.innerText = `${(rotYRef.current % (2 * Math.PI)).toFixed(2)} rad`;

    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Canvas drawing effect loop
  useEffect(() => {
    let animId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear with smooth alpha background
      ctx.fillStyle = '#060B15';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw standard coordinate axes grid floor
      const gridCells = 6;
      const gridSize = 0.4;
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;

      const rx = rotXRef.current;
      const ry = rotYRef.current;

      // Projection calculations helper
      const project = (x: number, y: number, z: number): [number, number] => {
        // Rotate around X axis
        const cosX = Math.cos(rx);
        const sinX = Math.sin(rx);
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;

        // Rotate around Y axis
        const cosY = Math.cos(ry);
        const sinY = Math.sin(ry);
        const x2 = x * cosY + z1 * sinY;
        const z2 = -x * sinY + z1 * cosY;

        // Perspective scaling factor
        const distance = 4;
        const perspective = distance / (distance - z2 * 0.2);

        return [
          cx + x2 * zoom * perspective,
          cy + y1 * zoom * perspective
        ];
      };

      // Draw Grid Floor (along Y = 0.8)
      const floorY = 0.8;
      for (let i = -gridCells; i <= gridCells; i++) {
        // lines along Z axis
        const start1 = project(i * gridSize, floorY, -gridCells * gridSize);
        const end1 = project(i * gridSize, floorY, gridCells * gridSize);
        ctx.beginPath();
        ctx.moveTo(start1[0], start1[1]);
        ctx.lineTo(end1[0], end1[1]);
        ctx.stroke();

        // lines along X axis
        const start2 = project(-gridCells * gridSize, floorY, i * gridSize);
        const end2 = project(gridCells * gridSize, floorY, i * gridSize);
        ctx.beginPath();
        ctx.moveTo(start2[0], start2[1]);
        ctx.lineTo(end2[0], end2[1]);
        ctx.stroke();
      }

      // Draw Origin Anchor indicators
      const originProj = project(0, floorY, 0);
      ctx.fillStyle = 'rgba(71, 85, 105, 0.4)';
      ctx.beginPath();
      ctx.arc(originProj[0], originProj[1], 4, 0, 2 * Math.PI);
      ctx.fill();

      // Determine wire shape and points
      let pts = bend.points;
      if (!isBending) {
        // If not bending, draw straight, sleek, unbent structural steel rebar
        pts = [
          [-1.4, 0, 0],
          [1.4, 0, 0]
        ];
      }

      // Project path coordinates
      const projectedPts = pts.map(([x, y, z]) => project(x, y, z));

      // Draw Shadow Projection on Grid floor (downward shadow offsets)
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.7)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((pt, idx) => {
        const shadowP = project(pt[0], floorY, pt[2]);
        if (idx === 0) ctx.moveTo(shadowP[0], shadowP[1]);
        else ctx.lineTo(shadowP[0], shadowP[1]);
      });
      ctx.stroke();

      // Draw actual Rebar Steel Core Glow/Tube
      if (projectedPts.length > 1) {
        // Draw Rebar Glow Backing
        ctx.strokeStyle = bundle.isEpoxy ? 'rgba(20, 184, 166, 0.2)' : 'rgba(99, 102, 241, 0.2)';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        projectedPts.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        });
        ctx.stroke();

        // Draw the Metallic Core line
        ctx.strokeStyle = bundle.isEpoxy ? '#14b8a6' : '#6366f1'; // Epoxy Green vs Carbon Black Indigo
        ctx.lineWidth = 8;
        ctx.beginPath();
        projectedPts.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        });
        ctx.stroke();

        // Draw Ribs/Deformations texture (typical on steel rebars to anchor in concrete)
        ctx.strokeStyle = bundle.isEpoxy ? 'rgba(13, 148, 136, 0.7)' : 'rgba(79, 70, 229, 0.7)';
        ctx.lineWidth = 7;
        for (let i = 0; i < pts.length - 1; i++) {
          const ptA = pts[i];
          const ptB = pts[i + 1];
          // interpolate rebar segment to draw fine ribbing lines
          const numRibs = isBending ? 15 : 40;
          for (let k = 1; k < numRibs; k++) {
            const ratio = k / numRibs;
            const xVal = ptA[0] + (ptB[0] - ptA[0]) * ratio;
            const yVal = ptA[1] + (ptB[1] - ptA[1]) * ratio;
            const zVal = ptA[2] + (ptB[2] - ptA[2]) * ratio;
            
            // get projection point
            const ribCenter = project(xVal, yVal, zVal);
            
            // Draw rib stroke transverse to the bending direction
            ctx.beginPath();
            ctx.ellipse(ribCenter[0], ribCenter[1], 4, 2, ry + Math.PI / 4, 0, Math.PI);
            ctx.stroke();
          }
        }

        // Draw bend node highlight markers (CNC Mandrel contact points)
        if (isBending) {
          ctx.fillStyle = '#f59e0b'; // Amber nodes
          pts.forEach((pt, idx) => {
            if (idx > 0 && idx < pts.length - 1) { // actual bend joints
              const jointProj = project(pt[0], pt[1], pt[2]);
              ctx.beginPath();
              ctx.arc(jointProj[0], jointProj[1], 5, 0, 2 * Math.PI);
              ctx.fill();

              // Circle ring
              ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(jointProj[0], jointProj[1], 9, 0, 2 * Math.PI);
              ctx.stroke();
            }
          });
        }
      }

      // Draw Text Labels for Bending Angles & specifications in 3D Space
      if (isBending) {
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#fbbf24';
        bend.angleLabels.forEach((label) => {
          const screenPos = project(label.pos[0], label.pos[1] - 0.1, label.pos[2]);
          // Label container
          ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
          ctx.fillRect(screenPos[0] - 25, screenPos[1] - 16, 50, 11);
          ctx.strokeStyle = '#f59e0b';
          ctx.strokeRect(screenPos[0] - 25, screenPos[1] - 16, 50, 11);
          
          ctx.fillStyle = '#fbbf24';
          ctx.textAlign = 'center';
          ctx.fillText(label.text, screenPos[0], screenPos[1] - 7);
        });

        // Legend details in 3D Canvas
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.fillRect(10, canvas.height - 40, 120, 30);
        ctx.strokeRect(10, canvas.height - 40, 120, 30);
        
        ctx.fillStyle = '#64748b';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('CNC MODEL SHAPE:', 14, canvas.height - 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.fillText(bend.name.toUpperCase(), 14, canvas.height - 18);
      } else {
        // Straight Bar Label
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#94a3b8';
        const centerPos = project(0, -0.1, 0);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
        ctx.fillRect(centerPos[0] - 55, centerPos[1] - 14, 110, 12);
        ctx.strokeStyle = '#1e293b';
        ctx.strokeRect(centerPos[0] - 55, centerPos[1] - 14, 110, 12);
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText('STRAIGHT STOCK REBAR', centerPos[0], centerPos[1] - 5);
      }

      // Live compass indicator in the upper right
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1.5;
      const compX = canvas.width - 25;
      const compY = 25;
      ctx.beginPath();
      ctx.arc(compX, compY, 12, 0, 2 * Math.PI);
      ctx.stroke();

      // north pointer
      const nx = compX + 10 * Math.sin(ry);
      const ny = compY - 10 * Math.cos(ry) * Math.sin(rx);
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(compX, compY);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('N', compX, compY - 14);

      // Auto update rotation angles if auto-rotate is active
      if (autoRotate && !isDragging.current) {
        rotYRef.current += 0.005;
        const yElem = document.getElementById('modal-rot-y');
        if (yElem) {
          yElem.innerText = `${(rotYRef.current % (2 * Math.PI)).toFixed(2)} rad`;
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [autoRotate, zoom, bend, isBending, bundle]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="bundle-technical-modal">
      <div className="bg-[#0b101d] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col no-scrollbar">
        {/* Top Grade Bar Visual Indicator Line */}
        <div className={`h-1.5 w-full ${bundle.isEpoxy ? 'bg-teal-500' : 'bg-indigo-500'}`}></div>

        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-900 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${bundle.isEpoxy ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
              <Package className={`h-5 w-5 ${bundle.isEpoxy ? 'text-teal-400' : 'text-indigo-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-mono text-slate-500">Tag Audit Record</span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                  bundle.status === 'LOADED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                  bundle.status === 'BENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                  bundle.status === 'STAGED' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {bundle.status}
                </span>
              </div>
              <h2 className="font-sans text-base font-black text-white uppercase tracking-tight antialiased">
                {bundle.tagId} <span className="text-slate-500">•</span> {bundle.mark}
              </h2>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 border border-slate-900 p-2 rounded-lg text-xs font-mono font-bold cursor-pointer select-none transition-all"
          >
            ✕ CLOSE ESC
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          
          {/* Left Column: Visuals & Simulation (7cols) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Visualizer Frame */}
            <div className="bg-[#050912] border border-slate-900 rounded-xl overflow-hidden relative group">
              {/* Header Telemetry overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
                <Compass className="h-4 w-4 text-amber-500/70 animate-spin" style={{ animationDuration: '6s' }} />
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-extrabold bg-slate-950/80 px-2 py-1.5 rounded-md border border-slate-900">
                  {isBending ? 'Interactive CNC Bending Shape' : 'Structural Straight Form View'}
                </span>
              </div>

              {/* View Control Presets overlay */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 bg-slate-950/80 p-1 rounded-lg border border-slate-900">
                {(['ISO', 'FRONT', 'TOP', 'SIDE'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleApplyPreset(preset)}
                    className={`px-1.5 py-1 text-[8px] font-mono font-bold rounded cursor-pointer transition-colors ${
                      activePreset === preset 
                        ? 'bg-amber-500 text-slate-950' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Dynamic Coordinate readouts overlay */}
              <div className="absolute bottom-3 left-3 bg-slate-950/85 border border-slate-900 px-3 py-2 rounded-lg font-mono text-[8.5px] text-slate-400 space-y-1 z-10 max-w-[150px] pointer-events-none">
                <div className="flex justify-between gap-4">
                  <span>Rot-X:</span><span className="text-white" id="modal-rot-x">{(rotXRef.current % (2 * Math.PI)).toFixed(2)} rad</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Rot-Y:</span><span className="text-white" id="modal-rot-y">{(rotYRef.current % (2 * Math.PI)).toFixed(2)} rad</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Zoom:</span><span className="text-white">{zoom}%</span>
                </div>
              </div>

              {/* Rotate and zoom modifiers */}
              <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-900">
                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className="p-1 hover:text-white text-slate-400 rounded transition-colors cursor-pointer"
                  title={autoRotate ? "Pause Auto-Rotation" : "Play Auto-Rotation"}
                >
                  {autoRotate ? <Pause className="h-3 w-3 text-amber-400" /> : <Play className="h-3 w-3" />}
                </button>
                <div className="h-3 w-[1px] bg-slate-900"></div>
                <button
                  onClick={() => setZoom(z => Math.max(40, z - 8))}
                  className="text-[10px] px-1 hover:text-white text-slate-400 font-bold font-mono cursor-pointer"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="text-[8px] font-mono text-slate-500 font-bold">ZOOM</span>
                <button
                  onClick={() => setZoom(z => Math.min(140, z + 8))}
                  className="text-[10px] px-1 hover:text-white text-slate-400 font-bold font-mono cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              {/* The interactive Canvas node */}
              <canvas
                ref={canvasRef}
                width={520}
                height={350}
                className="w-full h-[320px] cursor-grab active:cursor-grabbing block"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>

            <div className="flex items-start gap-2.5 p-3.5 bg-slate-950 rounded-xl border border-slate-900 text-xxs leading-relaxed font-mono">
              <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-slate-400">
                <span className="text-slate-200 font-bold">Interactive Spatial Control:</span> Click and drag directly in the 3D canvas viewport above to spin, project, and audit the rebar curvature profile in standard space. Enable and pause auto-spin with the timeline controllers.
              </div>
            </div>

          </div>

          {/* Right Column: Specifications & Metadata (5cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Technical Mill Table */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-extrabold flex items-center gap-1.5 leading-none">
                <Cpu className="h-3 w-3" /> Technical Specs (ASTM Standard)
              </span>
              
              <div className="bg-slate-950 border border-slate-900 rounded-xl divide-y divide-slate-900 overflow-hidden">
                <div className="p-3 bg-slate-900/20 grid grid-cols-2 text-xxs font-mono text-slate-500 uppercase">
                  <span>Specification</span>
                  <span className="text-right">Acoustic / Physical Value</span>
                </div>

                <div className="p-3 grid grid-cols-2 text-xxs font-mono">
                  <span className="text-slate-400">ASTM Grade Spec:</span>
                  <span className="text-right font-bold text-white">
                    {bundle.isEpoxy ? 'ASTM A775 / A615M Gr.60' : 'ASTM A615 / A615M Gr.60'}
                  </span>
                </div>

                <div className="p-3 grid grid-cols-2 text-xxs font-mono">
                  <span className="text-slate-400">Rebar Nominal Size:</span>
                  <span className="text-right font-bold text-white">
                    ANSI {bundle.barSize} Rebar
                  </span>
                </div>

                <div className="p-3 grid grid-cols-2 text-xxs font-mono">
                  <span className="text-slate-400">Nominal Diameter:</span>
                  <span className="text-right font-bold text-slate-200">
                    {specs.diameterIn.toFixed(3)} in / {specs.diameterMm.toFixed(2)} mm
                  </span>
                </div>

                <div className="p-3 grid grid-cols-2 text-xxs font-mono">
                  <span className="text-slate-400">Cross-Sectional Area:</span>
                  <span className="text-right font-bold text-slate-200">
                    {specs.areaIn2.toFixed(2)} in² / {specs.areaMm2} mm²
                  </span>
                </div>

                <div className="p-3 grid grid-cols-2 text-xxs font-mono">
                  <span className="text-slate-400">Yield Strength Limit:</span>
                  <span className="text-right font-bold text-amber-500">
                    60,000 psi (Minimum 420 MPa)
                  </span>
                </div>

                <div className="p-3 grid grid-cols-2 text-xxs font-mono">
                  <span className="text-slate-400">Tensile Strength Limit:</span>
                  <span className="text-right font-bold text-slate-200">
                    90,000 psi (Minimum 620 MPa)
                  </span>
                </div>

                {bundle.isEpoxy && (
                  <div className="p-3 grid grid-cols-2 text-xxs font-mono bg-teal-950/5">
                    <span className="text-teal-400/90 font-bold">Epoxy Coating Limit:</span>
                    <span className="text-right font-bold text-teal-300">
                      7 to 12 mils (175 - 300 µm)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mass Balance & Logistics Metrics */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-extrabold flex items-center gap-1.5 leading-none">
                <Scale className="h-3 w-3" /> Mass Quantities & Counts
              </span>

              <div className="grid grid-cols-2 gap-3.5">
                
                {/* Standard Pack weight */}
                <div className="bg-slate-950 p-3.5 border border-slate-900 rounded-xl">
                  <span className="text-[7.5px] font-mono uppercase text-slate-500 font-extrabold block">Standard Pack Mass</span>
                  <span className="text-xs font-bold font-mono text-white block mt-1">
                    {bundle.weight.toLocaleString()} <span className="text-[9px] text-slate-500 font-normal">lbs</span>
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5 border-t border-slate-900 pt-1">
                    {weightKg.toLocaleString()} <span className="text-[8px] text-slate-400 uppercase font-bold">kg (Metric)</span>
                  </span>
                </div>

                {/* Length & Steel Count */}
                <div className="bg-slate-950 p-3.5 border border-slate-900 rounded-xl">
                  <span className="text-[7.5px] font-mono uppercase text-slate-500 font-extrabold block">Calculated Count</span>
                  <span className="text-xs font-bold font-mono text-white block mt-1">
                    ~ {calculatedCount} <span className="text-[9px] text-slate-500 font-normal">bars</span>
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5 border-t border-slate-900 pt-1">
                    Each bar is {bundle.length} <span className="text-[8px] font-bold">ft ({Math.round(bundle.length * 0.3048 * 10) / 10} m)</span>
                  </span>
                </div>

              </div>
            </div>

            {/* Production Route & Target information */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-extrabold flex items-center gap-1.5 leading-none">
                <MapPin className="h-3 w-3" /> Plant Logistics & Operations
              </span>

              <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-xxs space-y-3.5">
                
                <div className="space-y-1">
                  <span className="text-[8px] text-slate-500 uppercase block font-black">Production Route Chain</span>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {bundle.route.split(' -> ').map((node, idx, arr) => (
                      <React.Fragment key={idx}>
                        <span className={`px-2 py-1 rounded text-[8.5px] ${
                          bundle.location === node 
                            ? 'bg-amber-500 text-slate-950 font-black border border-amber-600' 
                            : 'bg-slate-900 text-slate-300'
                        }`}>
                          {node}
                        </span>
                        {idx < arr.length - 1 && <span className="text-slate-600 text-[10px]">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-3">
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block">Active Location</span>
                    <span className="text-xxs font-bold text-white block mt-0.5 uppercase truncate">{bundle.location}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 uppercase block">Project Ref</span>
                    <span className="text-xxs font-bold text-slate-300 block mt-0.5 uppercase truncate">{bundle.jobId}</span>
                  </div>
                </div>

                {bundle.door && (
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-3">
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase block">Shipping Bay Assignment</span>
                      <span className="text-xxs font-bold text-teal-400 block mt-0.5 uppercase">{bundle.door}</span>
                    </div>
                    {bundle.trailerSize && (
                      <div>
                        <span className="text-[8px] text-slate-500 uppercase block">Trailer Dimension</span>
                        <span className="text-xxs font-bold text-amber-500 block mt-0.5 uppercase">{bundle.trailerSize}</span>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-900 flex justify-between items-center text-xxs font-mono text-slate-600 shrink-0">
          <span>SIMCOTE MANUFACTURING SPATIAL REBAR SIMULATOR CORE</span>
          <div className="flex items-center gap-1.5 text-slate-500">
            <CheckCircle2 className="h-3 w-3 text-teal-500" /> SYSTEM STATUS NOMINAL
          </div>
        </div>

      </div>
    </div>
  );
}
