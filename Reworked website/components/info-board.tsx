import { ArrowRight, Package, ScanBarcode, Wallet } from 'lucide-react';

const INK = '#2C1E16';
const BAND = 'rgba(44, 30, 22, 0.1)';

// The route from the stairs to the drinks in the cellar, centre line of the band.
const ROUTE = 'M258 555 V335 H90 V100 H594 V190';

const TURNS = [
  { n: 1, x: 258, y: 335, label: 'LEFT', lx: 272, ly: 360, anchor: 'start' },
  { n: 2, x: 90, y: 335, label: 'RIGHT', lx: 32, ly: 366, anchor: 'start' },
  { n: 3, x: 90, y: 100, label: 'RIGHT', lx: 32, ly: 84, anchor: 'start' },
  { n: 4, x: 594, y: 100, label: 'RIGHT', lx: 612, ly: 84, anchor: 'start' },
] as const;

const STEPS = [
  { mark: '↓', text: 'Down the stairs', outline: true },
  { mark: '1', text: 'Left', outline: false },
  { mark: '2', text: 'Right', outline: false },
  { mark: '3', text: 'Right', outline: false },
  { mark: '4', text: 'Right again', outline: false },
  { mark: '✓', text: 'Done: drinks', outline: true },
];

/** Ruben's drawing (docs/cellar-route.png) as an SVG in the TV colours. */
function CellarRoute() {
  return (
    <svg viewBox="0 0 960 600" preserveAspectRatio="xMidYMid meet" className="w-full h-full" role="img"
      aria-label="Route from the stairs to the drinks in the cellar">
      {/* Route band and dashed path */}
      <path d={ROUTE} fill="none" stroke={BAND} strokeWidth={56} strokeLinejoin="round" />
      <path d={ROUTE} fill="none" stroke={INK} strokeWidth={4} strokeDasharray="14 9" />
      <path d="M582 188 L606 188 L594 208 Z" fill={INK} />

      {/* Wall */}
      <rect x={138} y={201} width={366} height={38} fill={INK} />
      <text x={321} y={225} textAnchor="middle" fill="#F5F2EB" fontSize={13} fontWeight={700}
        letterSpacing={8} className="font-mono">WALL</text>

      {/* Stairs */}
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={258 - 32 - i * 4} x2={258 + 32 + i * 4} y1={480 + i * 13} y2={480 + i * 13}
          stroke={INK} strokeWidth={2.5} />
      ))}
      <circle cx={258} cy={527} r={6} fill={INK} />
      <text x={312} y={517} fill={INK} fontSize={17} fontWeight={800}>Stairs</text>
      <text x={312} y={534} fill={INK} fillOpacity={0.6} fontSize={11} className="font-mono">from the ground floor</text>

      {/* Turns */}
      {TURNS.map(t => (
        <g key={t.n}>
          <circle cx={t.x} cy={t.y} r={13} fill={INK} />
          <text x={t.x} y={t.y + 5} textAnchor="middle" fill="#F5F2EB" fontSize={14} fontWeight={800}>{t.n}</text>
          <text x={t.lx} y={t.ly} textAnchor={t.anchor} fill={INK} fontSize={12} fontWeight={700}
            letterSpacing={2} className="font-mono">{t.label}</text>
        </g>
      ))}

      {/* Drinks storage */}
      <rect x={528} y={198} width={156} height={180} rx={10} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      <text x={606} y={250} textAnchor="middle" fill={INK} fontSize={19} fontWeight={900}>DRINKS</text>
      <text x={606} y={269} textAnchor="middle" fill={INK} fillOpacity={0.6} fontSize={10} letterSpacing={1.5}
        className="font-mono">DROP-OFF &amp; SUPPLY</text>
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={573} y={283 + i * 12} width={66} height={10} fill={INK} />
      ))}
      <text x={606} y={358} textAnchor="middle" fill={INK} fillOpacity={0.6} fontSize={10} className="font-mono">crates of 24</text>

      {/* Step list */}
      <text x={738} y={72} fill={INK} fontSize={28} fontWeight={900}>To the drinks</text>
      <text x={738} y={97} fill={INK} fillOpacity={0.6} fontSize={11} letterSpacing={2.5} className="font-mono">
        CELLAR · MAAKLEERPLEK
      </text>
      <line x1={738} x2={924} y1={114} y2={114} stroke={INK} strokeWidth={2} />
      {STEPS.map((s, i) => {
        const y = 144 + i * 42;
        return (
          <g key={i}>
            <circle cx={751} cy={y} r={12} fill={s.outline ? '#F5F2EB' : INK} stroke={INK} strokeWidth={1.5} />
            <text x={751} y={y + 4.5} textAnchor="middle" fill={s.outline ? INK : '#F5F2EB'} fontSize={13}
              fontWeight={800}>{s.mark}</text>
            <text x={775} y={y + 6} fill={INK} fontSize={17} fontWeight={800}>{s.text}</text>
          </g>
        );
      })}
      <text x={738} y={432} fill={INK} fillOpacity={0.6} fontSize={11} className="font-mono">Bring a crate up and</text>
      <text x={738} y={447} fill={INK} fillOpacity={0.6} fontSize={11} className="font-mono">restock the HTL fridge.</text>

      <text x={36} y={578} fill={INK} fillOpacity={0.5} fontSize={10} className="font-mono">schematic · not to scale</text>
    </svg>
  );
}

const BUY_STEPS = [
  { icon: Package, title: 'Take it', text: 'Drinks from the fridge, wood and filament from the racks' },
  { icon: ScanBarcode, title: 'Scan it', text: 'Its QR code on this TV, with the scanner right of the TV' },
  { icon: Wallet, title: 'Pay', text: 'Scan CONFIRM twice, then pay with the Wero QR on the small screen' },
];

/** The info page in the inventory cycle: where the drinks are and how to buy at HTL. */
export function InfoBoard() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex-1 min-h-0">
        <CellarRoute />
      </div>
      <div className="shrink-0">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16] mb-1.5">How to buy at HTL</h3>
        <div className="flex flex-row items-stretch gap-2">
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
      </div>
    </div>
  );
}
