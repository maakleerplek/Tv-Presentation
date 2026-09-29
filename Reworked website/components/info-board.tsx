import { ArrowRight, Brush, GraduationCap, HandHelping, Package, ScanBarcode, Wallet } from 'lucide-react';

const INK = '#2C1E16';
const PAPER = '#F5F2EB';
const BAND = 'rgba(44, 30, 22, 0.1)';

// Positions come from Ruben's HTL sketch (2000 × 1168 px), so a change to the
// room can be copied from the drawing. The plan is stretched wider than the
// sketch to fill the panel.
const X = (x: number) => 8 + (x - 262) * 0.6;
const Y = (y: number) => 22 + (y - 120) * 0.465;

function Box({ x1, y1, x2, y2, label, sub, vertical, fill = '#FFFFFF' }: {
  x1: number; y1: number; x2: number; y2: number;
  label?: string; sub?: string; vertical?: boolean; fill?: string;
}) {
  const cx = (X(x1) + X(x2)) / 2;
  const cy = (Y(y1) + Y(y2)) / 2;
  return (
    <g>
      <rect x={X(x1)} y={Y(y1)} width={X(x2) - X(x1)} height={Y(y2) - Y(y1)} rx={5}
        fill={fill} stroke={INK} strokeWidth={2.5} />
      {label && (
        <text x={cx} y={cy + (sub ? -2 : 4.5)} textAnchor="middle" fill={INK} fontSize={13} fontWeight={800}
          transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>{label}</text>
      )}
      {sub && (
        <text x={cx} y={cy + (label ? 12 : 3.5)} textAnchor="middle" fill={INK} fontSize={9} fontWeight={700}
          letterSpacing={0.5} className="font-mono">{sub}</text>
      )}
    </g>
  );
}

/** A numbered black circle, keyed to the legend under the plan. */
function Mark({ x, y, n, outline }: { x: number; y: number; n: string; outline?: boolean }) {
  return (
    <g>
      <circle cx={X(x)} cy={Y(y)} r={11} fill={outline ? PAPER : INK} stroke={INK} strokeWidth={1.5} />
      <text x={X(x)} y={Y(y) + 4.5} textAnchor="middle" fill={outline ? INK : PAPER} fontSize={12} fontWeight={800}>{n}</text>
    </g>
  );
}

/** Toilet pictogram: head plus body; a dress for the women's room. */
function Person({ x, y, dress }: { x: number; y: number; dress?: boolean }) {
  const cx = X(x);
  const cy = Y(y);
  return (
    <g fill={INK}>
      <circle cx={cx} cy={cy - 9} r={3.5} />
      {dress
        ? <path d={`M${cx} ${cy - 4} L${cx + 6} ${cy + 7} H${cx - 6} Z`} />
        : <rect x={cx - 4} y={cy - 4} width={8} height={11} rx={1.5} />}
      <rect x={cx - 3} y={cy + 7} width={2} height={6} />
      <rect x={cx + 1} y={cy + 7} width={2} height={6} />
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
    <g fill="none" stroke={INK} strokeWidth={1.5}>
      <line x1={x0} y1={y0} x2={x0} y2={y0 + s * r} />
      <path d={`M${x0} ${y0 + s * r} A${r} ${r} 0 0 ${s > 0 ? 0 : 1} ${x0 + r} ${y0}`} strokeDasharray="3 3" />
    </g>
  );
}

// From the entrance to the TV, and from the hall through the kantine to the cellar door.
const TO_TV = `M${X(690)} ${Y(440)} V${Y(620)} H${X(908)} V${Y(582)}`;
const TO_CELLAR = `M${X(1145)} ${Y(535)} V${Y(178)} H${X(935)} V${Y(250)}`;

function FloorPlan() {
  const wall = { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'square' as const };
  const thin = { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'square' as const };
  return (
    <svg viewBox="0 0 930 545" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full" role="img"
      aria-label="Floor plan of the High Tech Lab">
      <defs>
        <pattern id="staff-hatch" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={8} stroke={INK} strokeOpacity={0.2} strokeWidth={2} />
        </pattern>
      </defs>

      {/* Staff room: hatched, door from the hall right of the wood bin */}
      <rect x={X(1470)} y={Y(150)} width={X(1785) - X(1470)} height={Y(530) - Y(150)} fill="url(#staff-hatch)" />
      <text x={X(1628)} y={Y(320)} textAnchor="middle" fill={INK} fontSize={13} fontWeight={800}>Staff room</text>
      <text x={X(1628)} y={Y(320) + 15} textAnchor="middle" fill={INK} fillOpacity={0.6} fontSize={9} letterSpacing={1.5}
        className="font-mono">STAFF ONLY</text>

      {/* Routes */}
      <path d={TO_TV} fill="none" stroke={BAND} strokeWidth={30} strokeLinejoin="round" />
      <path d={TO_TV} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="10 7" />
      <path d={`M${X(908) - 7} ${Y(582) + 12} H${X(908) + 7} L${X(908)} ${Y(582)} Z`} fill={INK} />
      <path d={TO_CELLAR} fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="5 5" />
      <path d={`M${X(935) - 5} ${Y(250) - 9} H${X(935) + 5} L${X(935)} ${Y(250)} Z`} fill={INK} fillOpacity={0.5} />

      {/* Hall */}
      <path d={`M${X(655)} ${Y(530)} H${X(270)} V${Y(1242)} H${X(1785)} V${Y(530)} H${X(1650)}`} {...wall} />
      <path d={`M${X(725)} ${Y(530)} H${X(1080)}`} {...wall} />
      <path d={`M${X(1170)} ${Y(530)} H${X(1595)}`} {...wall} />
      <Door x={1595} y={530} w={55} dir="up" />

      {/* Cellar: behind an extra wall, reached over the top and through a door */}
      <path d={`M${X(1080)} ${Y(530)} V${Y(225)}`} {...wall} />
      <path d={`M${X(1080)} ${Y(130)} H${X(880)} V${Y(530)}`} {...wall} />
      <path d={`M${X(990)} ${Y(225)} H${X(1080)}`} {...thin} />
      <path d={`M${X(880)} ${Y(225)} H${X(900)}`} {...thin} />
      <Door x={900} y={225} w={90} dir="down" />
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={X(905)} x2={X(1055)} y1={Y(330) + i * 11} y2={Y(330) + i * 11} stroke={INK} strokeWidth={1.5} />
      ))}
      <text x={X(980)} y={Y(460)} textAnchor="middle" fill={INK} fontSize={13} fontWeight={800}>Cellar ↓</text>
      <text x={X(980)} y={Y(460) + 13} textAnchor="middle" fill={INK} fillOpacity={0.6} fontSize={8.5}
        className="font-mono">store projects</text>

      {/* Kantine: the passage north, toilets to the right */}
      <path d={`M${X(1170)} ${Y(530)} V${Y(400)}`} {...wall} />
      <path d={`M${X(1170)} ${Y(310)} V${Y(150)} H${X(1470)} V${Y(530)}`} {...wall} />
      <text x={X(1108)} y={Y(400)} textAnchor="middle" fill={INK} fontSize={13} fontWeight={800}
        transform={`rotate(-90 ${X(1108)} ${Y(400)})`}>Kantine</text>
      <text x={X(1125)} y={Y(118)} textAnchor="middle" fill={INK} fillOpacity={0.6} fontSize={9} letterSpacing={1}
        className="font-mono">↑ KANTINE: ASK FIRST</text>

      {/* Toilets: a hallway, women above, men below */}
      <path d={`M${X(1250)} ${Y(310)} H${X(1470)}`} {...thin} />
      <path d={`M${X(1250)} ${Y(400)} H${X(1470)}`} {...thin} />
      <path d={`M${X(1170)} ${Y(310)} H${X(1200)}`} {...thin} />
      <path d={`M${X(1170)} ${Y(400)} H${X(1200)}`} {...thin} />
      <Person x={1270} y={232} dress />
      <text x={X(1300)} y={Y(232) + 4} fill={INK} fontSize={13} fontWeight={800}>Women</text>
      <Person x={1270} y={470} />
      <text x={X(1300)} y={Y(470) + 4} fill={INK} fontSize={13} fontWeight={800}>Men</text>
      <text x={X(1340)} y={Y(355) + 3} textAnchor="middle" fill={INK} fillOpacity={0.6} fontSize={9} letterSpacing={1.5}
        className="font-mono">TOILETS →</text>

      {/* Entrance and the TV */}
      <text x={X(690)} y={Y(420)} textAnchor="middle" fill={INK} fontSize={11} fontWeight={700} letterSpacing={2}
        className="font-mono">ENTRANCE</text>
      <rect x={X(815)} y={Y(532)} width={X(1000) - X(815)} height={12} fill={INK} />
      <text x={X(908)} y={Y(532) + 9.5} textAnchor="middle" fill={PAPER} fontSize={9} fontWeight={800} letterSpacing={2}>TV</text>
      <rect x={X(1010)} y={Y(532)} width={10} height={12} fill={INK} />
      <text x={X(1025)} y={Y(532) + 26} fill={INK} fillOpacity={0.7} fontSize={9} fontWeight={700} letterSpacing={1}
        className="font-mono">← YOU ARE HERE</text>

      {/* Along the north wall */}
      <Box x1={1380} y1={532} x2={1480} y2={590} label="Fridge" fill={PAPER} />
      
      {/* Hall */}
      <Box x1={285} y1={545} x2={613} y2={705} label="3D print corner" />
      <Box x1={272} y1={730} x2={352} y2={1240} label="Electronics workstation" vertical fill={PAPER} />
      <Box x1={372} y1={800} x2={438} y2={1240} label="Electronics rack" vertical />
      <Box x1={690} y1={675} x2={1110} y2={965} label="Main table" />
      <Box x1={1160} y1={690} x2={1268} y2={975} label="Display rack" vertical />
      <Box x1={1276} y1={690} x2={1345} y2={975} label="Scrap wood" vertical fill={PAPER} />
      {/* Bolts & nuts: boxes under the racks */}
      <rect x={X(1164)} y={Y(930)} width={X(1341) - X(1164)} height={Y(970) - Y(930)} fill={PAPER}
        stroke={INK} strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={X(1200)} y={Y(1010)} fill={INK} fontSize={13} fontWeight={800}>Bolts & nuts</text>
      <text x={X(1200)} y={Y(1010) + 13} fill={INK} fontSize={9} fontWeight={700} letterSpacing={0.5}
        className="font-mono">UNDER THE RACK</text>
      {/* Right wall: craft supplies, the lasercutters and their PCs */}
      <Box x1={1665} y1={540} x2={1783} y2={660} label="Craft" sub="SUPPLIES" fill={PAPER} />
      <Box x1={1680} y1={668} x2={1783} y2={735} label="Wood" sub="BIN" />
      <Box x1={1590} y1={745} x2={1783} y2={905} label="Lasercutter" />
      <Box x1={1650} y1={913} x2={1783} y2={963} label="Laser PC" />
      <Box x1={1650} y1={969} x2={1783} y2={1019} label="Laser PC" />
      <Box x1={1650} y1={1027} x2={1783} y2={1175} label="Small" sub="LASERCUTTER" />
      <Box x1={464} y1={1100} x2={617} y2={1240} label="CNC" />
      <Box x1={637} y1={1110} x2={764} y2={1240} label="Drill" />
      <rect x={X(776)} y={Y(1240)} width={X(1290) - X(776)} height={5} fill={INK} />
      <Box x1={776} y1={1135} x2={1290} y2={1228} label="Workbench" sub="TOOL RACK ON THE WALL" />
      <Box x1={1300} y1={1135} x2={1580} y2={1240} label="Wood supply" fill={PAPER} />

      {/* Keyed to the legend */}
      <Mark x={815} y={532} n="€" outline />
      <Mark x={1380} y={532} n="1" />
      <Mark x={1300} y={1135} n="2" />
      <Mark x={1345} y={690} n="3" />
      <Mark x={272} y={730} n="4" />
      <Mark x={1665} y={540} n="5" />
    </svg>
  );
}

const LEGEND = [
  { mark: '€', text: 'Scan & pay at the TV', outline: true },
  { mark: '1', text: 'Fridge: drinks' },
  { mark: '2', text: 'Wood supply' },
  { mark: '3', text: 'Scrap wood: free' },
  { mark: '4', text: 'Electronics supply' },
  { mark: '5', text: 'Craft supplies' },
];

const BUY_STEPS = [
  { icon: Package, title: 'Take it', text: 'From the fridge or one of the supplies' },
  { icon: ScanBarcode, title: 'Scan it', text: 'Its QR code on this TV, with the scanner right of the TV' },
  { icon: Wallet, title: 'Pay', text: 'Scan CONFIRM twice, then pay with the Wero QR on the small screen' },
];

const GOOD_TO_KNOW = [
  { icon: HandHelping, title: 'Ask a volunteer', text: 'They help with your project and know the machines' },
  { icon: GraduationCap, title: 'New to a machine?', text: 'Ask for an explanation first, or join a workshop' },
  { icon: Brush, title: 'Leave it tidy', text: 'Tools back on the rack, clean your spot' },
];

/** The info page in the inventory cycle: where everything is at HTL and how to buy. */
export function InfoBoard() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Absolute, so the SVG fills the free space instead of sizing the panel from its width. */}
      <div className="relative flex-1 min-h-0">
        <FloorPlan />
      </div>
      <div className="shrink-0 flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y-2 border-[#2C1E16] py-1.5">
        {LEGEND.map(item => (
          <span key={item.mark} className="flex items-center gap-1.5 text-sm font-black text-[#2C1E16]">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] border-[1.5px] border-[#2C1E16] ${
              item.outline ? 'bg-[#F5F2EB] text-[#2C1E16]' : 'bg-[#2C1E16] text-[#F5F2EB]'}`}>
              {item.mark}
            </span>
            {item.text}
          </span>
        ))}
      </div>
      <div className="shrink-0 flex flex-row items-stretch gap-2">
        {BUY_STEPS.map((step, i) => (
          <div key={step.title} className="flex flex-row items-center gap-2 flex-1 min-w-0">
            <div className="flex flex-row items-center gap-3 flex-1 min-w-0 border-2 border-[#2C1E16] bg-white px-3 py-2 shadow-[2px_2px_0_0_#2C1E16]">
              <step.icon className="w-7 h-7 shrink-0 text-[#2C1E16]" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black uppercase tracking-wider text-[#2C1E16] leading-tight">
                  {i + 1}. {step.title}
                </span>
                <span className="text-[11px] font-bold text-[#2C1E16]/70 leading-snug">{step.text}</span>
              </div>
            </div>
            {i < BUY_STEPS.length - 1 && <ArrowRight className="w-4 h-4 shrink-0 text-[#2C1E16]/50" />}
          </div>
        ))}
      </div>
      <div className="shrink-0 flex flex-row items-start gap-6 px-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16] leading-tight pt-0.5 shrink-0">
          Good<br />to know
        </span>
        {GOOD_TO_KNOW.map(tip => (
          <div key={tip.title} className="flex flex-row items-start gap-2 flex-1 min-w-0">
            <tip.icon className="w-5 h-5 shrink-0 text-[#2C1E16]" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black text-[#2C1E16] leading-tight">{tip.title}</span>
              <span className="text-[11px] font-bold text-[#2C1E16]/70 leading-snug">{tip.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
