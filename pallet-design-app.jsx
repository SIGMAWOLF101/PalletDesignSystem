import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// GRUBER PALLETS — Pallet Design Software
// Incorporating Virginia Tech CPULD Research Data
// ═══════════════════════════════════════════════════════════════

// ── Virginia Tech Research Data (CPULD / PDS) ──────────────────
const VT_WOOD_SPECIES = {
  // Data based on VT CPULD research & USDA Wood Handbook
  // MOE = Modulus of Elasticity (psi), MOR = Modulus of Rupture (psi)
  // SG = Specific Gravity (oven-dry), group = PDS species group
  hardwoods: [
    { name: "Red Oak", sg: 0.63, moe: 1820000, mor: 8300, group: "H1", costPerBF: 1.85 },
    { name: "White Oak", sg: 0.68, moe: 1780000, mor: 8600, group: "H1", costPerBF: 2.10 },
    { name: "Hard Maple", sg: 0.63, moe: 1830000, mor: 8600, group: "H1", costPerBF: 2.25 },
    { name: "Yellow Birch", sg: 0.62, moe: 1740000, mor: 8300, group: "H1", costPerBF: 1.95 },
    { name: "Hickory", sg: 0.72, moe: 2160000, mor: 10800, group: "H1", costPerBF: 2.40 },
    { name: "Ash", sg: 0.60, moe: 1740000, mor: 7900, group: "H2", costPerBF: 1.90 },
    { name: "Yellow Poplar", sg: 0.42, moe: 1580000, mor: 5700, group: "H3", costPerBF: 1.20 },
    { name: "Sweetgum", sg: 0.52, moe: 1640000, mor: 6600, group: "H2", costPerBF: 1.35 },
    { name: "Mixed Hardwood", sg: 0.55, moe: 1680000, mor: 7200, group: "H2", costPerBF: 1.40 },
    { name: "Cottonwood", sg: 0.37, moe: 1370000, mor: 4600, group: "H4", costPerBF: 0.95 },
  ],
  softwoods: [
    { name: "Southern Yellow Pine", sg: 0.55, moe: 1800000, mor: 7700, group: "S1", costPerBF: 1.15 },
    { name: "Douglas Fir", sg: 0.50, moe: 1950000, mor: 7700, group: "S1", costPerBF: 1.25 },
    { name: "Spruce (SPF)", sg: 0.42, moe: 1500000, mor: 5600, group: "S2", costPerBF: 0.95 },
    { name: "Eastern White Pine", sg: 0.35, moe: 1240000, mor: 4800, group: "S3", costPerBF: 0.85 },
    { name: "Hem-Fir", sg: 0.43, moe: 1530000, mor: 5800, group: "S2", costPerBF: 1.00 },
    { name: "Ponderosa Pine", sg: 0.40, moe: 1290000, mor: 5100, group: "S3", costPerBF: 0.90 },
    { name: "Mixed Softwood", sg: 0.42, moe: 1460000, mor: 5400, group: "S2", costPerBF: 1.00 },
  ],
};

const ALL_SPECIES = [
  ...VT_WOOD_SPECIES.hardwoods.map((s) => ({ ...s, type: "Hardwood" })),
  ...VT_WOOD_SPECIES.softwoods.map((s) => ({ ...s, type: "Softwood" })),
];

// VT Research: Moisture Content Adjustment Factors
const MOISTURE_FACTORS = {
  green: { strength: 0.56, stiffness: 0.70, label: "Green (>30% MC)" },
  partially_dried: { strength: 0.75, stiffness: 0.85, label: "Partially Dried (19-30% MC)" },
  kiln_dried: { strength: 1.0, stiffness: 1.0, label: "Kiln Dried (<19% MC)" },
  oven_dry: { strength: 1.08, stiffness: 1.05, label: "Oven Dry (<12% MC)" },
};

// VT Research: Temperature adjustment (based on Wood Handbook ch.4)
const TEMP_FACTORS = {
  frozen: { factor: 1.15, label: "Frozen (<32°F / 0°C)" },
  cold: { factor: 1.08, label: "Cold Storage (32-50°F)" },
  normal: { factor: 1.0, label: "Normal (50-100°F)" },
  warm: { factor: 0.90, label: "Warm (100-130°F)" },
  hot: { factor: 0.75, label: "Hot (>130°F)" },
};

// VT Research: Fastener performance data
const FASTENER_TYPES = {
  helical_11_5: { name: "Helical 11.5ga", withdrawalIndex: 1.0, shearIndex: 1.0, durabilityMult: 1.856, costPer: 0.035 },
  helical_12_5: { name: "Helical 12.5ga", withdrawalIndex: 0.82, shearIndex: 0.78, durabilityMult: 1.0, costPer: 0.028 },
  annular_11_5: { name: "Annular 11.5ga", withdrawalIndex: 1.10, shearIndex: 0.95, durabilityMult: 1.70, costPer: 0.038 },
  plain_shank: { name: "Plain Shank", withdrawalIndex: 0.55, shearIndex: 0.85, durabilityMult: 0.65, costPer: 0.018 },
  screw: { name: "Screws", withdrawalIndex: 1.40, shearIndex: 1.15, durabilityMult: 2.10, costPer: 0.065 },
};

// VT Research: Durability cycle data (500%+ variation in handlings)
const DURABILITY_BASE_CYCLES = 58; // Base damage-free handlings (worst config)
const DURABILITY_MAX_CYCLES = 298; // Best config handlings

// Standard pallet sizes
const STANDARD_SIZES = [
  { name: "GMA (48×40)", length: 48, width: 40 },
  { name: "EUR (47.24×31.50)", length: 47.24, width: 31.5 },
  { name: "Industrial (48×48)", length: 48, width: 48 },
  { name: "Drum (48×36)", length: 48, width: 36 },
  { name: "Half (24×40)", length: 24, width: 40 },
  { name: "Custom", length: 0, width: 0 },
];

const PALLET_TYPES = [
  { name: "2-Way", desc: "Stringer, fork entry from 2 sides" },
  { name: "4-Way", desc: "Notched stringer, fork entry all sides" },
  { name: "Block", desc: "Block style, full 4-way entry" },
];

// ── Board position calculator ──────────────────────────────────
// Computes the Y-position of each board given edge gap, inner gap, board count, board width, and pallet width.
// Returns array of Y-offsets (in inches from pallet edge).

function calcBoardPositions(boardCount, boardWidth, palletWidth, edgeGap, innerGap) {
  if (boardCount <= 0) return [];
  if (boardCount === 1) return [(palletWidth - boardWidth) / 2];
  const positions = [];
  positions.push(edgeGap);
  for (let i = 1; i < boardCount; i++) {
    positions.push(edgeGap + i * (boardWidth + innerGap));
  }
  return positions;
}

function autoCalcGaps(boardCount, boardWidth, palletWidth) {
  if (boardCount <= 1) return { edgeGap: 0, innerGap: 0 };
  const totalBoardWidth = boardCount * boardWidth;
  const totalGap = palletWidth - totalBoardWidth;
  const gap = totalGap / (boardCount - 1);
  return { edgeGap: 0, innerGap: Math.max(gap, 0) };
}

function generateEvenPositions(boardCount, boardWidth, palletWidth) {
  if (boardCount <= 0) return [];
  if (boardCount === 1) return [(palletWidth - boardWidth) / 2];
  const totalBoardWidth = boardCount * boardWidth;
  const totalGap = palletWidth - totalBoardWidth;
  const innerGap = totalGap / (boardCount - 1); // flush to edges, gaps only between boards
  const positions = [];
  for (let i = 0; i < boardCount; i++) {
    positions.push(i * (boardWidth + innerGap));
  }
  return positions;
}

// ── Utility functions ──────────────────────────────────────────

function calcDeckBoardCapacity(species, thickness, width, span, mc, temp) {
  const sp = ALL_SPECIES.find((s) => s.name === species);
  if (!sp) return { maxLoad: 0, deflection: 0 };
  const mcf = MOISTURE_FACTORS[mc];
  const tf = TEMP_FACTORS[temp];
  const adjMOR = sp.mor * mcf.strength * tf.factor;
  const adjMOE = sp.moe * mcf.stiffness * tf.factor;
  const I = (width * Math.pow(thickness, 3)) / 12;
  const S = (width * Math.pow(thickness, 2)) / 6;
  const maxLoad = (8 * adjMOR * S) / span;
  const deflection = (5 * maxLoad * Math.pow(span, 3)) / (384 * adjMOE * I);
  return { maxLoad: Math.round(maxLoad), deflection: deflection.toFixed(3) };
}

function calcNailsRequired(deckWidth) {
  if (deckWidth <= 5.25) return 2;
  if (deckWidth <= 7) return 3;
  return 4;
}

function calcDurabilityScore(species, mc, fastenerType, hasLeadingEdgeReinforcement) {
  const sp = ALL_SPECIES.find((s) => s.name === species);
  if (!sp) return 0;
  const ft = FASTENER_TYPES[fastenerType];
  let score = DURABILITY_BASE_CYCLES;
  score *= ft.durabilityMult;
  const sgFactor = sp.sg / 0.42;
  score *= sgFactor;
  if (mc === "kiln_dried" || mc === "oven_dry") score *= 1.25;
  else if (mc === "green") score *= 0.70;
  if (hasLeadingEdgeReinforcement) score *= 1.30;
  return Math.min(Math.round(score), 500);
}

function calcPalletCost(design, inventory) {
  const sp = ALL_SPECIES.find((s) => s.name === design.species);
  if (!sp) return { total: 0, breakdown: {} };
  const invItem = inventory && inventory.find((i) => i.name === design.species);
  const costPerBF = (invItem && invItem.costPerBF != null) ? invItem.costPerBF : sp.costPerBF;
  const deckBF =
    ((design.deckThickness * design.deckWidth * design.palletLength) / 144) *
    (design.topDeckBoards + design.bottomDeckBoards);
  const stringerBF =
    ((design.stringerWidth * design.stringerHeight * design.palletWidth) / 144) * design.stringerCount;
  const totalBF = deckBF + stringerBF;
  const lumberCost = totalBF * costPerBF;
  const ft = FASTENER_TYPES[design.fastenerType];
  const nailsPerBoard = calcNailsRequired(design.deckWidth);
  const totalNails = nailsPerBoard * (design.topDeckBoards + design.bottomDeckBoards) * design.stringerCount;
  const fastenerCost = totalNails * ft.costPer;
  const laborCost = 1.50;
  const overhead = 0.75;
  const total = lumberCost + fastenerCost + laborCost + overhead;
  return {
    total: total.toFixed(2),
    lumberCost: lumberCost.toFixed(2),
    fastenerCost: fastenerCost.toFixed(2),
    laborCost: laborCost.toFixed(2),
    overhead: overhead.toFixed(2),
    totalBF: totalBF.toFixed(2),
    totalNails,
  };
}

// ── Styles ─────────────────────────────────────────────────────
const colors = {
  primary: "#1a3a5c",
  primaryLight: "#2a5a8c",
  accent: "#d4a843",
  accentLight: "#e8c96a",
  bg: "#f5f0e8",
  card: "#ffffff",
  text: "#1a1a1a",
  textLight: "#5a5a5a",
  border: "#d4c9b8",
  success: "#2d7d46",
  warning: "#c47f17",
  danger: "#b03a2e",
  wood: "#c4985a",
  woodDark: "#8b6f3a",
};

// ── Components ─────────────────────────────────────────────────

function Nav({ page, setPage, isCustomer }) {
  const links = isCustomer
    ? [
        { id: "quote", label: "Get Quote" },
        { id: "catalog", label: "Catalog" },
        { id: "research", label: "VT Research" },
      ]
    : [
        { id: "designer", label: "Pallet Designer" },
        { id: "cost", label: "Cost Estimator" },
        { id: "research", label: "VT Research" },
        { id: "settings", label: "Settings" },
      ];

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            background: colors.accent,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            color: colors.primary,
            fontSize: 18,
          }}
        >
          GP
        </div>
        <span style={{ color: "white", fontWeight: 700, fontSize: 18 }}>
          Gruber Pallets{" "}
          <span style={{ fontWeight: 400, fontSize: 13, opacity: 0.8 }}>| Pallet Design System</span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => setPage(l.id)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 6,
              background: page === l.id ? "rgba(255,255,255,0.2)" : "transparent",
              color: "white",
              fontWeight: page === l.id ? 700 : 400,
              cursor: "pointer",
              fontSize: 14,
              transition: "all 0.2s",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => {}}
        style={{
          padding: "6px 14px",
          background: isCustomer ? colors.accent : "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: 6,
          color: isCustomer ? colors.primary : "white",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {isCustomer ? "Customer Portal" : "Internal Mode"}
      </button>
    </div>
  );
}

function Card({ title, children, style = {} }) {
  return (
    <div
      style={{
        background: colors.card,
        borderRadius: 12,
        padding: 24,
        border: `1px solid ${colors.border}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        ...style,
      }}
    >
      {title && (
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: 16,
            fontWeight: 700,
            color: colors.primary,
            borderBottom: `2px solid ${colors.accent}`,
            paddingBottom: 8,
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function Select({ label, value, onChange, options, style = {} }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.textLight, marginBottom: 4 }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          fontSize: 14,
          background: "white",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, step = 1, unit = "", style = {} }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.textLight, marginBottom: 4 }}>
        {label} {unit && <span style={{ fontWeight: 400 }}>({unit})</span>}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        style={{
          width: "100%",
          padding: "8px 10px",
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          fontSize: 14,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
        fontSize: 14,
        cursor: "pointer",
        color: colors.text,
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function SpecInput({ value, onChange, min, max, step = 1, width = 60 }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => {
    const v = parseFloat(local);
    if (!isNaN(v) && v >= min && v <= max) {
      onChange(v);
    } else {
      setLocal(String(value));
    }
  };
  return (
    <input
      type="number"
      value={local}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
      style={{ width, padding: "3px 6px", border: `1px solid ${colors.border}`, borderRadius: 4, fontSize: 11 }}
    />
  );
}

function Badge({ color, children }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: color + "18",
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {children}
    </span>
  );
}

function Stat({ label, value, unit, color = colors.primary }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: colors.textLight, fontWeight: 600 }}>
        {label} {unit && <span>({unit})</span>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = colors.success }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ background: "#eee", borderRadius: 6, height: 10, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: pct > 80 ? colors.success : pct > 50 ? colors.warning : colors.danger,
          borderRadius: 6,
          transition: "width 0.5s",
        }}
      />
    </div>
  );
}

// ── 2D Pallet Visual Designer ──────────────────────────────────

function PalletCanvas({ design }) {
  const canvasRef = useRef(null);
  const SCALE = 6;
  const PAD = 40;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const w = design.palletWidth * SCALE + PAD * 2;
    const h = design.palletLength * SCALE + PAD * 2;
    canvasRef.current.width = w;
    canvasRef.current.height = h;

    // Background
    ctx.fillStyle = "#f9f6f0";
    ctx.fillRect(0, 0, w, h);

    // Draw stringers (vertical bars at X positions across width)
    const stringerSpacing =
      design.stringerCount > 1
        ? (design.palletWidth - design.stringerWidth * design.stringerCount) / (design.stringerCount - 1)
        : 0;
    for (let i = 0; i < design.stringerCount; i++) {
      const x = PAD + i * (design.stringerWidth + stringerSpacing) * SCALE;
      ctx.fillStyle = colors.woodDark;
      ctx.fillRect(x, PAD, design.stringerWidth * SCALE, design.palletLength * SCALE);
      ctx.strokeStyle = "#6b5030";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, PAD, design.stringerWidth * SCALE, design.palletLength * SCALE);
    }

    // Draw top deck boards (horizontal bars at Y positions along length)
    const topPositions = design.topBoardPositions !== null
      ? design.topBoardPositions
      : generateEvenPositions(design.topDeckBoards, design.deckWidth, design.palletLength);
    for (let i = 0; i < design.topDeckBoards; i++) {
      const y = PAD + (topPositions[i] || 0) * SCALE;
      ctx.fillStyle = "#d4a574";
      ctx.fillRect(PAD, y, design.palletWidth * SCALE, design.deckWidth * SCALE);
      ctx.strokeStyle = "#8a6d3b";
      ctx.lineWidth = 1;
      ctx.strokeRect(PAD, y, design.palletWidth * SCALE, design.deckWidth * SCALE);

      // Draw nail positions
      const nailsNeeded = calcNailsRequired(design.deckWidth);
      for (let s = 0; s < design.stringerCount; s++) {
        const sx = PAD + s * (design.stringerWidth + stringerSpacing) * SCALE + (design.stringerWidth * SCALE) / 2;
        for (let n = 0; n < nailsNeeded; n++) {
          const ny = y + ((n + 1) / (nailsNeeded + 1)) * design.deckWidth * SCALE;
          ctx.beginPath();
          ctx.arc(sx, ny, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#444";
          ctx.fill();
        }
      }
    }

    // Dimension labels
    ctx.fillStyle = colors.primary;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${design.palletWidth}"`, PAD + (design.palletWidth * SCALE) / 2, PAD - 12);
    ctx.save();
    ctx.translate(PAD - 16, PAD + (design.palletLength * SCALE) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${design.palletLength}"`, 0, 0);
    ctx.restore();

    // Label
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = colors.textLight;
    ctx.fillText(`Top View (${design.topDeckBoards} top deck boards)`, PAD, h - 10);
  }, [design]);

  return (
    <canvas
      ref={canvasRef}
      style={{ border: `1px solid ${colors.border}`, borderRadius: 8, background: "#f9f6f0", maxWidth: "100%" }}
    />
  );
}

// ── Interactive Top Canvas (Drag-and-Drop) ─────────────────────

function InteractiveTopCanvas({ design, onBoardPositionsChange, selectedIndices, onSelectionChange }) {
  const canvasRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, primaryIndex: -1, offset: 0, startPositions: null });
  const [isDragging, setIsDragging] = useState(false);
  const [previewPositions, setPreviewPositions] = useState(null);

  const SCALE = 6;
  const PAD = 40;

  const getPositions = () => {
    if (design.topBoardPositions !== null) {
      return design.topBoardPositions;
    }
    return generateEvenPositions(design.topDeckBoards, design.deckWidth, design.palletLength);
  };

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const w = design.palletWidth * SCALE + PAD * 2;
    const h = design.palletLength * SCALE + PAD * 2;
    canvasRef.current.width = w;
    canvasRef.current.height = h;

    ctx.fillStyle = "#f9f6f0";
    ctx.fillRect(0, 0, w, h);

    // Stringers (vertical bars at X positions across width)
    const stringerPos = design.stringerPositions !== null
      ? design.stringerPositions
      : generateEvenPositions(design.stringerCount, design.stringerWidth, design.palletWidth);
    for (let i = 0; i < design.stringerCount; i++) {
      const x = PAD + (stringerPos[i] || 0) * SCALE;
      ctx.fillStyle = colors.woodDark;
      ctx.fillRect(x, PAD, design.stringerWidth * SCALE, design.palletLength * SCALE);
      ctx.strokeStyle = "#6b5030";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, PAD, design.stringerWidth * SCALE, design.palletLength * SCALE);
    }

    // Boards (horizontal bars at Y positions along length)
    const positionsToUse = previewPositions !== null ? previewPositions : getPositions();
    const activeSet = dragStateRef.current.dragging ? new Set(selectedIndices) : selectedIndices;

    for (let i = 0; i < design.topDeckBoards; i++) {
      const y = PAD + (positionsToUse[i] || 0) * SCALE;
      const isActive = activeSet.has(i);

      if (isDragging && isActive) {
        ctx.fillStyle = "#ff9800";
        ctx.globalAlpha = 0.85;
      } else if (isActive && !isDragging) {
        ctx.fillStyle = "#3b82f6";
        ctx.globalAlpha = 0.75;
      } else if (isDragging) {
        ctx.fillStyle = "#d4a574";
        ctx.globalAlpha = 0.4;
      } else {
        ctx.fillStyle = "#d4a574";
        ctx.globalAlpha = 1;
      }

      ctx.fillRect(PAD, y, design.palletWidth * SCALE, design.deckWidth * SCALE);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isActive ? (isDragging ? "#e65100" : "#1e40af") : "#8a6d3b";
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(PAD, y, design.palletWidth * SCALE, design.deckWidth * SCALE);

      const nailsNeeded = calcNailsRequired(design.deckWidth);
      for (let s = 0; s < design.stringerCount; s++) {
        const sx = PAD + (stringerPos[s] || 0) * SCALE + (design.stringerWidth * SCALE) / 2;
        for (let n = 0; n < nailsNeeded; n++) {
          const ny = y + ((n + 1) / (nailsNeeded + 1)) * design.deckWidth * SCALE;
          ctx.beginPath();
          ctx.arc(sx, ny, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#444";
          ctx.fill();
        }
      }
    }

    ctx.fillStyle = colors.primary;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${design.palletWidth}"`, PAD + (design.palletWidth * SCALE) / 2, PAD - 12);
    ctx.save();
    ctx.translate(PAD - 16, PAD + (design.palletLength * SCALE) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${design.palletLength}"`, 0, 0);
    ctx.restore();

    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = colors.textLight;
    const selCount = selectedIndices.size;
    const hint = selCount > 0
      ? `${selCount} board${selCount > 1 ? "s" : ""} selected \u2022 Ctrl+Click to add/remove`
      : `Drag boards to reposition \u2022 Ctrl+Click to multi-select`;
    ctx.fillText(`Top View (${design.topDeckBoards} top deck boards)`, PAD, h - 26);
    ctx.fillStyle = colors.primary;
    ctx.font = "10px sans-serif";
    ctx.fillText(hint, PAD, h - 12);
  }, [design, selectedIndices, isDragging, previewPositions]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const isCtrl = e.ctrlKey || e.metaKey;

    const positions = getPositions();
    let clickedIndex = -1;

    for (let i = 0; i < design.topDeckBoards; i++) {
      const boardY = PAD + positions[i] * SCALE;
      if (
        my >= boardY &&
        my <= boardY + design.deckWidth * SCALE &&
        mx >= PAD &&
        mx <= PAD + design.palletWidth * SCALE
      ) {
        clickedIndex = i;
        break;
      }
    }

    if (clickedIndex === -1) {
      if (!isCtrl) onSelectionChange(new Set());
      return;
    }

    let newSelected;
    if (isCtrl) {
      newSelected = new Set(selectedIndices);
      if (newSelected.has(clickedIndex)) {
        newSelected.delete(clickedIndex);
      } else {
        newSelected.add(clickedIndex);
      }
    } else {
      if (selectedIndices.has(clickedIndex) && selectedIndices.size > 1) {
        newSelected = new Set(selectedIndices);
      } else {
        newSelected = new Set([clickedIndex]);
      }
    }
    onSelectionChange(newSelected);

    if (newSelected.has(clickedIndex)) {
      const boardY = PAD + positions[clickedIndex] * SCALE;
      dragStateRef.current = {
        dragging: true,
        primaryIndex: clickedIndex,
        offset: my - boardY,
        startPositions: [...positions],
      };
      setIsDragging(true);
      setPreviewPositions([...positions]);
    }
  };

  const handleMouseMove = (e) => {
    if (!dragStateRef.current.dragging) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const { primaryIndex, offset, startPositions } = dragStateRef.current;

    const newPrimaryY = (my - PAD - offset) / SCALE;
    const delta = newPrimaryY - startPositions[primaryIndex];

    const newPositions = [...startPositions];
    const minPos = 0;
    const maxPos = design.palletLength - design.deckWidth;
    const bw = design.deckWidth;

    // Clamp to pallet bounds
    let clampedDelta = delta;
    for (const idx of selectedIndices) {
      const proposed = startPositions[idx] + delta;
      if (proposed < minPos) clampedDelta = Math.max(clampedDelta, minPos - startPositions[idx]);
      if (proposed > maxPos) clampedDelta = Math.min(clampedDelta, maxPos - startPositions[idx]);
    }

    // Clamp to prevent overlap with non-selected boards
    const nonSelectedPositions = startPositions.map((p, i) => ({ pos: p, idx: i })).filter((b) => !selectedIndices.has(b.idx));
    const selectedArr = [...selectedIndices].map((idx) => ({ pos: startPositions[idx] + clampedDelta, idx })).sort((a, b) => a.pos - b.pos);
    for (const sel of selectedArr) {
      const proposedStart = sel.pos;
      const proposedEnd = proposedStart + bw;
      for (const ns of nonSelectedPositions) {
        const nsStart = ns.pos;
        const nsEnd = nsStart + bw;
        if (proposedEnd > nsStart && proposedStart < nsEnd) {
          if (clampedDelta > 0) {
            clampedDelta = Math.min(clampedDelta, nsStart - bw - startPositions[sel.idx]);
          } else {
            clampedDelta = Math.max(clampedDelta, nsEnd - startPositions[sel.idx]);
          }
        }
      }
    }

    for (const idx of selectedIndices) {
      newPositions[idx] = startPositions[idx] + clampedDelta;
    }

    setPreviewPositions(newPositions);
    canvasRef.current.style.cursor = "grabbing";
  };

  const handleMouseUp = () => {
    if (!dragStateRef.current.dragging || previewPositions === null) {
      dragStateRef.current = { dragging: false, primaryIndex: -1, offset: 0, startPositions: null };
      setIsDragging(false);
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      return;
    }

    onBoardPositionsChange(previewPositions);
    dragStateRef.current = { dragging: false, primaryIndex: -1, offset: 0, startPositions: null };
    setIsDragging(false);
    setPreviewPositions(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  const handleMouseLeave = () => {
    if (dragStateRef.current.dragging) {
      handleMouseUp();
    }
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: "#f9f6f0",
        maxWidth: "100%",
        cursor: isDragging ? "grabbing" : "grab",
      }}
    />
  );
}


function InteractiveSideCanvas({ design, onStringerPositionsChange, selectedIndices, onSelectionChange }) {
  const canvasRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, primaryIndex: -1, offset: 0, startPositions: null });
  const [isDragging, setIsDragging] = useState(false);
  const [previewPositions, setPreviewPositions] = useState(null);

  const SCALE = 6;
  const PAD = 40;

  const getPositions = () => {
    if (design.stringerPositions !== null) {
      return design.stringerPositions;
    }
    return generateEvenPositions(design.stringerCount, design.stringerWidth, design.palletWidth);
  };

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const w = design.palletWidth * SCALE + PAD * 2;
    const totalHeight = design.deckThickness * 2 + design.stringerHeight;
    const h = totalHeight * SCALE + PAD * 2 + 40;
    canvasRef.current.width = w;
    canvasRef.current.height = h;

    ctx.fillStyle = "#f9f6f0";
    ctx.fillRect(0, 0, w, h);

    const baseY = PAD + 20;

    // Top deck
    ctx.fillStyle = colors.wood;
    ctx.fillRect(PAD, baseY, design.palletWidth * SCALE, design.deckThickness * SCALE);
    ctx.strokeStyle = "#8a6d3b";
    ctx.strokeRect(PAD, baseY, design.palletWidth * SCALE, design.deckThickness * SCALE);

    // Stringers (interactive) - positioned along X axis across palletWidth
    const positionsToUse = previewPositions !== null ? previewPositions : getPositions();
    const activeSet = dragStateRef.current.dragging ? new Set(selectedIndices) : selectedIndices;
    const stringerY = baseY + design.deckThickness * SCALE;

    // Notch dimensions for 4-Way pallets (industry standard ~1.5" deep from bottom)
    const notchDepth = Math.min(1.5, design.stringerHeight * 0.43);
    const is4Way = design.palletType === "4-Way";

    for (let i = 0; i < design.stringerCount; i++) {
      const x = PAD + (positionsToUse[i] || 0) * SCALE;
      const isActive = activeSet.has(i);
      const sw = design.stringerWidth * SCALE;
      const sh = design.stringerHeight * SCALE;

      let fillColor;
      if (isDragging && isActive) {
        fillColor = "#ff9800";
        ctx.globalAlpha = 0.85;
      } else if (isActive && !isDragging) {
        fillColor = "#3b82f6";
        ctx.globalAlpha = 0.75;
      } else if (isDragging) {
        fillColor = colors.woodDark;
        ctx.globalAlpha = 0.4;
      } else {
        fillColor = colors.woodDark;
        ctx.globalAlpha = 1;
      }

      if (is4Way) {
        // Draw stringer with notch cut from bottom (fork entry from width direction)
        const nd = notchDepth * SCALE;
        const footW = Math.max(2, sw * 0.2);

        ctx.fillStyle = fillColor;
        // Upper portion (full stringer width, above notch)
        ctx.fillRect(x, stringerY, sw, sh - nd);
        // Left foot
        ctx.fillRect(x, stringerY + sh - nd, footW, nd);
        // Right foot
        ctx.fillRect(x + sw - footW, stringerY + sh - nd, footW, nd);

        ctx.globalAlpha = 1;
        ctx.strokeStyle = isActive ? (isDragging ? "#e65100" : "#1e40af") : "#6b5030";
        ctx.lineWidth = isActive ? 2 : 1;
        // Outline the notched stringer shape
        ctx.beginPath();
        ctx.moveTo(x, stringerY);
        ctx.lineTo(x + sw, stringerY);
        ctx.lineTo(x + sw, stringerY + sh - nd);
        ctx.lineTo(x + sw, stringerY + sh);
        ctx.lineTo(x + sw - footW, stringerY + sh);
        ctx.lineTo(x + sw - footW, stringerY + sh - nd);
        ctx.lineTo(x + footW, stringerY + sh - nd);
        ctx.lineTo(x + footW, stringerY + sh);
        ctx.lineTo(x, stringerY + sh);
        ctx.lineTo(x, stringerY);
        ctx.closePath();
        ctx.stroke();
      } else {
        // Standard solid stringer (2-Way or Block)
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, stringerY, sw, sh);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isActive ? (isDragging ? "#e65100" : "#1e40af") : "#6b5030";
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.strokeRect(x, stringerY, sw, sh);
      }
    }

    // Bottom deck
    const bottomY = baseY + (design.deckThickness + design.stringerHeight) * SCALE;
    ctx.fillStyle = "#c9a06a";
    ctx.fillRect(PAD, bottomY, design.palletWidth * SCALE, design.deckThickness * SCALE);
    ctx.strokeStyle = "#8a6d3b";
    ctx.strokeRect(PAD, bottomY, design.palletWidth * SCALE, design.deckThickness * SCALE);

    // Width dimension label on top
    ctx.fillStyle = colors.primary;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${design.palletWidth}"`, PAD + (design.palletWidth * SCALE) / 2, PAD - 2);

    // Height dimension on right
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${totalHeight.toFixed(2)}" total height`, PAD + design.palletWidth * SCALE + 8, baseY + (totalHeight * SCALE) / 2 + 4);

    // Hint text
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = colors.textLight;
    const selCount = selectedIndices.size;
    const hint = selCount > 0
      ? `${selCount} stringer${selCount > 1 ? "s" : ""} selected \u2022 Ctrl+Click to add/remove`
      : `Drag stringers to reposition \u2022 Ctrl+Click to multi-select`;
    ctx.fillText(`End View (${design.stringerCount} stringers)`, PAD, h - 26);
    ctx.fillStyle = colors.primary;
    ctx.font = "10px sans-serif";
    ctx.fillText(hint, PAD, h - 12);
  }, [design, selectedIndices, isDragging, previewPositions]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const isCtrl = e.ctrlKey || e.metaKey;

    const positions = getPositions();
    const baseY = PAD + 20;
    const stringerY = baseY + design.deckThickness * SCALE;
    let clickedIndex = -1;

    for (let i = 0; i < design.stringerCount; i++) {
      const sx = PAD + positions[i] * SCALE;
      if (
        mx >= sx &&
        mx <= sx + design.stringerWidth * SCALE &&
        my >= stringerY &&
        my <= stringerY + design.stringerHeight * SCALE
      ) {
        clickedIndex = i;
        break;
      }
    }

    if (clickedIndex === -1) {
      if (!isCtrl) onSelectionChange(new Set());
      return;
    }

    let newSelected;
    if (isCtrl) {
      newSelected = new Set(selectedIndices);
      if (newSelected.has(clickedIndex)) {
        newSelected.delete(clickedIndex);
      } else {
        newSelected.add(clickedIndex);
      }
    } else {
      if (selectedIndices.has(clickedIndex) && selectedIndices.size > 1) {
        newSelected = new Set(selectedIndices);
      } else {
        newSelected = new Set([clickedIndex]);
      }
    }
    onSelectionChange(newSelected);

    if (newSelected.has(clickedIndex)) {
      const sx = PAD + positions[clickedIndex] * SCALE;
      dragStateRef.current = {
        dragging: true,
        primaryIndex: clickedIndex,
        offset: mx - sx,
        startPositions: [...positions],
      };
      setIsDragging(true);
      setPreviewPositions([...positions]);
    }
  };

  const handleMouseMove = (e) => {
    if (!dragStateRef.current.dragging) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const { primaryIndex, offset, startPositions } = dragStateRef.current;

    const newPrimaryX = (mx - PAD - offset) / SCALE;
    const delta = newPrimaryX - startPositions[primaryIndex];

    const newPositions = [...startPositions];
    const minX = 0;
    const maxX = design.palletWidth - design.stringerWidth;
    const sw = design.stringerWidth;

    // Clamp to pallet bounds
    let clampedDelta = delta;
    for (const idx of selectedIndices) {
      const proposed = startPositions[idx] + delta;
      if (proposed < minX) clampedDelta = Math.max(clampedDelta, minX - startPositions[idx]);
      if (proposed > maxX) clampedDelta = Math.min(clampedDelta, maxX - startPositions[idx]);
    }

    // Clamp to prevent overlap with non-selected stringers
    const nonSelectedPositions = startPositions.map((p, i) => ({ pos: p, idx: i })).filter((b) => !selectedIndices.has(b.idx));
    const selectedArr = [...selectedIndices].map((idx) => ({ pos: startPositions[idx] + clampedDelta, idx })).sort((a, b) => a.pos - b.pos);
    for (const sel of selectedArr) {
      const proposedStart = sel.pos;
      const proposedEnd = proposedStart + sw;
      for (const ns of nonSelectedPositions) {
        const nsStart = ns.pos;
        const nsEnd = nsStart + sw;
        if (proposedEnd > nsStart && proposedStart < nsEnd) {
          if (clampedDelta > 0) {
            clampedDelta = Math.min(clampedDelta, nsStart - sw - startPositions[sel.idx]);
          } else {
            clampedDelta = Math.max(clampedDelta, nsEnd - startPositions[sel.idx]);
          }
        }
      }
    }

    for (const idx of selectedIndices) {
      newPositions[idx] = startPositions[idx] + clampedDelta;
    }

    setPreviewPositions(newPositions);
    canvasRef.current.style.cursor = "grabbing";
  };

  const handleMouseUp = () => {
    if (!dragStateRef.current.dragging || previewPositions === null) {
      dragStateRef.current = { dragging: false, primaryIndex: -1, offset: 0, startPositions: null };
      setIsDragging(false);
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      return;
    }

    onStringerPositionsChange(previewPositions);
    dragStateRef.current = { dragging: false, primaryIndex: -1, offset: 0, startPositions: null };
    setIsDragging(false);
    setPreviewPositions(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  const handleMouseLeave = () => {
    if (dragStateRef.current.dragging) {
      handleMouseUp();
    }
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: "#f9f6f0",
        maxWidth: "100%",
        cursor: isDragging ? "grabbing" : "grab",
      }}
    />
  );
}

function InteractiveBottomCanvas({ design, onBoardPositionsChange, selectedIndices, onSelectionChange }) {
  const canvasRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, primaryIndex: -1, offset: 0, startPositions: null });
  const [isDragging, setIsDragging] = useState(false);
  const [previewPositions, setPreviewPositions] = useState(null);

  const SCALE = 6;
  const PAD = 40;

  const getPositions = () => {
    if (design.bottomBoardPositions !== null) {
      return design.bottomBoardPositions;
    }
    return generateEvenPositions(design.bottomDeckBoards, design.deckWidth, design.palletLength);
  };

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const w = design.palletWidth * SCALE + PAD * 2;
    const h = design.palletLength * SCALE + PAD * 2;
    canvasRef.current.width = w;
    canvasRef.current.height = h;

    ctx.fillStyle = "#f9f6f0";
    ctx.fillRect(0, 0, w, h);

    const stringerPos = design.stringerPositions !== null
      ? design.stringerPositions
      : generateEvenPositions(design.stringerCount, design.stringerWidth, design.palletWidth);
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < design.stringerCount; i++) {
      const x = PAD + (stringerPos[i] || 0) * SCALE;
      ctx.fillStyle = colors.woodDark;
      ctx.fillRect(x, PAD, design.stringerWidth * SCALE, design.palletLength * SCALE);
      ctx.strokeStyle = "#6b5030";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, PAD, design.stringerWidth * SCALE, design.palletLength * SCALE);
    }
    ctx.globalAlpha = 1;

    const positionsToUse = previewPositions !== null ? previewPositions : getPositions();
    const activeSet = dragStateRef.current.dragging ? new Set(selectedIndices) : selectedIndices;

    for (let i = 0; i < design.bottomDeckBoards; i++) {
      const y = PAD + (positionsToUse[i] || 0) * SCALE;
      const isActive = activeSet.has(i);

      if (isDragging && isActive) {
        ctx.fillStyle = "#ff9800";
        ctx.globalAlpha = 0.85;
      } else if (isActive && !isDragging) {
        ctx.fillStyle = "#3b82f6";
        ctx.globalAlpha = 0.75;
      } else if (isDragging) {
        ctx.fillStyle = "#c9a06a";
        ctx.globalAlpha = 0.4;
      } else {
        ctx.fillStyle = "#c9a06a";
        ctx.globalAlpha = 1;
      }

      ctx.fillRect(PAD, y, design.palletWidth * SCALE, design.deckWidth * SCALE);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isActive ? (isDragging ? "#e65100" : "#1e40af") : "#8a6d3b";
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(PAD, y, design.palletWidth * SCALE, design.deckWidth * SCALE);

      const nailsNeeded = calcNailsRequired(design.deckWidth);
      for (let s = 0; s < design.stringerCount; s++) {
        const sx = PAD + (stringerPos[s] || 0) * SCALE + (design.stringerWidth * SCALE) / 2;
        for (let n = 0; n < nailsNeeded; n++) {
          const ny = y + ((n + 1) / (nailsNeeded + 1)) * design.deckWidth * SCALE;
          ctx.beginPath();
          ctx.arc(sx, ny, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#444";
          ctx.fill();
        }
      }
    }

    ctx.fillStyle = colors.primary;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${design.palletWidth}"`, PAD + (design.palletWidth * SCALE) / 2, PAD - 12);
    ctx.save();
    ctx.translate(PAD - 16, PAD + (design.palletLength * SCALE) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${design.palletLength}"`, 0, 0);
    ctx.restore();

    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = colors.textLight;
    const selCount = selectedIndices.size;
    const hint = selCount > 0
      ? `${selCount} board${selCount > 1 ? "s" : ""} selected \u2022 Ctrl+Click to add/remove`
      : `Drag boards to reposition \u2022 Ctrl+Click to multi-select`;
    ctx.fillText(`Bottom View (${design.bottomDeckBoards} bottom deck boards)`, PAD, h - 26);
    ctx.fillStyle = colors.primary;
    ctx.font = "10px sans-serif";
    ctx.fillText(hint, PAD, h - 12);
  }, [design, selectedIndices, isDragging, previewPositions]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const isCtrl = e.ctrlKey || e.metaKey;

    const positions = getPositions();
    let clickedIndex = -1;

    for (let i = 0; i < design.bottomDeckBoards; i++) {
      const boardY = PAD + positions[i] * SCALE;
      if (
        my >= boardY &&
        my <= boardY + design.deckWidth * SCALE &&
        mx >= PAD &&
        mx <= PAD + design.palletWidth * SCALE
      ) {
        clickedIndex = i;
        break;
      }
    }

    if (clickedIndex === -1) {
      if (!isCtrl) onSelectionChange(new Set());
      return;
    }

    let newSelected;
    if (isCtrl) {
      newSelected = new Set(selectedIndices);
      if (newSelected.has(clickedIndex)) {
        newSelected.delete(clickedIndex);
      } else {
        newSelected.add(clickedIndex);
      }
    } else {
      if (selectedIndices.has(clickedIndex) && selectedIndices.size > 1) {
        newSelected = new Set(selectedIndices);
      } else {
        newSelected = new Set([clickedIndex]);
      }
    }
    onSelectionChange(newSelected);

    if (newSelected.has(clickedIndex)) {
      const boardY = PAD + positions[clickedIndex] * SCALE;
      dragStateRef.current = {
        dragging: true,
        primaryIndex: clickedIndex,
        offset: my - boardY,
        startPositions: [...positions],
      };
      setIsDragging(true);
      setPreviewPositions([...positions]);
    }
  };

  const handleMouseMove = (e) => {
    if (!dragStateRef.current.dragging) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const { primaryIndex, offset, startPositions } = dragStateRef.current;

    const newPrimaryY = (my - PAD - offset) / SCALE;
    const delta = newPrimaryY - startPositions[primaryIndex];

    const newPositions = [...startPositions];
    const minY = 0;
    const maxY = design.palletLength - design.deckWidth;
    const bw = design.deckWidth;

    // Clamp to pallet bounds
    let clampedDelta = delta;
    for (const idx of selectedIndices) {
      const proposed = startPositions[idx] + delta;
      if (proposed < minY) clampedDelta = Math.max(clampedDelta, minY - startPositions[idx]);
      if (proposed > maxY) clampedDelta = Math.min(clampedDelta, maxY - startPositions[idx]);
    }

    // Clamp to prevent overlap with non-selected boards
    const nonSelectedPositions = startPositions.map((p, i) => ({ pos: p, idx: i })).filter((b) => !selectedIndices.has(b.idx));
    const selectedArr = [...selectedIndices].map((idx) => ({ pos: startPositions[idx] + clampedDelta, idx })).sort((a, b) => a.pos - b.pos);
    for (const sel of selectedArr) {
      const proposedStart = sel.pos;
      const proposedEnd = proposedStart + bw;
      for (const ns of nonSelectedPositions) {
        const nsStart = ns.pos;
        const nsEnd = nsStart + bw;
        if (proposedEnd > nsStart && proposedStart < nsEnd) {
          if (clampedDelta > 0) {
            clampedDelta = Math.min(clampedDelta, nsStart - bw - startPositions[sel.idx]);
          } else {
            clampedDelta = Math.max(clampedDelta, nsEnd - startPositions[sel.idx]);
          }
        }
      }
    }

    for (const idx of selectedIndices) {
      newPositions[idx] = startPositions[idx] + clampedDelta;
    }

    setPreviewPositions(newPositions);
    canvasRef.current.style.cursor = "grabbing";
  };

  const handleMouseUp = () => {
    if (!dragStateRef.current.dragging || previewPositions === null) {
      dragStateRef.current = { dragging: false, primaryIndex: -1, offset: 0, startPositions: null };
      setIsDragging(false);
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";
      return;
    }

    onBoardPositionsChange(previewPositions);
    dragStateRef.current = { dragging: false, primaryIndex: -1, offset: 0, startPositions: null };
    setIsDragging(false);
    setPreviewPositions(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  const handleMouseLeave = () => {
    if (dragStateRef.current.dragging) {
      handleMouseUp();
    }
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: "#f9f6f0",
        maxWidth: "100%",
        cursor: isDragging ? "grabbing" : "grab",
      }}
    />
  );
}


function EndViewCanvas({ design }) {
  const canvasRef = useRef(null);
  const SCALE = 6;
  const PAD = 40;

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const w = design.palletLength * SCALE + PAD * 2;
    const totalHeight = design.deckThickness * 2 + design.stringerHeight;
    const h = totalHeight * SCALE + PAD * 2 + 50;
    canvasRef.current.width = w;
    canvasRef.current.height = h;

    ctx.fillStyle = "#f9f6f0";
    ctx.fillRect(0, 0, w, h);

    const baseY = PAD + 20;
    const is4Way = design.palletType === "4-Way";
    const isBlock = design.palletType === "Block";

    // Get board positions (now along palletLength axis)
    const topPos = design.topBoardPositions !== null
      ? design.topBoardPositions
      : generateEvenPositions(design.topDeckBoards, design.deckWidth, design.palletLength);
    const bottomPos = design.bottomBoardPositions !== null
      ? design.bottomBoardPositions
      : generateEvenPositions(design.bottomDeckBoards, design.deckWidth, design.palletLength);

    // For end view (looking along width), stringers run the full length
    // Show them as a continuous bar with notch cutouts
    const notchDepth = Math.min(1.5, design.stringerHeight * 0.43);
    const notchWidth = 9;

    // ── Draw top deck board cross-sections ──
    for (let i = 0; i < design.topDeckBoards; i++) {
      const x = PAD + (topPos[i] || 0) * SCALE;
      ctx.fillStyle = colors.wood;
      ctx.fillRect(x, baseY, design.deckWidth * SCALE, design.deckThickness * SCALE);
      ctx.strokeStyle = "#8a6d3b";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, baseY, design.deckWidth * SCALE, design.deckThickness * SCALE);
    }

    // ── Draw stringer layer(s) as continuous bar(s) across palletLength ──
    const stringerY = baseY + design.deckThickness * SCALE;
    const sh = design.stringerHeight * SCALE;

    // Get stringer positions for notch placement
    const stringerPos = design.stringerPositions !== null
      ? design.stringerPositions
      : generateEvenPositions(design.stringerCount, design.stringerWidth, design.palletWidth);

    if (is4Way) {
      // For 4-Way: draw continuous stringer bar with notches at strategic points
      // Notches at near-ends and at some board intersections
      ctx.fillStyle = colors.woodDark;
      ctx.fillRect(PAD, stringerY, design.palletLength * SCALE, sh);

      // Add notches
      const notchPositions = [];
      // Notch near left end
      notchPositions.push(0.5);
      // Notch at center
      notchPositions.push(design.palletLength / 2);
      // Notch near right end
      notchPositions.push(design.palletLength - 0.5);

      ctx.fillStyle = "#f9f6f0";
      const nd = notchDepth * SCALE;
      const nw = notchWidth * SCALE;

      for (const notchPos of notchPositions) {
        const notchX = PAD + notchPos * SCALE;
        const notchLeft = notchX - nw / 2;
        const notchRight = notchX + nw / 2;
        // Clamp to pallet bounds
        const clampedLeft = Math.max(PAD, notchLeft);
        const clampedRight = Math.min(PAD + design.palletLength * SCALE, notchRight);
        const clampedWidth = clampedRight - clampedLeft;
        if (clampedWidth > 0) {
          ctx.fillRect(clampedLeft, stringerY + sh - nd, clampedWidth, nd);
        }
      }

      // Outline
      ctx.strokeStyle = "#6b5030";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD, stringerY);
      ctx.lineTo(PAD + design.palletLength * SCALE, stringerY);
      // Right edge with notches
      let currentX = PAD + design.palletLength * SCALE;
      for (let i = notchPositions.length - 1; i >= 0; i--) {
        const notchX = PAD + notchPositions[i] * SCALE;
        const notchRight = notchX + nw / 2;
        const clampedRight = Math.min(PAD + design.palletLength * SCALE, notchRight);
        ctx.lineTo(clampedRight, stringerY + sh - nd);
        ctx.lineTo(clampedRight, stringerY + sh);
        const notchLeft = notchX - nw / 2;
        const clampedLeft = Math.max(PAD, notchLeft);
        ctx.lineTo(clampedLeft, stringerY + sh);
        ctx.lineTo(clampedLeft, stringerY + sh - nd);
      }
      ctx.lineTo(PAD, stringerY + sh - nd);
      ctx.closePath();
      ctx.stroke();
    } else if (isBlock) {
      // Block: draw as continuous bar with blocks indicated
      ctx.fillStyle = colors.woodDark;
      ctx.fillRect(PAD, stringerY, design.palletLength * SCALE, sh);
      // Add grid pattern for block visualization
      ctx.strokeStyle = "#a08050";
      ctx.lineWidth = 0.5;
      const blockSpacing = design.palletLength / Math.max(design.stringerCount, 1);
      for (let i = 1; i < design.stringerCount; i++) {
        const bx = PAD + (i * blockSpacing) * SCALE;
        ctx.beginPath();
        ctx.moveTo(bx, stringerY);
        ctx.lineTo(bx, stringerY + sh);
        ctx.stroke();
      }
      // Cross hatch
      ctx.beginPath();
      ctx.moveTo(PAD, stringerY);
      ctx.lineTo(PAD + design.palletLength * SCALE, stringerY + sh);
      ctx.moveTo(PAD + design.palletLength * SCALE, stringerY);
      ctx.lineTo(PAD, stringerY + sh);
      ctx.stroke();

      ctx.strokeStyle = "#6b5030";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(PAD, stringerY, design.palletLength * SCALE, sh);
    } else {
      // 2-Way: simple continuous bar
      ctx.fillStyle = colors.woodDark;
      ctx.fillRect(PAD, stringerY, design.palletLength * SCALE, sh);
      ctx.strokeStyle = "#6b5030";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(PAD, stringerY, design.palletLength * SCALE, sh);
    }

    // ── Draw bottom deck board cross-sections ──
    const bottomDeckY = baseY + (design.deckThickness + design.stringerHeight) * SCALE;
    for (let i = 0; i < design.bottomDeckBoards; i++) {
      const x = PAD + (bottomPos[i] || 0) * SCALE;
      ctx.fillStyle = "#c9a06a";
      ctx.fillRect(x, bottomDeckY, design.deckWidth * SCALE, design.deckThickness * SCALE);
      ctx.strokeStyle = "#8a6d3b";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, bottomDeckY, design.deckWidth * SCALE, design.deckThickness * SCALE);
    }

    // ── Dimension labels ──
    ctx.fillStyle = colors.primary;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${design.palletLength}"`, PAD + (design.palletLength * SCALE) / 2, baseY - 8);

    // Height label
    ctx.textAlign = "left";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(
      `${totalHeight.toFixed(2)}" tall`,
      PAD + design.palletLength * SCALE + 8,
      baseY + (totalHeight * SCALE) / 2 + 4
    );

    // Fork entry label (for 4-way, indicate notch positions)
    if (is4Way) {
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "rgba(70, 130, 180, 0.8)";
      ctx.textAlign = "center";
      const notchPositions = [0.5, design.palletLength / 2, design.palletLength - 0.5];
      for (const notchPos of notchPositions) {
        const nx = PAD + notchPos * SCALE;
        ctx.fillText("Fork Entry", nx, stringerY + sh + 12);
      }
    }

    // Title
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = colors.textLight;
    const typeLabel = is4Way ? "4-Way (notched)" : isBlock ? "Block" : "2-Way";
    ctx.fillText(`Side Profile \u2014 ${typeLabel}`, PAD, h - 16);
  }, [design]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        background: "#f9f6f0",
        maxWidth: "100%",
      }}
    />
  );
}

function Designer({ inventory = [] }) {
  // Calculate board count to achieve ~3" gaps: gap = (span - count * boardWidth) / (count + 1) ≈ 3
  // Solving: count = (span - 3) / (boardWidth + 3), clamped to valid range
  const calcBoardCount = (span, boardWidth, min = 3, max = 20) => {
    const count = Math.round((span - 3) / (boardWidth + 3));
    return Math.max(min, Math.min(max, count));
  };

  const initTop = calcBoardCount(48, 3.5);
  const initBottom = calcBoardCount(48, 3.5, 0, 15);

  const [design, setDesign] = useState({
    palletType: "2-Way",
    palletLength: 48,
    palletWidth: 40,
    species: "Southern Yellow Pine",
    deckThickness: 0.625,
    deckWidth: 3.5,
    topDeckBoards: initTop,
    bottomDeckBoards: initBottom,
    stringerWidth: 1.5,
    stringerHeight: 3.5,
    stringerCount: 3,
    fastenerType: "helical_11_5",
    mc: "kiln_dried",
    temp: "normal",
    leadingEdgeReinforcement: true,
    targetLoad: 2500,
    topBoardPositions: null,  // null = auto even spacing
    bottomBoardPositions: null,  // null = auto even spacing
    stringerPositions: null,  // null = auto even spacing
  });

  const [undoStack, setUndoStack] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoConfigStrategy, setAutoConfigStrategy] = useState("lowest_cost");
  const [activeView, setActiveView] = useState("top");
  const [topSelectedIndices, setTopSelectedIndices] = useState(new Set());
  const [bottomSelectedIndices, setBottomSelectedIndices] = useState(new Set());
  const [stringerSelectedIndices, setStringerSelectedIndices] = useState(new Set());

  // ── Auto-configure: search inventory for best combo meeting target load ──
  const autoConfigure = () => {
    if (inventory.length === 0) return;
    const targetLoad = design.targetLoad;
    const palletLength = design.palletLength;
    const palletWidth = design.palletWidth;
    const candidates = [];

    for (const item of inventory) {
      const sp = ALL_SPECIES.find((s) => s.name === item.name);
      if (!sp) continue;

      for (const thickness of item.thicknesses) {
        for (const width of item.widths) {
          for (const stringerW of item.stringerWidths) {
            for (const stringerH of item.stringerHeights) {
              // Try 3, 4, 5 stringers
              for (const stringerCount of [3, 4, 5]) {
                const span = palletLength / Math.max(stringerCount - 1, 1);
                const cap = calcDeckBoardCapacity(item.name, thickness, width, span, design.mc, design.temp);
                if (cap.maxLoad < targetLoad) continue;

                const boardCount = calcBoardCount(palletLength, width);
                const bottomCount = calcBoardCount(palletLength, width, 0, 15);

                // Calculate cost for this combo
                const deckBF = ((thickness * width * palletLength) / 144) * (boardCount + bottomCount);
                const stringerBF = ((stringerW * stringerH * palletWidth) / 144) * stringerCount;
                const totalBF = deckBF + stringerBF;
                const costBF = (item.costPerBF != null) ? item.costPerBF : sp.costPerBF;
                const lumberCost = totalBF * costBF;
                const ft = FASTENER_TYPES[design.fastenerType];
                const nailsPerBoard = calcNailsRequired(width);
                const totalNails = nailsPerBoard * (boardCount + bottomCount) * stringerCount;
                const fastenerCost = totalNails * ft.costPer;
                const totalCost = lumberCost + fastenerCost + 1.50 + 0.75;

                const safetyFactor = cap.maxLoad / targetLoad;
                const totalBoards = boardCount + bottomCount;

                candidates.push({
                  species: item.name,
                  deckThickness: thickness,
                  deckWidth: width,
                  stringerWidth: stringerW,
                  stringerHeight: stringerH,
                  stringerCount,
                  topDeckBoards: boardCount,
                  bottomDeckBoards: bottomCount,
                  maxLoad: cap.maxLoad,
                  safetyFactor,
                  totalCost,
                  totalBoards,
                });
              }
            }
          }
        }
      }
    }

    if (candidates.length === 0) return;

    // Sort by chosen strategy
    if (autoConfigStrategy === "lowest_cost") {
      candidates.sort((a, b) => a.totalCost - b.totalCost);
    } else if (autoConfigStrategy === "fewest_boards") {
      candidates.sort((a, b) => a.totalBoards - b.totalBoards || a.totalCost - b.totalCost);
    } else if (autoConfigStrategy === "max_safety") {
      candidates.sort((a, b) => b.safetyFactor - a.safetyFactor);
    }

    const best = candidates[0];
    setDesign((p) => {
      pushUndo(p);
      return {
        ...p,
        species: best.species,
        deckThickness: best.deckThickness,
        deckWidth: best.deckWidth,
        stringerWidth: best.stringerWidth,
        stringerHeight: best.stringerHeight,
        stringerCount: best.stringerCount,
        topDeckBoards: best.topDeckBoards,
        bottomDeckBoards: best.bottomDeckBoards,
        topBoardPositions: null,
        bottomBoardPositions: null,
        stringerPositions: null,
      };
    });
  };

  const pushUndo = (snapshot) => {
    setUndoStack((prev) => [...prev.slice(-29), snapshot]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setDesign(prev);
    setTopSelectedIndices(new Set());
    setBottomSelectedIndices(new Set());
    setStringerSelectedIndices(new Set());
  };

  const ud = (key, val) => setDesign((p) => {
    pushUndo(p);
    const updated = { ...p, [key]: val };
    if (['topDeckBoards', 'bottomDeckBoards', 'deckWidth', 'palletLength'].includes(key)) {
      updated.topBoardPositions = null;
      updated.bottomBoardPositions = null;
    }
    // Recalculate board counts when dimensions change to maintain ~3" gaps
    if (['deckWidth', 'palletLength'].includes(key)) {
      const span = key === 'palletLength' ? val : updated.palletLength;
      const bw = key === 'deckWidth' ? val : updated.deckWidth;
      updated.topDeckBoards = calcBoardCount(span, bw);
      updated.bottomDeckBoards = calcBoardCount(span, bw, 0, 15);
    }
    if (['stringerCount', 'stringerWidth', 'palletWidth'].includes(key)) {
      updated.stringerPositions = null;
    }
    return updated;
  });

  // Resolve positions (null means auto even)
  const getTopPositions = () => design.topBoardPositions !== null
    ? design.topBoardPositions
    : generateEvenPositions(design.topDeckBoards, design.deckWidth, design.palletLength);
  const getBottomPositions = () => design.bottomBoardPositions !== null
    ? design.bottomBoardPositions
    : generateEvenPositions(design.bottomDeckBoards, design.deckWidth, design.palletLength);
  const getStringerPositions = () => design.stringerPositions !== null
    ? design.stringerPositions
    : generateEvenPositions(design.stringerCount, design.stringerWidth, design.palletWidth);

  const handleRemoveTopBoards = () => {
    if (topSelectedIndices.size === 0) return;
    if (design.topDeckBoards - topSelectedIndices.size < 1) return; // keep at least 1
    pushUndo(design);
    const positions = getTopPositions();
    const newPositions = positions.filter((_, i) => !topSelectedIndices.has(i));
    setDesign((p) => ({
      ...p,
      topDeckBoards: p.topDeckBoards - topSelectedIndices.size,
      topBoardPositions: newPositions,
    }));
    setTopSelectedIndices(new Set());
  };

  const handleRemoveBottomBoards = () => {
    if (bottomSelectedIndices.size === 0) return;
    if (design.bottomDeckBoards - bottomSelectedIndices.size < 0) return;
    pushUndo(design);
    const positions = getBottomPositions();
    const newPositions = positions.filter((_, i) => !bottomSelectedIndices.has(i));
    setDesign((p) => ({
      ...p,
      bottomDeckBoards: p.bottomDeckBoards - bottomSelectedIndices.size,
      bottomBoardPositions: newPositions,
    }));
    setBottomSelectedIndices(new Set());
  };

  const handleAddTopBoard = () => {
    pushUndo(design);
    const positions = getTopPositions();
    const newCount = design.topDeckBoards + 1;
    const bw = design.deckWidth;
    // Find the largest gap
    let bestGap = -1;
    let insertPos = design.palletLength / 2;
    if (positions.length === 0) {
      insertPos = 0;
      bestGap = design.palletLength;
    } else {
      const sortedPos = [...positions].sort((a, b) => a - b);
      for (let i = 0; i <= sortedPos.length; i++) {
        const gapEnd = i < sortedPos.length ? sortedPos[i] : design.palletLength;
        const prevEnd = i > 0 ? sortedPos[i - 1] + bw : 0;
        const gap = gapEnd - prevEnd;
        if (gap > bestGap) {
          bestGap = gap;
          insertPos = prevEnd + (gap - bw) / 2;
        }
      }
    }
    // If the board fits in the gap, place it there; otherwise redistribute evenly
    if (bestGap >= bw) {
      const clamped = Math.max(0, Math.min(design.palletLength - bw, insertPos));
      const newPositions = [...positions, clamped];
      setDesign((p) => ({ ...p, topDeckBoards: newCount, topBoardPositions: newPositions }));
    } else {
      const evenPositions = generateEvenPositions(newCount, bw, design.palletLength);
      setDesign((p) => ({ ...p, topDeckBoards: newCount, topBoardPositions: evenPositions }));
    }
    setTopSelectedIndices(new Set());
  };

  const handleAddBottomBoard = () => {
    pushUndo(design);
    const positions = getBottomPositions();
    const newCount = design.bottomDeckBoards + 1;
    const bw = design.deckWidth;
    let bestGap = -1;
    let insertPos = design.palletLength / 2;
    if (positions.length === 0) {
      insertPos = 0;
      bestGap = design.palletLength;
    } else {
      const sortedPos = [...positions].sort((a, b) => a - b);
      for (let i = 0; i <= sortedPos.length; i++) {
        const gapEnd = i < sortedPos.length ? sortedPos[i] : design.palletLength;
        const prevEnd = i > 0 ? sortedPos[i - 1] + bw : 0;
        const gap = gapEnd - prevEnd;
        if (gap > bestGap) {
          bestGap = gap;
          insertPos = prevEnd + (gap - bw) / 2;
        }
      }
    }
    if (bestGap >= bw) {
      const clamped = Math.max(0, Math.min(design.palletLength - bw, insertPos));
      const newPositions = [...positions, clamped];
      setDesign((p) => ({ ...p, bottomDeckBoards: newCount, bottomBoardPositions: newPositions }));
    } else {
      const evenPositions = generateEvenPositions(newCount, bw, design.palletLength);
      setDesign((p) => ({ ...p, bottomDeckBoards: newCount, bottomBoardPositions: evenPositions }));
    }
    setBottomSelectedIndices(new Set());
  };

  const handleTopPositionsChange = (positions) => {
    pushUndo(design);
    setDesign((p) => ({ ...p, topBoardPositions: positions }));
  };

  const handleBottomPositionsChange = (positions) => {
    pushUndo(design);
    setDesign((p) => ({ ...p, bottomBoardPositions: positions }));
  };

  const handleStringerPositionsChange = (positions) => {
    pushUndo(design);
    setDesign((p) => ({ ...p, stringerPositions: positions }));
  };

  const handleRemoveStringers = () => {
    if (stringerSelectedIndices.size === 0) return;
    if (design.stringerCount - stringerSelectedIndices.size < 2) return; // keep at least 2
    pushUndo(design);
    const positions = getStringerPositions();
    const newPositions = positions.filter((_, i) => !stringerSelectedIndices.has(i));
    setDesign((p) => ({
      ...p,
      stringerCount: p.stringerCount - stringerSelectedIndices.size,
      stringerPositions: newPositions,
    }));
    setStringerSelectedIndices(new Set());
  };

  const handleAddStringer = () => {
    pushUndo(design);
    const positions = getStringerPositions();
    const newCount = design.stringerCount + 1;
    const sw = design.stringerWidth;
    let bestGap = -1;
    let insertPos = design.palletWidth / 2;
    if (positions.length === 0) {
      insertPos = 0;
      bestGap = design.palletWidth;
    } else {
      const sortedPos = [...positions].sort((a, b) => a - b);
      for (let i = 0; i <= sortedPos.length; i++) {
        const gapEnd = i < sortedPos.length ? sortedPos[i] : design.palletWidth;
        const prevEnd = i > 0 ? sortedPos[i - 1] + sw : 0;
        const gap = gapEnd - prevEnd;
        if (gap > bestGap) {
          bestGap = gap;
          insertPos = prevEnd + (gap - sw) / 2;
        }
      }
    }
    if (bestGap >= sw) {
      const clamped = Math.max(0, Math.min(design.palletWidth - sw, insertPos));
      const newPositions = [...positions, clamped];
      setDesign((p) => ({ ...p, stringerCount: newCount, stringerPositions: newPositions }));
    } else {
      const evenPositions = generateEvenPositions(newCount, sw, design.palletWidth);
      setDesign((p) => ({ ...p, stringerCount: newCount, stringerPositions: evenPositions }));
    }
    setStringerSelectedIndices(new Set());
  };

  const handleSpaceEvenlyStringers = () => {
    if (stringerSelectedIndices.size < 2) return;
    const positions = getStringerPositions();
    const result = spaceEvenlyInPocket(positions, stringerSelectedIndices, design.palletWidth, design.stringerWidth);
    if (result) {
      pushUndo(design);
      setDesign((p) => ({ ...p, stringerPositions: result }));
    }
  };

  // Space selected boards evenly within their bounding pocket
  const spaceEvenlyInPocket = (allPositions, selectedSet, palletW, boardW) => {
    if (selectedSet.size < 2) return null;
    const selIndices = [...selectedSet].sort((a, b) => allPositions[a] - allPositions[b]);
    // Find the pocket bounds
    const sorted = allPositions.map((p, i) => ({ pos: p, idx: i })).sort((a, b) => a.pos - b.pos);
    const leftmostSelPos = allPositions[selIndices[0]];
    const rightmostSelPos = allPositions[selIndices[selIndices.length - 1]];
    // Left bound: right edge of nearest unselected board to the left, or 0
    let leftBound = 0;
    for (const b of sorted) {
      if (selectedSet.has(b.idx)) continue;
      const rightEdge = b.pos + boardW;
      if (rightEdge <= leftmostSelPos + 0.01) {
        leftBound = Math.max(leftBound, rightEdge);
      }
    }
    // Right bound: left edge of nearest unselected board to the right, or palletWidth
    let rightBound = palletW;
    for (const b of sorted) {
      if (selectedSet.has(b.idx)) continue;
      if (b.pos >= rightmostSelPos + boardW - 0.01) {
        rightBound = Math.min(rightBound, b.pos);
      }
    }
    // Distribute selected boards evenly within [leftBound, rightBound], flush to edges
    const count = selIndices.length;
    const availableSpace = rightBound - leftBound;
    const totalBoardWidth = count * boardW;
    if (totalBoardWidth > availableSpace + 0.01) return null; // shouldn't happen but safety
    const newPositions = [...allPositions];
    const gap = (availableSpace - totalBoardWidth) / (count + 1);
    for (let i = 0; i < count; i++) {
      newPositions[selIndices[i]] = leftBound + (i + 1) * gap + i * boardW;
    }
    return newPositions;
  };

  const handleSpaceEvenlyTop = () => {
    if (topSelectedIndices.size < 2) return;
    const positions = getTopPositions();
    const result = spaceEvenlyInPocket(positions, topSelectedIndices, design.palletLength, design.deckWidth);
    if (result) {
      pushUndo(design);
      setDesign((p) => ({ ...p, topBoardPositions: result }));
    }
  };

  const handleSpaceEvenlyBottom = () => {
    if (bottomSelectedIndices.size < 2) return;
    const positions = getBottomPositions();
    const result = spaceEvenlyInPocket(positions, bottomSelectedIndices, design.palletLength, design.deckWidth);
    if (result) {
      pushUndo(design);
      setDesign((p) => ({ ...p, bottomBoardPositions: result }));
    }
  };

  const sp = ALL_SPECIES.find((s) => s.name === design.species);
  const capacity = calcDeckBoardCapacity(
    design.species,
    design.deckThickness,
    design.deckWidth,
    design.palletLength / Math.max(design.stringerCount - 1, 1),
    design.mc,
    design.temp
  );
  const durability = calcDurabilityScore(
    design.species,
    design.mc,
    design.fastenerType,
    design.leadingEdgeReinforcement
  );
  const cost = calcPalletCost(design, inventory);
  const safetyFactor = capacity.maxLoad > 0 ? (capacity.maxLoad / Math.max(design.targetLoad, 1)).toFixed(2) : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
      {/* Left panel - Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: "80vh", overflowY: "auto" }}>
        <Card title="Pallet Configuration">
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: colors.textLight, marginBottom: 6 }}>
              Pallet Type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {PALLET_TYPES.map((p) => (
                <button
                  key={p.name}
                  onClick={() => ud("palletType", p.name)}
                  style={{
                    padding: "10px 6px",
                    border: `2px solid ${design.palletType === p.name ? colors.primary : colors.border}`,
                    borderRadius: 8,
                    background: design.palletType === p.name ? colors.primary : "white",
                    color: design.palletType === p.name ? "white" : colors.text,
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <NumberInput label="Length" value={design.palletLength} onChange={(v) => ud("palletLength", v)} min={12} max={120} unit="in" />
            <NumberInput label="Width" value={design.palletWidth} onChange={(v) => ud("palletWidth", v)} min={12} max={120} unit="in" />
          </div>
          <NumberInput label="Target Load Capacity" value={design.targetLoad} onChange={(v) => ud("targetLoad", v)} min={100} max={50000} unit="lbs" />
          <Select
            label={inventory.length > 0 ? "Wood Species (from inventory)" : "Wood Species"}
            value={design.species}
            onChange={(v) => ud("species", v)}
            options={inventory.length > 0
              ? (() => {
                  const hw = inventory.filter((i) => i.type === "Hardwood");
                  const sw = inventory.filter((i) => i.type === "Softwood");
                  return [
                    ...(hw.length ? [{ value: "", label: "-- Stocked Hardwoods --", disabled: true }] : []),
                    ...hw.map((i) => ({ value: i.name, label: `${i.name} (${i.group})` })),
                    ...(sw.length ? [{ value: "", label: "-- Stocked Softwoods --", disabled: true }] : []),
                    ...sw.map((i) => ({ value: i.name, label: `${i.name} (${i.group})` })),
                  ];
                })()
              : [
                  { value: "", label: "-- Hardwoods --", disabled: true },
                  ...VT_WOOD_SPECIES.hardwoods.map((s) => ({ value: s.name, label: `${s.name} (${s.group})` })),
                  { value: "", label: "-- Softwoods --", disabled: true },
                  ...VT_WOOD_SPECIES.softwoods.map((s) => ({ value: s.name, label: `${s.name} (${s.group})` })),
                ]
            }
          />
          {sp && (
            <div
              style={{
                background: "#f8f5ef",
                padding: 10,
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 12,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div>SG: {sp.sg} | MOE: {(sp.moe / 1000000).toFixed(2)}M psi | MOR: {sp.mor.toLocaleString()} psi</div>
            </div>
          )}
          {inventory.length > 0 && (
            <div style={{ padding: "10px 12px", background: `linear-gradient(135deg, ${colors.primary}08, ${colors.accent}15)`, borderRadius: 8, border: `1px solid ${colors.accent}40`, marginBottom: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={autoConfigStrategy}
                  onChange={(e) => setAutoConfigStrategy(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    border: `1px solid ${colors.border}`,
                    borderRadius: 6,
                    fontSize: 11,
                    background: "white",
                  }}
                >
                  <option value="lowest_cost">Optimize: Lowest Cost</option>
                  <option value="fewest_boards">Optimize: Fewest Boards</option>
                  <option value="max_safety">Optimize: Max Safety Factor</option>
                </select>
                <button
                  onClick={autoConfigure}
                  style={{
                    padding: "7px 16px",
                    background: colors.accent,
                    color: colors.primary,
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Auto Configure
                </button>
              </div>
              <div style={{ fontSize: 10, color: colors.textLight, marginTop: 6 }}>
                Finds the best species and dimensions from your inventory to meet the {design.targetLoad.toLocaleString()} lb target.
              </div>
            </div>
          )}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0 0 0",
              fontSize: 12,
              fontWeight: 600,
              color: colors.primary,
              marginTop: 4,
            }}
          >
            <span style={{ transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>&#9654;</span>
            Advanced Settings
          </button>
          {showAdvanced && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.textLight, textTransform: "uppercase", letterSpacing: 0.5 }}>Conditions</div>
              <Select
                label="Moisture Content (VT adjusted)"
                value={design.mc}
                onChange={(v) => ud("mc", v)}
                options={Object.entries(MOISTURE_FACTORS).map(([k, v]) => ({ value: k, label: v.label }))}
              />
              <Select
                label="Temperature Environment"
                value={design.temp}
                onChange={(v) => ud("temp", v)}
                options={Object.entries(TEMP_FACTORS).map(([k, v]) => ({ value: k, label: v.label }))}
              />
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.textLight, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 }}>Fasteners (VT Research)</div>
              <Select
                label="Fastener Type"
                value={design.fastenerType}
                onChange={(v) => ud("fastenerType", v)}
                options={Object.entries(FASTENER_TYPES).map(([k, v]) => ({
                  value: k,
                  label: `${v.name} (${(v.durabilityMult * 100).toFixed(0)}% dur.)`,
                }))}
              />
              <Checkbox
                label="Leading Edge Reinforcement (+30% durability)"
                checked={design.leadingEdgeReinforcement}
                onChange={(v) => ud("leadingEdgeReinforcement", v)}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Right panel - Visuals & Analysis */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Compact status bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 16px",
          background: "white",
          borderRadius: 10,
          border: `1px solid ${colors.border}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          flexWrap: "wrap",
        }}>
          {/* Load vs Target */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: parseFloat(safetyFactor) >= 2 ? colors.success : parseFloat(safetyFactor) >= 1 ? colors.warning : colors.danger,
              display: "inline-block", flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 11, color: colors.textLight, fontWeight: 600, lineHeight: 1 }}>Load</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: colors.text, lineHeight: 1.2 }}>
                {capacity.maxLoad.toLocaleString()} <span style={{ fontSize: 10, fontWeight: 400, color: colors.textLight }}>/ {design.targetLoad.toLocaleString()} lbs</span>
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 28, background: colors.border, flexShrink: 0 }} />

          {/* Safety Factor */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Badge color={parseFloat(safetyFactor) >= 2 ? colors.success : parseFloat(safetyFactor) >= 1 ? colors.warning : colors.danger}>
              {parseFloat(safetyFactor) >= 2 ? "STRONG" : parseFloat(safetyFactor) >= 1 ? "ADEQUATE" : "WEAK"}
            </Badge>
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{safetyFactor}x</span>
          </div>

          <div style={{ width: 1, height: 28, background: colors.border, flexShrink: 0 }} />

          {/* Durability */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: durability > 200 ? colors.success : durability > 100 ? colors.warning : colors.danger,
              display: "inline-block", flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 11, color: colors.textLight, fontWeight: 600, lineHeight: 1 }}>Durability</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: colors.text, lineHeight: 1.2 }}>
                {durability} <span style={{ fontSize: 10, fontWeight: 400, color: colors.textLight }}>handlings</span>
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 28, background: colors.border, flexShrink: 0 }} />

          {/* Cost */}
          <div>
            <div style={{ fontSize: 11, color: colors.textLight, fontWeight: 600, lineHeight: 1 }}>Est. Cost</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: colors.primary, lineHeight: 1.2 }}>${cost.total}</div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Species group badge */}
          <Badge color={colors.primaryLight}>{sp?.group || "N/A"}</Badge>
        </div>

        {/* Visual rendering — primary view + thumbnail strip */}
        <Card>
          {/* View label + toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: colors.primary }}>
              {{ top: "Top View", end: "End View", bottom: "Bottom View", side: "Side Profile" }[activeView]}
            </div>
          </div>

          {/* Toolbar — contextual per view */}
          {activeView === "top" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={handleAddTopBoard} style={{ padding: "6px 12px", background: colors.success, color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ Add Board</button>
              <button onClick={handleRemoveTopBoards} disabled={topSelectedIndices.size === 0} style={{ padding: "6px 12px", background: topSelectedIndices.size > 0 ? colors.danger : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: topSelectedIndices.size > 0 ? "pointer" : "not-allowed", opacity: topSelectedIndices.size > 0 ? 1 : 0.5 }}>Remove Selected ({topSelectedIndices.size})</button>
              <button onClick={handleSpaceEvenlyTop} disabled={topSelectedIndices.size < 2} style={{ padding: "6px 12px", background: topSelectedIndices.size >= 2 ? "#8b5cf6" : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: topSelectedIndices.size >= 2 ? "pointer" : "not-allowed", opacity: topSelectedIndices.size >= 2 ? 1 : 0.5 }}>Space Evenly</button>
              <button onClick={() => { pushUndo(design); setDesign((p) => ({ ...p, topBoardPositions: null })); setTopSelectedIndices(new Set()); }} style={{ padding: "6px 12px", background: colors.primary, color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Reset Even</button>
              <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ padding: "6px 12px", background: undoStack.length > 0 ? "#6b7280" : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: undoStack.length > 0 ? "pointer" : "not-allowed", opacity: undoStack.length > 0 ? 1 : 0.5 }}>Undo ({undoStack.length})</button>
            </div>
          )}
          {activeView === "end" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={handleAddStringer} style={{ padding: "6px 12px", background: colors.success, color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ Add Stringer</button>
              <button onClick={handleRemoveStringers} disabled={stringerSelectedIndices.size === 0} style={{ padding: "6px 12px", background: stringerSelectedIndices.size > 0 ? colors.danger : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: stringerSelectedIndices.size > 0 ? "pointer" : "not-allowed", opacity: stringerSelectedIndices.size > 0 ? 1 : 0.5 }}>Remove Selected ({stringerSelectedIndices.size})</button>
              <button onClick={handleSpaceEvenlyStringers} disabled={stringerSelectedIndices.size < 2} style={{ padding: "6px 12px", background: stringerSelectedIndices.size >= 2 ? "#8b5cf6" : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: stringerSelectedIndices.size >= 2 ? "pointer" : "not-allowed", opacity: stringerSelectedIndices.size >= 2 ? 1 : 0.5 }}>Space Evenly</button>
              <button onClick={() => { pushUndo(design); setDesign((p) => ({ ...p, stringerPositions: null })); setStringerSelectedIndices(new Set()); }} style={{ padding: "6px 12px", background: colors.primary, color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Reset Even</button>
              <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ padding: "6px 12px", background: undoStack.length > 0 ? "#6b7280" : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: undoStack.length > 0 ? "pointer" : "not-allowed", opacity: undoStack.length > 0 ? 1 : 0.5 }}>Undo ({undoStack.length})</button>
            </div>
          )}
          {activeView === "bottom" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={handleAddBottomBoard} style={{ padding: "6px 12px", background: colors.success, color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ Add Board</button>
              <button onClick={handleRemoveBottomBoards} disabled={bottomSelectedIndices.size === 0} style={{ padding: "6px 12px", background: bottomSelectedIndices.size > 0 ? colors.danger : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: bottomSelectedIndices.size > 0 ? "pointer" : "not-allowed", opacity: bottomSelectedIndices.size > 0 ? 1 : 0.5 }}>Remove Selected ({bottomSelectedIndices.size})</button>
              <button onClick={handleSpaceEvenlyBottom} disabled={bottomSelectedIndices.size < 2} style={{ padding: "6px 12px", background: bottomSelectedIndices.size >= 2 ? "#8b5cf6" : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: bottomSelectedIndices.size >= 2 ? "pointer" : "not-allowed", opacity: bottomSelectedIndices.size >= 2 ? 1 : 0.5 }}>Space Evenly</button>
              <button onClick={() => { pushUndo(design); setDesign((p) => ({ ...p, bottomBoardPositions: null })); setBottomSelectedIndices(new Set()); }} style={{ padding: "6px 12px", background: colors.primary, color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Reset Even</button>
              <button onClick={handleUndo} disabled={undoStack.length === 0} style={{ padding: "6px 12px", background: undoStack.length > 0 ? "#6b7280" : "#ccc", color: "white", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: undoStack.length > 0 ? "pointer" : "not-allowed", opacity: undoStack.length > 0 ? 1 : 0.5 }}>Undo ({undoStack.length})</button>
            </div>
          )}

          {/* Selection spec panels — contextual per view */}
          {activeView === "top" && topSelectedIndices.size > 0 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", background: "#eef2ff", borderRadius: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: colors.primary }}>{topSelectedIndices.size} board{topSelectedIndices.size > 1 ? "s" : ""} selected</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>Thickness:</label>
                <SpecInput value={design.deckThickness} min={0.375} max={2} step={0.0625} onChange={(v) => ud("deckThickness", v)} />
                <span style={{ fontSize: 10, color: colors.textLight }}>in</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>Width:</label>
                <SpecInput value={design.deckWidth} min={2} max={8} step={0.25} onChange={(v) => ud("deckWidth", v)} />
                <span style={{ fontSize: 10, color: colors.textLight }}>in</span>
              </div>
              <span style={{ fontSize: 10, color: colors.primary, fontStyle: "italic" }}>Changes apply to all deck boards</span>
            </div>
          )}
          {activeView === "end" && stringerSelectedIndices.size > 0 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", background: "#fef3e2", borderRadius: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>{stringerSelectedIndices.size} stringer{stringerSelectedIndices.size > 1 ? "s" : ""} selected</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>Width:</label>
                <SpecInput value={design.stringerWidth} min={1} max={4} step={0.25} onChange={(v) => ud("stringerWidth", v)} />
                <span style={{ fontSize: 10, color: colors.textLight }}>in</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>Height:</label>
                <SpecInput value={design.stringerHeight} min={2} max={6} step={0.25} onChange={(v) => ud("stringerHeight", v)} />
                <span style={{ fontSize: 10, color: colors.textLight }}>in</span>
              </div>
              <span style={{ fontSize: 10, color: "#92400e", fontStyle: "italic" }}>Changes apply to all stringers</span>
            </div>
          )}
          {activeView === "bottom" && bottomSelectedIndices.size > 0 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", background: "#eef2ff", borderRadius: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: colors.primary }}>{bottomSelectedIndices.size} board{bottomSelectedIndices.size > 1 ? "s" : ""} selected</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>Thickness:</label>
                <SpecInput value={design.deckThickness} min={0.375} max={2} step={0.0625} onChange={(v) => ud("deckThickness", v)} />
                <span style={{ fontSize: 10, color: colors.textLight }}>in</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>Width:</label>
                <SpecInput value={design.deckWidth} min={2} max={8} step={0.25} onChange={(v) => ud("deckWidth", v)} />
                <span style={{ fontSize: 10, color: colors.textLight }}>in</span>
              </div>
              <span style={{ fontSize: 10, color: colors.primary, fontStyle: "italic" }}>Changes apply to all deck boards</span>
            </div>
          )}

          {/* Main canvas — only one visible at a time */}
          {activeView === "top" && (
            <InteractiveTopCanvas
              design={design}
              onBoardPositionsChange={handleTopPositionsChange}
              selectedIndices={topSelectedIndices}
              onSelectionChange={setTopSelectedIndices}
            />
          )}
          {activeView === "end" && (
            <InteractiveSideCanvas
              design={design}
              onStringerPositionsChange={handleStringerPositionsChange}
              selectedIndices={stringerSelectedIndices}
              onSelectionChange={setStringerSelectedIndices}
            />
          )}
          {activeView === "bottom" && (
            <InteractiveBottomCanvas
              design={design}
              onBoardPositionsChange={handleBottomPositionsChange}
              selectedIndices={bottomSelectedIndices}
              onSelectionChange={setBottomSelectedIndices}
            />
          )}
          {activeView === "side" && (
            <EndViewCanvas design={design} />
          )}

          {/* Thumbnail strip */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}` }}>
            {[
              { id: "top", label: "Top" },
              { id: "end", label: "End" },
              { id: "bottom", label: "Bottom" },
              { id: "side", label: "Side" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  border: activeView === v.id ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  borderRadius: 8,
                  background: activeView === v.id ? `${colors.primary}08` : "#fafafa",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                }}
              >
                <div style={{
                  fontSize: 11,
                  fontWeight: activeView === v.id ? 700 : 500,
                  color: activeView === v.id ? colors.primary : colors.textLight,
                }}>
                  {v.label}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Cost breakdown */}
        <Card title="Cost Breakdown">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, fontSize: 13 }}>
            <div><div style={{ fontWeight: 600, color: colors.textLight, fontSize: 11 }}>Lumber</div><div style={{ fontWeight: 700 }}>${cost.lumberCost}</div><div style={{ fontSize: 11, color: colors.textLight }}>{cost.totalBF} BF</div></div>
            <div><div style={{ fontWeight: 600, color: colors.textLight, fontSize: 11 }}>Fasteners</div><div style={{ fontWeight: 700 }}>${cost.fastenerCost}</div><div style={{ fontSize: 11, color: colors.textLight }}>{cost.totalNails} nails</div></div>
            <div><div style={{ fontWeight: 600, color: colors.textLight, fontSize: 11 }}>Labor</div><div style={{ fontWeight: 700 }}>${cost.laborCost}</div></div>
            <div><div style={{ fontWeight: 600, color: colors.textLight, fontSize: 11 }}>Overhead</div><div style={{ fontWeight: 700 }}>${cost.overhead}</div></div>
            <div><div style={{ fontWeight: 600, color: colors.accent, fontSize: 11 }}>TOTAL</div><div style={{ fontWeight: 800, fontSize: 18, color: colors.primary }}>${cost.total}</div></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Page: Cost Estimator ───────────────────────────────────────

function CostEstimator() {
  const [species, setSpecies] = useState("Southern Yellow Pine");
  const [qty, setQty] = useState(100);
  const [design, setDesign] = useState({
    palletLength: 48,
    palletWidth: 40,
    deckThickness: 0.625,
    deckWidth: 3.5,
    topDeckBoards: 7,
    bottomDeckBoards: 5,
    stringerWidth: 1.5,
    stringerHeight: 3.5,
    stringerCount: 3,
    fastenerType: "helical_11_5",
    species: "Southern Yellow Pine",
    palletType: "2-Way",
  });

  const ud = (k, v) => setDesign((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    setDesign((p) => ({ ...p, species }));
  }, [species]);

  const cost = calcPalletCost(design);
  const totalOrder = (parseFloat(cost.total) * qty).toFixed(2);
  const volumeDiscount = qty >= 500 ? 0.12 : qty >= 200 ? 0.08 : qty >= 100 ? 0.05 : 0;
  const discountedTotal = (parseFloat(totalOrder) * (1 - volumeDiscount)).toFixed(2);

  // Compare species costs
  const speciesComparison = ALL_SPECIES.map((sp) => {
    const c = calcPalletCost({ ...design, species: sp.name });
    return { name: sp.name, group: sp.group, cost: parseFloat(c.total), bf: parseFloat(c.totalBF) };
  }).sort((a, b) => a.cost - b.cost);

  const maxCost = Math.max(...speciesComparison.map((s) => s.cost));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Order Configuration">
          <Select
            label="Wood Species"
            value={species}
            onChange={setSpecies}
            options={ALL_SPECIES.map((s) => ({ value: s.name, label: `${s.name} ($${s.costPerBF}/BF)` }))}
          />
          <NumberInput label="Order Quantity" value={qty} onChange={setQty} min={1} max={100000} unit="pallets" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <NumberInput label="Length" value={design.palletLength} onChange={(v) => ud("palletLength", v)} min={12} max={120} unit="in" />
            <NumberInput label="Width" value={design.palletWidth} onChange={(v) => ud("palletWidth", v)} min={12} max={120} unit="in" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <NumberInput label="Deck Thickness" value={design.deckThickness} onChange={(v) => ud("deckThickness", v)} min={0.375} max={2} step={0.0625} unit="in" />
            <NumberInput label="Deck Width" value={design.deckWidth} onChange={(v) => ud("deckWidth", v)} min={2} max={8} step={0.25} unit="in" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <NumberInput label="Top Boards" value={design.topDeckBoards} onChange={(v) => ud("topDeckBoards", v)} min={3} max={20} />
            <NumberInput label="Bottom Boards" value={design.bottomDeckBoards} onChange={(v) => ud("bottomDeckBoards", v)} min={0} max={15} />
          </div>
          <NumberInput label="Stringers" value={design.stringerCount} onChange={(v) => ud("stringerCount", v)} min={2} max={7} />
          <Select
            label="Fastener Type"
            value={design.fastenerType}
            onChange={(v) => ud("fastenerType", v)}
            options={Object.entries(FASTENER_TYPES).map(([k, v]) => ({
              value: k,
              label: `${v.name} ($${v.costPer}/nail)`,
            }))}
          />
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Card><Stat label="Unit Cost" value={`$${cost.total}`} color={colors.primary} /></Card>
          <Card><Stat label="Order Total" value={`$${Number(totalOrder).toLocaleString()}`} color={colors.warning} /></Card>
          <Card><Stat label="Volume Discount" value={`${(volumeDiscount * 100).toFixed(0)}%`} color={colors.success} /></Card>
          <Card><Stat label="Final Total" value={`$${Number(discountedTotal).toLocaleString()}`} color={colors.success} /></Card>
        </div>

        <Card title="Unit Cost Breakdown">
          <div style={{ display: "flex", gap: 12, alignItems: "end", height: 120, padding: "0 20px" }}>
            {[
              { label: "Lumber", val: parseFloat(cost.lumberCost), color: colors.wood },
              { label: "Fasteners", val: parseFloat(cost.fastenerCost), color: colors.primary },
              { label: "Labor", val: parseFloat(cost.laborCost), color: colors.primaryLight },
              { label: "Overhead", val: parseFloat(cost.overhead), color: colors.textLight },
            ].map((b) => (
              <div key={b.label} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    height: `${(b.val / parseFloat(cost.total)) * 100}px`,
                    background: b.color,
                    borderRadius: "4px 4px 0 0",
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 4,
                    color: "white",
                    fontSize: 11,
                    fontWeight: 700,
                    minHeight: 24,
                  }}
                >
                  ${b.val.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: colors.textLight }}>{b.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Species Cost Comparison (same design)">
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {speciesComparison.slice(0, 10).map((s, i) => (
              <div
                key={s.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "6px 0",
                  borderBottom: `1px solid ${colors.border}20`,
                }}
              >
                <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: colors.textLight }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: colors.textLight }}>{s.group}</div>
                </div>
                <div style={{ width: 200 }}>
                  <div
                    style={{
                      height: 8,
                      background: s.name === species ? colors.accent : colors.border,
                      borderRadius: 4,
                      width: `${(s.cost / maxCost) * 100}%`,
                    }}
                  />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.name === species ? colors.accent : colors.primary, width: 60, textAlign: "right" }}>
                  ${s.cost.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Page: VT Research ──────────────────────────────────────────

function Research() {
  const [tab, setTab] = useState("species");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {[
            { id: "species", label: "Wood Species Database" },
            { id: "fasteners", label: "Fastener Research" },
            { id: "moisture", label: "Moisture & Temp Effects" },
            { id: "durability", label: "Durability Data" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 16px",
                border: `1px solid ${tab === t.id ? colors.primary : colors.border}`,
                borderRadius: 6,
                background: tab === t.id ? colors.primary : "white",
                color: tab === t.id ? "white" : colors.text,
                fontWeight: tab === t.id ? 700 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: colors.textLight, marginBottom: 16, fontStyle: "italic" }}>
          Data sourced from Virginia Tech Center for Packaging & Unit Load Design (CPULD) research, USDA Wood Handbook, and NWPCA Uniform Standard for Wood Pallets.
        </div>

        {tab === "species" && (
          <div>
            <h4 style={{ margin: "0 0 12px", color: colors.primary }}>Hardwood Species</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
              <thead>
                <tr style={{ background: colors.primary, color: "white" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Species</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>PDS Group</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Specific Gravity</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>MOE (M psi)</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>MOR (psi)</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Cost/BF</th>
                </tr>
              </thead>
              <tbody>
                {VT_WOOD_SPECIES.hardwoods.map((s, i) => (
                  <tr key={s.name} style={{ background: i % 2 ? "#f9f7f2" : "white", borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}><Badge color={colors.success}>{s.group}</Badge></td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{s.sg}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{(s.moe / 1000000).toFixed(2)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{s.mor.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>${s.costPerBF.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ margin: "0 0 12px", color: colors.primary }}>Softwood Species</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: colors.primaryLight, color: "white" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Species</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>PDS Group</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Specific Gravity</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>MOE (M psi)</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>MOR (psi)</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Cost/BF</th>
                </tr>
              </thead>
              <tbody>
                {VT_WOOD_SPECIES.softwoods.map((s, i) => (
                  <tr key={s.name} style={{ background: i % 2 ? "#f9f7f2" : "white", borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}><Badge color={colors.primaryLight}>{s.group}</Badge></td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{s.sg}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{(s.moe / 1000000).toFixed(2)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{s.mor.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>${s.costPerBF.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "fasteners" && (
          <div>
            <div style={{ background: "#f8f5ef", padding: 16, borderRadius: 8, marginBottom: 20, border: `1px solid ${colors.border}` }}>
              <h4 style={{ margin: "0 0 8px", color: colors.primary }}>Key VT CPULD Finding</h4>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                11.5 gauge nails produced <strong>85.6% more durable pallets</strong> than 12.5 gauge nails, effectively
                <strong> doubling pallet life</strong>. The cumulative effect of all design characteristics studied resulted
                in more than a <strong>500% change in durability</strong>.
              </p>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: colors.primary, color: "white" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Fastener Type</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Withdrawal Index</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Shear Index</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Durability Multiplier</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Cost/Unit</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(FASTENER_TYPES).map((f, i) => (
                  <tr key={f.name} style={{ background: i % 2 ? "#f9f7f2" : "white", borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{f.name}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{f.withdrawalIndex.toFixed(2)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{f.shearIndex.toFixed(2)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <Badge color={f.durabilityMult > 1.5 ? colors.success : f.durabilityMult > 1 ? colors.warning : colors.danger}>
                        {f.durabilityMult.toFixed(2)}x
                      </Badge>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>${f.costPer.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20 }}>
              <h4 style={{ color: colors.primary, margin: "0 0 8px" }}>Nail Types Explained (VT Research)</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { name: "Helically Threaded", desc: "Continuous spiral threads along shank. Best balance of withdrawal resistance and ease of driving." },
                  { name: "Annularly Threaded", desc: "Series of rings along shank that grip wood. Highest withdrawal resistance for nail-type fasteners." },
                  { name: "Plain Shank", desc: "Smooth shank, lowest cost. Adequate for lighter duty pallets but significantly lower durability." },
                ].map((n) => (
                  <div key={n.name} style={{ background: "#f8f5ef", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{n.name}</div>
                    <div style={{ fontSize: 12, color: colors.textLight, lineHeight: 1.5 }}>{n.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "moisture" && (
          <div>
            <h4 style={{ margin: "0 0 12px", color: colors.primary }}>Moisture Content Effects on Wood Properties</h4>
            <p style={{ fontSize: 13, color: colors.textLight, lineHeight: 1.6, margin: "0 0 16px" }}>
              VT research shows that moisture content at time of assembly significantly impacts both strength and
              durability. Used dry oak deckboards were 47% stronger and 23% stiffer than green new oak. Kiln dried
              lumber at assembly also improves fastener holding power.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
              <thead>
                <tr style={{ background: colors.primary, color: "white" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Condition</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Strength Factor</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Stiffness Factor</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Effect</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MOISTURE_FACTORS).map(([k, v], i) => (
                  <tr key={k} style={{ background: i % 2 ? "#f9f7f2" : "white", borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{v.label}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{v.strength.toFixed(2)}x</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{v.stiffness.toFixed(2)}x</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <Badge color={v.strength >= 1 ? colors.success : v.strength >= 0.75 ? colors.warning : colors.danger}>
                        {v.strength >= 1 ? "Optimal" : v.strength >= 0.75 ? "Moderate" : "Significant Loss"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ margin: "0 0 12px", color: colors.primary }}>Temperature Effects on Wood Properties</h4>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: colors.primaryLight, color: "white" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Environment</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Adjustment Factor</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TEMP_FACTORS).map(([k, v], i) => (
                  <tr key={k} style={{ background: i % 2 ? "#f9f7f2" : "white", borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{v.label}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{v.factor.toFixed(2)}x</td>
                    <td style={{ padding: "8px 12px", fontSize: 12, color: colors.textLight }}>
                      {k === "frozen" && "Wood gains strength when frozen; good for cold chain"}
                      {k === "cold" && "Slight increase in properties at cold storage temps"}
                      {k === "normal" && "Baseline reference conditions"}
                      {k === "warm" && "10% reduction in load capacity expected"}
                      {k === "hot" && "Significant reduction; consider upgrading species/thickness"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "durability" && (
          <div>
            <div style={{ background: "#f8f5ef", padding: 16, borderRadius: 8, marginBottom: 20, border: `1px solid ${colors.border}` }}>
              <h4 style={{ margin: "0 0 8px", color: colors.primary }}>VT CPULD Durability Research Summary</h4>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                Virginia Tech's FasTrack simulation testing replicates damages occurring over the lifespan of a pallet.
                Research showed that the cumulative effect of design choices produced <strong>more than 500% variation
                in durability</strong>, from 58 damage-free handlings (worst configuration) to 298+ (best configuration).
              </p>
            </div>

            <h4 style={{ margin: "0 0 12px", color: colors.primary }}>Key Durability Factors (VT Research Rankings)</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { factor: "Wood Species (Specific Gravity)", impact: "Very High", desc: "Higher SG = denser wood = better nail holding and impact resistance", pct: 95 },
                { factor: "Fastener Type & Gauge", impact: "Very High", desc: "11.5ga helical nails double pallet life vs 12.5ga", pct: 90 },
                { factor: "Moisture Content at Assembly", impact: "High", desc: "Kiln dried lumber provides 25% better durability than green", pct: 80 },
                { factor: "Leading Edge Reinforcement", impact: "High", desc: "Reinforced leading deckboards add ~30% more handlings", pct: 75 },
                { factor: "Deck Board Thickness", impact: "Moderate", desc: "Thicker boards resist forklift tine damage better", pct: 60 },
                { factor: "Number of Fasteners", impact: "Moderate", desc: "More nails per joint improves deckboard attachment", pct: 55 },
                { factor: "Stringer/Block Design", impact: "Moderate", desc: "Block pallets generally more durable than stringer in 4-way use", pct: 50 },
              ].map((f) => (
                <div key={f.factor} style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, background: "#f9f7f2", borderRadius: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.factor}</div>
                    <div style={{ fontSize: 11, color: colors.textLight }}>{f.desc}</div>
                  </div>
                  <Badge color={f.pct > 80 ? colors.danger : f.pct > 60 ? colors.warning : colors.primaryLight}>{f.impact}</Badge>
                  <div style={{ width: 120 }}>
                    <ProgressBar value={f.pct} max={100} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Page: Customer Quote Portal ────────────────────────────────

function QuotePortal({ setPage }) {
  const [step, setStep] = useState(1);
  const [quote, setQuote] = useState({
    size: "GMA (48x40)",
    length: 48,
    width: 40,
    loadWeight: 2500,
    usage: "warehouse",
    mc: "kiln_dried",
    temp: "normal",
    qty: 100,
  });

  const uq = (k, v) => setQuote((p) => ({ ...p, [k]: v }));

  // Auto-recommend species based on usage
  const recommended = useMemo(() => {
    if (quote.loadWeight > 3000) return "Red Oak";
    if (quote.usage === "export") return "Southern Yellow Pine";
    if (quote.usage === "cold_chain") return "Spruce (SPF)";
    return "Southern Yellow Pine";
  }, [quote.loadWeight, quote.usage]);

  const sp = ALL_SPECIES.find((s) => s.name === recommended);
  const design = {
    palletLength: quote.length,
    palletWidth: quote.width,
    deckThickness: quote.loadWeight > 3000 ? 0.75 : 0.625,
    deckWidth: 3.5,
    topDeckBoards: 7,
    bottomDeckBoards: 5,
    stringerWidth: 1.5,
    stringerHeight: 3.5,
    stringerCount: 3,
    fastenerType: "helical_11_5",
    species: recommended,
    palletType: "2-Way",
  };
  const cost = calcPalletCost(design);
  const durability = calcDurabilityScore(recommended, quote.mc, "helical_11_5", true);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 8px", color: colors.primary }}>Get a Pallet Quote</h2>
          <p style={{ margin: 0, color: colors.textLight, fontSize: 14 }}>
            Powered by Virginia Tech CPULD research data for optimal design recommendations
          </p>
        </div>

        {/* Progress steps */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: step >= s ? colors.primary : colors.border,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h3 style={{ margin: "0 0 16px", color: colors.primary }}>Step 1: Pallet Requirements</h3>
            <Select
              label="Standard Size"
              value={quote.size}
              onChange={(v) => {
                uq("size", v);
                const s = STANDARD_SIZES.find((sz) => sz.name === v);
                if (s && s.length > 0) {
                  uq("length", s.length);
                  uq("width", s.width);
                }
              }}
              options={STANDARD_SIZES.filter((s) => s.name !== "Custom").map((s) => ({
                value: s.name,
                label: s.name,
              }))}
            />
            <NumberInput label="Expected Load Weight" value={quote.loadWeight} onChange={(v) => uq("loadWeight", v)} min={100} max={50000} unit="lbs" />
            <Select
              label="Primary Usage"
              value={quote.usage}
              onChange={(v) => uq("usage", v)}
              options={[
                { value: "warehouse", label: "Warehouse / Distribution" },
                { value: "shipping", label: "Domestic Shipping" },
                { value: "export", label: "Export / International (ISPM-15)" },
                { value: "cold_chain", label: "Cold Chain / Refrigerated" },
                { value: "heavy_duty", label: "Heavy Duty / Industrial" },
              ]}
            />
            <NumberInput label="Quantity Needed" value={quote.qty} onChange={(v) => uq("qty", v)} min={1} max={100000} unit="pallets" />
            <button
              onClick={() => setStep(2)}
              style={{
                width: "100%",
                padding: 12,
                background: colors.primary,
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Get Recommendation
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ margin: "0 0 16px", color: colors.primary }}>Step 2: Our Recommendation</h3>
            <div style={{ background: "#f8f5ef", padding: 20, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: colors.textLight }}>Recommended Species</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: colors.primary }}>{recommended}</div>
                  <Badge color={colors.success}>{sp?.group}</Badge>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: colors.textLight }}>Est. Durability</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: colors.success }}>{durability} handlings</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: colors.textLight }}>Unit Price</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: colors.accent }}>${cost.total}</div>
                </div>
              </div>
            </div>
            <PalletCanvas design={design} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: 12,
                  background: "white",
                  color: colors.primary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 2,
                  padding: 12,
                  background: colors.primary,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Request Full Quote
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: colors.success,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                margin: "0 auto 16px",
              }}
            >
              ✓
            </div>
            <h3 style={{ margin: "0 0 8px", color: colors.primary }}>Quote Request Submitted!</h3>
            <p style={{ color: colors.textLight, fontSize: 14, margin: "0 0 24px" }}>
              Our team will review your requirements and send a detailed quote within 24 hours.
            </p>
            <div style={{ background: "#f8f5ef", padding: 16, borderRadius: 8, display: "inline-block", textAlign: "left" }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Size:</strong> {quote.length}" x {quote.width}"</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Load:</strong> {quote.loadWeight.toLocaleString()} lbs</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Species:</strong> {recommended}</div>
              <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Quantity:</strong> {quote.qty.toLocaleString()}</div>
              <div style={{ fontSize: 13 }}><strong>Est. Total:</strong> ${(parseFloat(cost.total) * quote.qty).toLocaleString()}</div>
            </div>
            <button
              onClick={() => { setStep(1); }}
              style={{
                display: "block",
                margin: "24px auto 0",
                padding: "10px 32px",
                background: colors.primary,
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              New Quote
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Page: Catalog ──────────────────────────────────────────────

function Catalog() {
  const designs = [
    { name: "GMA Standard", size: "48x40", type: "Stringer", species: "SYP", load: "2,500 lbs", price: "$7.85" },
    { name: "Heavy Duty", size: "48x40", type: "Block", species: "Red Oak", load: "5,000 lbs", price: "$14.20" },
    { name: "Euro Standard", size: "47.24x31.5", type: "Block", species: "Spruce", load: "2,000 lbs", price: "$9.50" },
    { name: "Industrial", size: "48x48", type: "Stringer", species: "SYP", load: "3,000 lbs", price: "$9.10" },
    { name: "Export (HT)", size: "48x40", type: "Stringer", species: "SYP", load: "2,500 lbs", price: "$8.95" },
    { name: "Cold Chain", size: "48x40", type: "Block", species: "SPF", load: "2,000 lbs", price: "$10.30" },
  ];

  return (
    <div>
      <Card title="Standard Pallet Catalog">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {designs.map((d) => (
            <div
              key={d.name}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: 16,
                background: "#f9f7f2",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, color: colors.primary, marginBottom: 8 }}>{d.name}</div>
              <div style={{ fontSize: 13, color: colors.textLight, lineHeight: 1.8 }}>
                <div><strong>Size:</strong> {d.size}"</div>
                <div><strong>Type:</strong> {d.type}</div>
                <div><strong>Species:</strong> {d.species}</div>
                <div><strong>Load Rating:</strong> {d.load}</div>
              </div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: colors.accent }}>{d.price}</span>
                <Badge color={colors.success}>In Stock</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Settings / Inventory Manager ────────────────────────────────

const DEFAULT_THICKNESSES = [0.375, 0.5, 0.625, 0.75, 1.0, 1.5, 2.0];
const DEFAULT_WIDTHS = [2.5, 3.0, 3.5, 4.0, 4.5, 5.5, 6.0, 7.25];

function Settings({ inventory, setInventory }) {
  const [addingSpecies, setAddingSpecies] = useState("");

  const stocked = inventory.filter((s) => s.enabled);
  const available = ALL_SPECIES.filter((sp) => !inventory.some((i) => i.name === sp.name));

  const addSpecies = () => {
    if (!addingSpecies) return;
    const sp = ALL_SPECIES.find((s) => s.name === addingSpecies);
    if (!sp || inventory.some((i) => i.name === sp.name)) return;
    setInventory([...inventory, {
      name: sp.name,
      type: sp.type,
      group: sp.group,
      enabled: true,
      costPerBF: sp.costPerBF,
      thicknesses: [0.625, 0.75],
      widths: [3.5, 5.5],
      stringerWidths: [1.5, 3.5],
      stringerHeights: [3.5],
    }]);
    setAddingSpecies("");
  };

  const removeSpecies = (name) => {
    setInventory(inventory.filter((i) => i.name !== name));
  };

  const toggleDimension = (speciesName, dimType, value) => {
    setInventory(inventory.map((item) => {
      if (item.name !== speciesName) return item;
      const arr = item[dimType];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value].sort((a, b) => a - b);
      return { ...item, [dimType]: next };
    }));
  };

  const DimToggle = ({ active, label, onClick }) => (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        border: `1.5px solid ${active ? colors.primary : colors.border}`,
        borderRadius: 6,
        background: active ? colors.primary : "white",
        color: active ? "white" : colors.text,
        cursor: "pointer",
        fontSize: 11,
        fontWeight: active ? 700 : 400,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card title="Lumber Inventory">
        <p style={{ fontSize: 13, color: colors.textLight, marginBottom: 16, marginTop: 0 }}>
          Add the wood species you stock and select the board thicknesses, widths, and stringer dimensions available for each.
          The Pallet Designer will filter options to only show what you carry.
        </p>

        {/* Add species */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, padding: 12, background: "#f8f5ef", borderRadius: 8 }}>
          <select
            value={addingSpecies}
            onChange={(e) => setAddingSpecies(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize: 13,
              background: "white",
            }}
          >
            <option value="">Select a species to add...</option>
            <optgroup label="Hardwoods">
              {available.filter((s) => s.type === "Hardwood").map((s) => (
                <option key={s.name} value={s.name}>{s.name} ({s.group})</option>
              ))}
            </optgroup>
            <optgroup label="Softwoods">
              {available.filter((s) => s.type === "Softwood").map((s) => (
                <option key={s.name} value={s.name}>{s.name} ({s.group})</option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={addSpecies}
            disabled={!addingSpecies}
            style={{
              padding: "8px 20px",
              background: addingSpecies ? colors.primary : colors.border,
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 13,
              cursor: addingSpecies ? "pointer" : "not-allowed",
            }}
          >
            + Add Species
          </button>
        </div>

        {/* Species list */}
        {inventory.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: colors.textLight, fontSize: 14 }}>
            No species added yet. Add your stocked lumber above to get started.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {inventory.map((item) => {
            const sp = ALL_SPECIES.find((s) => s.name === item.name);
            return (
              <div
                key={item.name}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: 16,
                  background: "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: colors.primary }}>{item.name}</span>
                    <Badge color={item.type === "Hardwood" ? colors.accent : colors.success} style={{ marginLeft: 8 }}>{item.type} | {item.group}</Badge>
                    {sp && (
                      <span style={{ fontSize: 11, color: colors.textLight, marginLeft: 10 }}>
                        SG: {sp.sg} | MOE: {(sp.moe / 1e6).toFixed(2)}M | MOR: {sp.mor.toLocaleString()} psi
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeSpecies(item.name)}
                    style={{
                      padding: "4px 12px",
                      border: `1px solid ${colors.danger}`,
                      borderRadius: 6,
                      background: "white",
                      color: colors.danger,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Remove
                  </button>
                </div>

                {/* Cost per board foot */}
                <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8f5ef", borderRadius: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.text, whiteSpace: "nowrap" }}>Cost per Board Ft:</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colors.primary }}>$</span>
                    <input
                      type="number"
                      value={item.costPerBF ?? ""}
                      min={0.01}
                      max={99}
                      step={0.05}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setInventory(inventory.map((inv) =>
                          inv.name === item.name ? { ...inv, costPerBF: isNaN(v) ? 0 : v } : inv
                        ));
                      }}
                      style={{
                        width: 70,
                        padding: "5px 8px",
                        border: `1px solid ${colors.border}`,
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>

                {/* Board thicknesses */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Board Thicknesses
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {DEFAULT_THICKNESSES.map((t) => (
                      <DimToggle
                        key={t}
                        active={item.thicknesses.includes(t)}
                        label={`${t}"`}
                        onClick={() => toggleDimension(item.name, "thicknesses", t)}
                      />
                    ))}
                  </div>
                </div>

                {/* Board widths */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Board Widths
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {DEFAULT_WIDTHS.map((w) => (
                      <DimToggle
                        key={w}
                        active={item.widths.includes(w)}
                        label={`${w}"`}
                        onClick={() => toggleDimension(item.name, "widths", w)}
                      />
                    ))}
                  </div>
                </div>

                {/* Stringer dimensions */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: colors.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Stringer Widths
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {[1.125, 1.25, 1.5, 2.0, 2.5, 3.0, 3.5].map((w) => (
                        <DimToggle
                          key={w}
                          active={item.stringerWidths.includes(w)}
                          label={`${w}"`}
                          onClick={() => toggleDimension(item.name, "stringerWidths", w)}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: colors.textLight, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Stringer Heights
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {[2.5, 3.0, 3.5, 4.0, 4.5, 5.5].map((h) => (
                        <DimToggle
                          key={h}
                          active={item.stringerHeights.includes(h)}
                          label={`${h}"`}
                          onClick={() => toggleDimension(item.name, "stringerHeights", h)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── App Root ───────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("designer");
  const [isCustomer, setIsCustomer] = useState(false);
  const [inventory, setInventory] = useState([]);

  const toggleMode = () => {
    setIsCustomer(!isCustomer);
    setPage(isCustomer ? "designer" : "quote");
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: colors.bg, minHeight: "100vh" }}>
      <Nav page={page} setPage={setPage} isCustomer={isCustomer} />

      {/* Mode toggle */}
      <div style={{ padding: "12px 24px", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={toggleMode}
          style={{
            padding: "6px 16px",
            border: `1px solid ${colors.border}`,
            borderRadius: 20,
            background: "white",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            color: colors.primary,
          }}
        >
          Switch to {isCustomer ? "Internal" : "Customer"} View
        </button>
      </div>

      <div style={{ padding: "0 24px 40px" }}>
        {page === "designer" && <Designer inventory={inventory} />}

        {page === "cost" && <CostEstimator />}
        {page === "research" && <Research />}
        {page === "settings" && <Settings inventory={inventory} setInventory={setInventory} />}
        {page === "quote" && <QuotePortal setPage={setPage} />}
        {page === "catalog" && <Catalog />}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 24px",
          borderTop: `1px solid ${colors.border}`,
          textAlign: "center",
          fontSize: 11,
          color: colors.textLight,
        }}
      >
        Gruber Pallets Design System | Wood property data sourced from Virginia Tech CPULD research & USDA Wood Handbook | NWPCA PDS methodology
      </div>
    </div>
  );
}
