import {
  ArrowRight, Bolt, Box as Cube, Brush, CircuitBoard, GraduationCap, HandHelping, Hammer, Layers, Package, Palette,
  Refrigerator, ScanBarcode, Trees, Wallet, Zap, type LucideIcon,
} from 'lucide-react';

const INK = '#2C1E16';
const PAPER = '#F5F2EB';
const ACCENT = '#C8A98B';
/** Free to take, no need to pay. */
const FREE = '#9CB58A';

// Positions come from Ruben's HTL sketch (2000 × 1168 px), so a change to the
// room can be copied from the drawing. The plan is stretched wider than the
// sketch to fill the panel.
const X = (x: number) => 8 + (x - 262) * 0.6;
const Y = (y: number) => 22 + (y - 120) * 0.465;

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
  const textY = cy + (Icon ? iconSize / 2 + 4 : 0) + (sub ? -3 : size * 0.35);
  return (
    <g>
      {shadow && <rect x={X(x1) + 3} y={Y(y1) + 3} width={w} height={h} fill={INK} />}
      <rect x={X(x1)} y={Y(y1)} width={w} height={h} fill={free ? FREE : accent ? ACCENT : '#FFFFFF'} stroke={INK} strokeWidth={2.5} />
      {Icon && (
        <Icon x={cx - iconSize / 2} y={cy - iconSize / 2 - (name ? size * 0.6 : 0)} width={iconSize} height={iconSize}
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

// Material Icons "woman" and "man" (Apache 2.0), 24 × 24.
const WOMAN = 'M13.94 8.31C13.62 7.52 12.85 7 12 7s-1.62.52-1.94 1.31L7 16h3v6h4v-6h3l-3.06-7.69zM12 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z';
const MAN = 'M14 7h-4c-1.1 0-2 .9-2 2v6h2v7h4v-7h2V9c0-1.1-.9-2-2-2zm-2-1c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z';

/** Toilet pictogram, centred on a sketch point. */
function Person({ x, y, woman }: { x: number; y: number; woman?: boolean }) {
  const size = 32;
  return (
    <path d={woman ? WOMAN : MAN} fill={INK}
      transform={`translate(${X(x) - size / 2} ${Y(y) - size / 2}) scale(${size / 24})`} />
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


/** Walls, rooms and the way in. */
function Building() {
  const wall = { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'square' as const };
  const thin = { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'square' as const };
  return (
    <g>
      <defs>
        <pattern id="staff-hatch" width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={9} stroke={INK} strokeOpacity={0.25} strokeWidth={2} />
        </pattern>
      </defs>

      {/* Staff room, door from the hall */}
      <rect x={X(1470)} y={Y(150)} width={X(1785) - X(1470)} height={Y(530) - Y(150)} fill="url(#staff-hatch)" />
      <rect x={X(1540)} y={Y(290)} width={X(1715) - X(1540)} height={34} fill={PAPER} />
      <text x={X(1628)} y={Y(290) + 22} textAnchor="middle" fontSize={14} {...label}>STAFF ONLY</text>


      {/* Hall */}
      <path d={`M${X(655)} ${Y(530)} H${X(270)} V${Y(1240)} H${X(1785)} V${Y(530)} H${X(1650)}`} {...wall} />
      <path d={`M${X(725)} ${Y(530)} H${X(1080)}`} {...wall} />
      <path d={`M${X(1170)} ${Y(530)} H${X(1595)}`} {...wall} />
      <Door x={1595} y={530} w={55} dir="up" />

      {/* Cellar, behind an extra wall: over the top and through the door */}
      <path d={`M${X(1080)} ${Y(530)} V${Y(225)}`} {...wall} />
      <path d={`M${X(1080)} ${Y(130)} H${X(880)} V${Y(530)}`} {...wall} />
      <path d={`M${X(990)} ${Y(225)} H${X(1080)}`} {...thin} />
      <path d={`M${X(880)} ${Y(225)} H${X(900)}`} {...thin} />
      <Door x={900} y={225} w={90} dir="down" />
      <text x={X(980)} y={Y(412)} textAnchor="middle" fontSize={15} {...label}>CELLAR ↓</text>
      <text x={X(980)} y={Y(412) + 18} textAnchor="middle" fontSize={11} {...label} letterSpacing={0.5}>LEAVE PROJECTS</text>
      <text x={X(980)} y={Y(412) + 31} textAnchor="middle" fontSize={11} {...label} letterSpacing={0.5}>HERE FOR</text>
      <text x={X(980)} y={Y(412) + 44} textAnchor="middle" fontSize={11} {...label} letterSpacing={0.5}>A WHILE</text>

      {/* Kantine: the passage north, toilets to the right */}
      <path d={`M${X(1170)} ${Y(530)} V${Y(400)}`} {...wall} />
      <path d={`M${X(1170)} ${Y(310)} V${Y(150)} H${X(1470)} V${Y(530)}`} {...wall} />
      <text x={X(1108)} y={Y(420)} textAnchor="middle" fontSize={14} {...label}
        transform={`rotate(-90 ${X(1108)} ${Y(420)})`}>KANTINE</text>
      <text x={X(1125)} y={Y(118)} textAnchor="middle" fontSize={12} {...label}>↑ KANTINE: ASK FIRST</text>

      {/* Toilets: a hallway, women above, men below */}
      <path d={`M${X(1250)} ${Y(310)} H${X(1470)}`} {...thin} />
      <path d={`M${X(1250)} ${Y(400)} H${X(1470)}`} {...thin} />
      <path d={`M${X(1170)} ${Y(310)} H${X(1200)}`} {...thin} />
      <path d={`M${X(1170)} ${Y(400)} H${X(1200)}`} {...thin} />
      <Person x={1265} y={232} woman />
      <text x={X(1300)} y={Y(232) + 5} fontSize={14} {...label}>WOMEN</text>
      <Person x={1265} y={470} />
      <text x={X(1300)} y={Y(470) + 5} fontSize={14} {...label}>MEN</text>
      <text x={X(1340)} y={Y(355) + 4} textAnchor="middle" fontSize={11} {...label}>TOILETS →</text>

      {/* Entrance and the TV */}
      <text x={X(690)} y={Y(420)} textAnchor="middle" fontSize={14} {...label} letterSpacing={2}>ENTRANCE</text>
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
      <Box x1={780} y1={565} x2={1070} y2={680} name="Scan & pay here" icon={ScanBarcode} accent shadow size={14} />
      <Box x1={285} y1={545} x2={613} y2={705} name="3D printing" icon={Cube} />
      <Box x1={272} y1={730} x2={440} y2={1240} name="Electronics" icon={CircuitBoard} free shadow size={13} />
      <Box x1={690} y1={705} x2={1110} y2={975} name="Main table" />
      <Box x1={1160} y1={690} x2={1268} y2={975} name="Display rack" vertical size={13} />
      <Box x1={1276} y1={690} x2={1400} y2={975} name="Scrap" sub="wood" icon={Trees} free shadow size={13} />
      <Box x1={1160} y1={995} x2={1400} y2={1100} name="Bolts & nuts" icon={Bolt} free shadow size={13} />
      <Box x1={1645} y1={540} x2={1783} y2={690} name="Craft" icon={Palette} free shadow size={13} />
      <Box x1={1590} y1={745} x2={1783} y2={1175} name="Lasers" icon={Zap} size={16} />
      <Box x1={464} y1={1080} x2={764} y2={1240} name="CNC & drill" icon={Hammer} size={15} />
      <Box x1={776} y1={1135} x2={1250} y2={1240} name="Workbench" />
      <Box x1={1260} y1={1130} x2={1580} y2={1240} name="Wood supply" icon={Layers} accent shadow size={13} />
    </g>
  );
}

function FloorPlan() {
  return (
    <svg viewBox="0 0 930 545" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full" role="img"
      aria-label="Floor plan of the High Tech Lab">
      <Building />
      <Furniture />
    </svg>
  );
}

const BUY_STEPS = [
  { icon: Package, title: 'Take it', text: 'Drinks from the fridge, wood from the supply' },
  { icon: ScanBarcode, title: 'Scan it', text: 'Its QR code on this TV, scanner right of the TV' },
  { icon: Wallet, title: 'Pay', text: 'Scan CONFIRM twice, pay with the Wero QR' },
];

const GOOD_TO_KNOW = [
  { icon: HandHelping, title: 'Ask a volunteer', text: 'They help with your project' },
  { icon: GraduationCap, title: 'New to a machine?', text: 'Ask for an explanation first' },
  { icon: Brush, title: 'Leave it tidy', text: 'Tools back, clean your spot' },
];

/** The info page in the inventory cycle: where everything is at HTL and how to buy. */
export function InfoBoard() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Absolute, so the SVG fills the free space instead of sizing the panel from its width. */}
      <div className="relative flex-1 min-h-0">
        <FloorPlan />
      </div>
      <div className="shrink-0 flex flex-row items-center justify-center gap-3 border-y-2 border-[#2C1E16] py-1.5 text-base font-black uppercase tracking-wider text-[#2C1E16]">
        <span className="w-8 h-5 bg-[#C8A98B] border-2 border-[#2C1E16]" />
        Take it, then pay at the TV
        <span className="w-8 h-5 bg-[#9CB58A] border-2 border-[#2C1E16] ml-6" />
        Free to take
      </div>
      <div className="shrink-0 flex flex-row items-stretch gap-2">
        {BUY_STEPS.map((step, i) => (
          <div key={step.title} className="flex flex-row items-center gap-2 flex-1 min-w-0">
            <div className="flex flex-row items-center gap-3 flex-1 min-w-0 border-2 border-[#2C1E16] bg-white px-3 py-2 shadow-[2px_2px_0_0_#2C1E16]">
              <step.icon className="w-7 h-7 shrink-0 text-[#2C1E16]" />
              <div className="flex flex-col min-w-0">
                <span className="text-base font-black uppercase tracking-wider text-[#2C1E16] leading-tight">
                  {i + 1}. {step.title}
                </span>
                <span className="text-sm font-bold text-[#2C1E16] leading-snug">{step.text}</span>
              </div>
            </div>
            {i < BUY_STEPS.length - 1 && <ArrowRight className="w-5 h-5 shrink-0 text-[#2C1E16]" />}
          </div>
        ))}
      </div>
      <div className="shrink-0 flex flex-row items-start gap-6 px-1">
        {GOOD_TO_KNOW.map(tip => (
          <div key={tip.title} className="flex flex-row items-center gap-2 flex-1 min-w-0">
            <tip.icon className="w-6 h-6 shrink-0 text-[#2C1E16]" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black uppercase tracking-wider text-[#2C1E16] leading-tight">{tip.title}</span>
              <span className="text-sm font-bold text-[#2C1E16] leading-snug">{tip.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
