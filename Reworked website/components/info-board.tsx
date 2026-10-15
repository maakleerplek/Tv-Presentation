import React from 'react';
import {
  ArrowDown, Bolt, Box as Cube, Brush, CircuitBoard, GraduationCap, HandHelping, Hammer, Layers, Package, Palette,
  Refrigerator, ScanBarcode, Trees, Wallet, Zap, type LucideIcon,
} from 'lucide-react';

const INK = '#2C1E16';
const PAPER = '#F5F2EB';
const ACCENT = '#C8A98B';
/** Free to take, no need to pay. */
const FREE = '#9CB58A';

// Positions come from Ruben's HTL sketch (2000 × 1168 px), so a change to the
// room can be copied from the drawing. Only the hall (sketch y 530–1240) is
// drawn, stretched to fill the panel; the rooms north of it are a label strip.
const X = (x: number) => 8 + (x - 262) * 0.6;
const Y = (y: number) => 34 + (y - 530) * 0.62;

const label = { fill: INK, fontWeight: 900, letterSpacing: 1 } as const;

/** A piece of furniture or a zone: square, TV-style, optional hard shadow, icon and accent fill. */
function Box({ x1, y1, x2, y2, name, sub, vertical, accent, free, icon: Icon, size = 14, shadow }: {
  x1: number; y1: number; x2: number; y2: number;
  name?: string; sub?: string; vertical?: boolean; accent?: boolean; free?: boolean; icon?: LucideIcon; size?: number; shadow?: boolean;
}) {
  const w = X(x2) - X(x1);
  const h = Y(y2) - Y(y1);
  const cx = X(x1) + w / 2;
  const cy = Y(y1) + h / 2;
  const iconSize = Icon ? Math.min(26, h * 0.4) : 0;
  // Vertical text runs through the centre, so its icon goes above the text instead.
  const textY = cy + (Icon && !vertical ? iconSize / 2 + 4 : 0) + (sub ? -3 : size * 0.35);
  const iconY = vertical
    ? cy - (name?.length ?? 0) * size * 0.38 - iconSize - 6
    : cy - iconSize / 2 - (name ? size * 0.6 : 0);
  return (
    <g>
      {shadow && <rect x={X(x1) + 3} y={Y(y1) + 3} width={w} height={h} fill={INK} />}
      <rect x={X(x1)} y={Y(y1)} width={w} height={h} fill={free ? FREE : accent ? ACCENT : '#FFFFFF'} stroke={INK} strokeWidth={2.5} />
      {Icon && (
        <Icon x={cx - iconSize / 2} y={iconY} width={iconSize} height={iconSize}
          color={INK} strokeWidth={2.25} />
      )}
      {name && (
        <text x={cx} y={textY} textAnchor="middle" fontSize={size} {...label}
          transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>{name.toUpperCase()}</text>
      )}
      {sub && (
        <text x={cx} y={textY + 14} textAnchor="middle" fontSize={11} {...label} letterSpacing={0.5}>{sub.toUpperCase()}</text>
      )}
    </g>
  );
}

/** A door: a gap in the wall with a quarter-circle swing. */
function Door({ x, y, w, dir }: { x: number; y: number; w: number; dir: 'down' | 'up' }) {
  const x0 = X(x);
  const y0 = Y(y);
  const r = X(x + w) - x0;
  const s = dir === 'down' ? 1 : -1;
  return (
    <g fill="none" stroke={INK} strokeWidth={2}>
      <line x1={x0} y1={y0} x2={x0} y2={y0 + s * r} />
      <path d={`M${x0} ${y0 + s * r} A${r} ${r} 0 0 ${s > 0 ? 0 : 1} ${x0 + r} ${y0}`} strokeDasharray="3 3" />
    </g>
  );
}

/** The hall, its openings, and what lies beyond them as a strip of labels along the top. */
function Building() {
  const wall = { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'square' as const };
  const strip = { textAnchor: 'middle' as const, fontSize: 17, ...label, letterSpacing: 1 };
  return (
    <g>
      <defs>
        <pattern id="staff-hatch" width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={9} stroke={INK} strokeOpacity={0.25} strokeWidth={2} />
        </pattern>
      </defs>

      {/* Hall, with the entrance, the kantine passage and the staff door in its north wall */}
      <path d={`M${X(655)} ${Y(530)} H${X(270)} V${Y(1240)} H${X(1785)} V${Y(530)} H${X(1650)}`} {...wall} />
      <path d={`M${X(725)} ${Y(530)} H${X(1080)}`} {...wall} />
      <path d={`M${X(1170)} ${Y(530)} H${X(1595)}`} {...wall} />
      <Door x={1595} y={530} w={55} dir="up" />

      <text x={X(690)} y={22} {...strip}>ENTRANCE ↓</text>
      <text x={X(1125)} y={22} {...strip}>↑ KANTINE (ASK FIRST) · TOILETS · CELLAR</text>
      <rect x={X(1655)} y={2} width={X(1785) - X(1655)} height={Y(530) - 6} fill="url(#staff-hatch)" />
      <text x={926} y={22} {...strip} textAnchor="end" fontSize={14}>STAFF ONLY</text>

      {/* The TV */}
      <rect x={X(815)} y={Y(532)} width={X(1000) - X(815)} height={13} fill={INK} />
      <text x={X(908)} y={Y(532) + 10.5} textAnchor="middle" fill={PAPER} fontSize={10} fontWeight={900} letterSpacing={2}>TV</text>
      <rect x={X(1010)} y={Y(532)} width={10} height={13} fill={INK} />
    </g>
  );
}

/** Furniture; the places where you take something carry an icon and their name in the accent colour. */
function Furniture() {
  return (
    <g>
      <Box x1={1370} y1={532} x2={1500} y2={640} name="Drinks" icon={Refrigerator} accent shadow />
      <Box x1={780} y1={565} x2={1070} y2={680} name="Scan & pay here" icon={ScanBarcode} accent shadow />
      <Box x1={285} y1={545} x2={613} y2={705} name="3D printing" icon={Cube} />
      <Box x1={272} y1={730} x2={440} y2={1240} name="Electronics" icon={CircuitBoard} free shadow vertical />
      <Box x1={690} y1={705} x2={1110} y2={975} name="Main table" />
      <Box x1={1160} y1={690} x2={1268} y2={975} name="Display rack" vertical />
      <Box x1={1276} y1={690} x2={1400} y2={975} name="Scrap" sub="wood" icon={Trees} free shadow />
      <Box x1={1160} y1={995} x2={1400} y2={1100} name="Bolts & nuts" icon={Bolt} free shadow />
      <Box x1={1645} y1={540} x2={1783} y2={690} name="Craft" icon={Palette} free shadow />
      <Box x1={1590} y1={745} x2={1783} y2={1175} name="Lasers" icon={Zap} />
      <Box x1={464} y1={1080} x2={764} y2={1240} name="CNC & drill" icon={Hammer} />
      <Box x1={776} y1={1135} x2={1250} y2={1240} name="Workbench" />
      <Box x1={1260} y1={1130} x2={1580} y2={1240} name="Wood supply" icon={Layers} accent shadow />
    </g>
  );
}

function FloorPlan() {
  return (
    <svg viewBox="0 0 930 480" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full" role="img"
      aria-label="Floor plan of the High Tech Lab">
      <Building />
      <Furniture />
    </svg>
  );
}

const BUY_STEPS = [
  { icon: Package, title: 'Take it', text: 'Drinks from the fridge, wood from the supply' },
  { icon: ScanBarcode, title: 'Scan it', text: 'Barcode on the item, scanner right of the TV' },
  { icon: Wallet, title: 'Pay', text: 'Confirm on the kiosk, pay with the Wero QR' },
];

const GOOD_TO_KNOW = [
  { icon: HandHelping, title: 'Ask a volunteer', text: 'They help with your project' },
  { icon: GraduationCap, title: 'New to a machine?', text: 'Ask for an explanation first' },
  { icon: Brush, title: 'Leave it tidy', text: 'Tools back, clean your spot' },
];

/** Floor plan with its legend, permanently bottom right of the TV. */
export function InfoBoard() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-1.5">
      {/* Absolute, so the SVG fills the free space instead of sizing the panel from its width. */}
      <div className="relative flex-1 min-h-0">
        <FloorPlan />
      </div>
      <div className="shrink-0 flex flex-row items-center justify-center gap-2 border-t-2 border-[#2C1E16] pt-1 text-xs font-black uppercase tracking-wider text-[#2C1E16]">
        <span className="w-6 h-4 bg-[#C8A98B] border-2 border-[#2C1E16]" />
        Take it, then pay
        <span className="w-6 h-4 bg-[#9CB58A] border-2 border-[#2C1E16] ml-4" />
        Free to take
      </div>
    </div>
  );
}

/** How to buy, and the house rules, stacked in a column next to the plan. */
export function BuySteps() {
  return (
    <div className="flex flex-col h-full gap-1.5">
      {BUY_STEPS.map((step, i) => (
        <React.Fragment key={step.title}>
          <div className="flex flex-row items-center gap-2 border-2 border-[#2C1E16] bg-white px-2 py-1 shadow-[2px_2px_0_0_#2C1E16]">
            <step.icon className="w-5 h-5 shrink-0 text-[#2C1E16]" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black uppercase tracking-wider text-[#2C1E16] leading-tight">
                {i + 1}. {step.title}
              </span>
              <span className="text-xs font-bold text-[#2C1E16] leading-snug">{step.text}</span>
            </div>
          </div>
          {i < BUY_STEPS.length - 1 && <ArrowDown className="w-4 h-4 -my-1 self-center shrink-0 text-[#2C1E16]" />}
        </React.Fragment>
      ))}
      <div className="flex flex-col gap-1 mt-auto pt-1.5 border-t-2 border-[#2C1E16]">
        {GOOD_TO_KNOW.map(tip => (
          <div key={tip.title} className="flex flex-row items-center gap-2 min-w-0">
            <tip.icon className="w-4 h-4 shrink-0 text-[#2C1E16]" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black uppercase tracking-wider text-[#2C1E16] leading-tight">{tip.title}</span>
              <span className="text-xs font-bold text-[#2C1E16] leading-tight">{tip.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
