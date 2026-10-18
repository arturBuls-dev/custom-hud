import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { isInGame, useNuiEvent } from './nui';

type HudData = {
  action: 'hud';
  show: boolean;
  health: number;
  armor: number;
  hunger: number;
  thirst: number;
  talking: boolean;
  inVehicle: boolean;
  speed: number;
  fuel: number;
  seatbelt: boolean;
  unit: string;
  gaugeMax: number;
  hintSeatbelt: boolean;
  hintMic: boolean;
  hintExit: 'belt' | 'harness' | false;
  hintLocked: boolean;
  lockKey: string;
  seatbeltKey: string;
  talkKey: string;
  voiceRangeKey: string;
};

const EMPTY: HudData = {
  action: 'hud', show: false, health: 100, armor: 0, hunger: 100, thirst: 100,
  talking: false, inVehicle: false, speed: 0, fuel: 0, seatbelt: false, unit: 'MPH',
  gaugeMax: 240, hintSeatbelt: false, hintMic: false, hintExit: false, hintLocked: false, lockKey: 'L',
  seatbeltKey: 'B', talkKey: 'N', voiceRangeKey: '`',
};

// Sample data for browser preview (in game client.lua sends the real data)
const DEV_DATA: HudData = {
  ...EMPTY, show: true, health: 78, armor: 40, hunger: 55, thirst: 18,
  inVehicle: true, speed: 64, fuel: 62, hintSeatbelt: true, hintMic: true,
};

const clamp = (v: number, max = 100) => Math.max(0, Math.min(max, v));

// ---------- Icons (original, simple, outline) ----------
const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const HeartIcon = () => <Icon><path d="M12 20s-7-4.4-9-9.2C1.8 7.6 3.8 4.8 6.8 4.8c2 0 3.7 1 5.2 3 1.5-2 3.2-3 5.2-3 3 0 5 2.8 3.8 6C19 15.6 12 20 12 20z" /></Icon>;
const ShieldIcon = () => <Icon><path d="M12 3l7 2.8v5.4c0 4.6-3 8.2-7 9.8-4-1.6-7-5.2-7-9.8V5.8L12 3z" /></Icon>;
const FoodIcon = () => <Icon><path d="M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M17 3c-2 1.5-3 4-3 7 0 1.8 1 3 3 3v8" /></Icon>;
const DropIcon = () => <Icon><path d="M12 3s6.5 6.8 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 9.8 12 3 12 3z" /></Icon>;
const MicIcon = () => <Icon><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></Icon>;

// ---------- Status ring ----------
const R = 18;
const C = 2 * Math.PI * R;

function Ring({ value, icon, low = 25 }: { value: number; icon: ReactNode; low?: number }) {
  const v = clamp(value);
  return (
    <div className={`ring${v <= low ? ' low' : ''}`}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="track" cx="22" cy="22" r={R} />
        <circle
          className="bar"
          cx="22" cy="22" r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - v / 100)}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="ring-icon">{icon}</span>
    </div>
  );
}

// ---------- Gauge speedometer ----------
// The scale spans 270 degrees: from 135 (bottom left) clockwise to 45 (bottom right).
// SVG angles are measured from the X axis clockwise (the Y axis points down).
const CX = 120;
const CY = 120;
const START = 135;
const SWEEP = 270;

const pointAt = (angleDeg: number, r: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
};

// Arc between two angles (clockwise)
const arcPath = (a0: number, a1: number, r: number) => {
  const p0 = pointAt(a0, r);
  const p1 = pointAt(a1, r);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
};

function Speedometer({ speed, max, unit }: { speed: number; max: number; unit: string }) {
  const frac = clamp(speed, max) / max;
  const angle = START + SWEEP * frac;

  // 12 major ticks with one minor tick between each pair
  const majorStep = max / 12;
  const ticks = Array.from({ length: 25 }, (_, i) => ({
    value: (i * majorStep) / 2,
    major: i % 2 === 0,
  }));

  const redFrom = START + SWEEP * (10 / 12); // the last sixth of the scale is red

  return (
    <div className="gauge">
      <svg viewBox="0 0 240 240" aria-hidden="true">
        {/* Backdrop so the numbers stay readable over any game scene */}
        <circle className="gauge-bg" cx={CX} cy={CY} r="116" />

        {/* Scale track, red zone and the fill up to the current speed */}
        <path className="g-track" d={arcPath(START, START + SWEEP, 100)} pathLength={100} />
        <path className="g-red" d={arcPath(redFrom, START + SWEEP, 100)} />
        <path
          className="g-fill"
          d={arcPath(START, START + SWEEP, 100)}
          pathLength={100}
          strokeDasharray={`${frac * 100} 100`}
        />

        {/* Ticks and labels */}
        {ticks.map(({ value, major }) => {
          const a = START + SWEEP * (value / max);
          const p0 = pointAt(a, major ? 84 : 88);
          const p1 = pointAt(a, 94);
          const t = pointAt(a, 72);
          return (
            <g key={value}>
              <line className={major ? 'tick major' : 'tick'} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} />
              {major && <text className="tick-label" x={t.x} y={t.y}>{Math.round(value)}</text>}
            </g>
          );
        })}

        {/* Pointer: a glowing dot on the arc so it does not cover the numbers */}
        <g className="needle" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
          <circle cx={CX + 100} cy={CY} r="5" />
        </g>
      </svg>

      <div className="gauge-readout">
        <span className="speed-value">{speed}</span>
        <span className="speed-unit">{unit.toLowerCase()}</span>
      </div>
    </div>
  );
}

// A key cap shown inside hints
const Key = ({ children }: { children: ReactNode }) => <kbd>{children}</kbd>;

// Browser only: ?speed=171 freezes the speed (handy for design checks)
const devSpeed = isInGame() ? null : new URLSearchParams(window.location.search).get('speed');

export default function App() {
  const [hud, setHud] = useState<HudData>(
    isInGame() ? EMPTY : devSpeed ? { ...DEV_DATA, speed: Number(devSpeed) } : DEV_DATA,
  );

  useNuiEvent<HudData>('hud', useCallback((data) => setHud(data), []));

  // In a browser vary the speed a little to see how the movement looks
  useEffect(() => {
    if (isInGame() || devSpeed) return;
    const id = window.setInterval(() => {
      setHud((h) => ({ ...h, speed: 20 + Math.round(Math.abs(Math.sin(Date.now() / 2500)) * 200) }));
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  if (!hud.show) return null;

  return (
    <>
      <div className="hints">
        {hud.hintLocked && (
          <div className="hint warn">
            This vehicle is locked. Press <Key>{hud.lockKey}</Key> to unlock it
          </div>
        )}
        {hud.hintExit && (
          <div className="hint warn">
            {hud.hintExit === 'harness'
              ? 'Take off the harness first to leave the vehicle'
              : <>Unfasten your seatbelt first (<Key>{hud.seatbeltKey}</Key>) to leave the vehicle</>}
          </div>
        )}
        {hud.hintSeatbelt && !hud.hintExit && (
          <div className="hint warn">
            Press <Key>{hud.seatbeltKey}</Key> to fasten your seatbelt
          </div>
        )}
        {hud.hintMic && (
          <div className="hint">
            <MicIcon /> Hold <Key>{hud.talkKey}</Key> to talk, <Key>{hud.voiceRangeKey}</Key> changes voice range
          </div>
        )}
      </div>

      <div className="status">
        <Ring value={hud.health} icon={<HeartIcon />} />
        {hud.armor > 0 && <Ring value={hud.armor} icon={<ShieldIcon />} low={0} />}
        <Ring value={hud.hunger} icon={<FoodIcon />} />
        <Ring value={hud.thirst} icon={<DropIcon />} />
        <div className={`voice${hud.talking ? ' talking' : ''}`}><MicIcon /></div>
      </div>

      {hud.inVehicle && (
        <div className="vehicle">
          <Speedometer speed={hud.speed} max={hud.gaugeMax} unit={hud.unit} />
          <div className="vehicle-bottom">
            <div className="fuel">
              <span className="fuel-label">FUEL</span>
              <div className="fuel-track">
                <div className={`fuel-bar${hud.fuel <= 15 ? ' low' : ''}`} style={{ width: `${clamp(hud.fuel)}%` }} />
              </div>
            </div>
            <div className={`belt${hud.seatbelt ? ' on' : ''}`}>{hud.seatbelt ? 'BELT ON' : 'BELT OFF'}</div>
          </div>
        </div>
      )}
    </>
  );
}
