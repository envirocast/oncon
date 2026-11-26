"use client";
import React from "react";

// A schematic front view. One symmetrical silhouette built from a left-half outline that is mirrored in code,
// with organ regions drawn as real shapes and labelled with leader lines, like an anatomy atlas plate.
type Seg = { c: [number, number, number, number, number, number] } | { l: [number, number] };
const START: [number, number] = [106, 66];
const HALF: Seg[] = [
  { c: [106, 76, 104, 80, 94, 84] }, { c: [76, 88, 62, 94, 58, 112] }, { c: [56, 130, 52, 160, 48, 188] }, { c: [45, 214, 40, 236, 36, 256] },
  { c: [33, 268, 32, 282, 38, 292] }, { c: [44, 296, 50, 288, 52, 278] }, { c: [54, 262, 58, 236, 62, 214] }, { c: [66, 190, 70, 160, 72, 134] },
  { c: [74, 156, 80, 172, 82, 198] }, { c: [82, 214, 80, 232, 78, 250] }, { c: [76, 296, 80, 340, 86, 384] }, { c: [88, 420, 86, 452, 90, 480] },
  { l: [88, 504] }, { c: [88, 510, 96, 513, 106, 512] }, { c: [109, 512, 109, 506, 108, 500] }, { c: [108, 470, 108, 430, 112, 392] }, { c: [114, 350, 116, 300, 120, 268] },
];
const M = (x: number) => 240 - x;
function silhouette() {
  const pts: [number, number][] = [START]; HALF.forEach(s => pts.push("c" in s ? [s.c[4], s.c[5]] : s.l));
  let d = `M${START[0]} ${START[1]}`; HALF.forEach(s => { d += "c" in s ? ` C${s.c.join(" ")}` : ` L${s.l.join(" ")}`; });
  for (let i = HALF.length - 1; i >= 0; i--) { const s = HALF[i], prev = pts[i]; d += "c" in s ? ` C${M(s.c[2])} ${s.c[3]} ${M(s.c[0])} ${s.c[1]} ${M(prev[0])} ${prev[1]}` : ` L${M(prev[0])} ${prev[1]}`; }
  return d + "Z";
}
const SIL = silhouette();
/** Mirror an absolute path (M/L/C/Q only) about the body's centre line. */
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${M(Number(x))} ${y}`);
const both = (d: string, cls?: string) => <><path className={cls} d={d} /><path className={cls} d={mirror(d)} /></>;

export interface Label { id: string; name: string; ax: number; ay: number; side: "l" | "r"; y: number; }
export const LABELS: Label[] = [
  { id: "brain", name: "Brain", ax: 138, ay: 28, side: "r", y: 30 }, { id: "lungs", name: "Lungs", ax: 152, ay: 112, side: "r", y: 94 },
  { id: "heart", name: "Heart", ax: 138, ay: 142, side: "r", y: 140 }, { id: "liver", name: "Liver", ax: 88, ay: 184, side: "l", y: 184 },
  { id: "spleen", name: "Spleen", ax: 151, ay: 180, side: "r", y: 174 },
  { id: "lymph-nodes", name: "Lymph nodes", ax: 84, ay: 126, side: "l", y: 126 },
  { id: "stomach", name: "Stomach & intestines", ax: 156, ay: 196, side: "r", y: 192 }, { id: "kidneys", name: "Kidneys", ax: 138, ay: 214, side: "r", y: 238 },
  { id: "pancreas", name: "Pancreas", ax: 120, ay: 205, side: "r", y: 210 }, { id: "bladder", name: "Bladder", ax: 120, ay: 244, side: "r", y: 258 },
  { id: "bone", name: "Bones & marrow", ax: 98, ay: 330, side: "l", y: 330 }, { id: "vessels", name: "Blood vessels", ax: 134, ay: 340, side: "r", y: 340 },
];

export default function Body({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const Org = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <g className={"org" + (selected === id ? " on" : "") + (id === "vessels" ? " vessel" : "")} role="button" tabIndex={0} aria-label={LABELS.find(l => l.id === id)?.name} aria-pressed={selected === id}
      onClick={() => onSelect(id)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(id))}>{children}</g>);
  return (
    <svg className="fig" viewBox="-104 -2 470 524" role="group" aria-label="Front view of the body. Select an organ.">
      <path className="sil" d={SIL} /><ellipse className="sil" cx="120" cy="38" rx="24" ry="30" /><path className="sil nostroke" d="M108 62 L132 62 L134 74 L106 74Z" />

      <Org id="bone">
        <g className="bonegrp">
          {Array.from({ length: 13 }, (_, i) => <rect key={i} x="116" y={78 + i * 13} width="8" height="9" rx="3" />)}
          {Array.from({ length: 6 }, (_, i) => <React.Fragment key={i}>{both(`M118 ${97 + i * 9} C102 ${95 + i * 9} 88 ${105 + i * 9} 84 ${119 + i * 9}`, "ln")}</React.Fragment>)}
          <path d="M84 236 C84 252 96 262 108 262 L120 268 L132 262 C144 262 156 252 156 236 C150 240 142 240 136 238 L120 244 L104 238 C98 240 90 240 84 236Z" />
          {both("M98 262 C94 262 92 268 96 272 L100 380 C94 382 94 392 100 394 C106 396 110 388 106 382 L104 272 C106 266 102 262 98 262Z")}
          {both("M60 104 C56 104 54 110 58 114 L54 184 C50 188 54 196 58 194 C62 192 64 186 62 184 L66 114 C68 108 64 104 60 104Z")}
        </g></Org>

      <Org id="brain"><path d="M101 36 C98 22 108 12 120 12 C132 12 142 22 139 36 C137 46 129 50 120 50 C111 50 103 46 101 36Z" />
        <path className="ln" d="M120 13 C116 22 123 30 119 40 C118 44 120 47 120 50 M106 26 C112 22 114 28 110 32 C106 36 112 40 116 38 M134 26 C128 22 126 28 130 32 C134 36 128 40 124 38 M108 46 C114 53 126 53 132 46" /></Org>

      <Org id="lungs"><path className="ln" d="M120 70 L120 100 M120 100 C118 106 114 108 108 112 M120 100 C122 106 126 108 132 112" />
        <path d="M114 98 C102 94 90 102 86 122 C82 142 84 160 92 168 C102 174 112 168 114 156 C116 140 116 112 114 98Z" />
        <path d="M126 98 C138 94 150 102 154 122 C158 140 156 158 148 166 C140 170 132 166 130 160 C134 150 126 140 126 130 C126 120 126 108 126 98Z" /></Org>
      <Org id="heart"><path d="M128 132 C128 126 137 124 139 131 C141 138 134 146 128 156 C122 146 115 138 117 131 C119 124 128 126 128 132Z" /></Org>
      <Org id="lymph-nodes"><g><circle cx="84" cy="126" r="3" /><circle cx="88" cy="132" r="3" /><circle cx="78" cy="132" r="3" />{both("M78 132 C72 130 68 128 64 126")}</g></Org>
      <Org id="liver"><path d="M84 172 C100 168 124 170 138 174 C142 186 134 198 118 202 C102 206 88 200 84 188 C82 182 82 176 84 172Z" /></Org>
      <Org id="spleen"><path d="M145 174 C151 169 159 174 158 182 C157 190 151 195 145 192 C142 189 143 179 145 174Z" /></Org>
      <Org id="stomach"><path d="M136 178 C148 174 160 182 158 194 C156 206 144 212 136 208 C130 204 134 196 132 190 C130 184 132 180 136 178Z" />
        <path className="ln thick" d="M92 256 L92 222 Q92 218 96 218 L144 218 Q148 218 148 222 L148 256" /><path className="ln" d="M100 230 C108 226 112 236 120 232 C128 228 132 238 140 234 M100 242 C108 238 112 248 120 244 C128 240 132 250 140 246" /></Org>
      <Org id="pancreas"><path d="M105 198 C112 193 120 195 126 198 C132 195 139 197 141 201 C137 205 130 205 125 203 C119 207 111 206 105 203Z" /></Org>
      <Org id="kidneys">{both("M104 204 C97 204 95 214 99 223 C103 229 109 226 110 219 C108 213 110 206 104 204Z")}</Org>
      <Org id="bladder"><path d="M112 237 C115 234 125 234 128 237 C131 241 129 250 124 254 L120 258 L116 254 C111 250 109 241 112 237Z" /></Org>
      <Org id="vessels"><path className="hit" d="M124 150 C124 190 124 230 122 268 C116 300 112 330 108 384 C108 430 108 470 104 508 M122 268 C128 300 128 330 132 384 C132 430 132 470 136 508 M112 108 C96 104 78 108 64 120 C58 150 54 190 48 250 M128 108 C144 104 162 108 176 120 C182 150 186 190 192 250" />
        <path className="ln" d="M124 150 C124 190 124 230 122 268 C116 300 112 330 108 384 C108 430 108 470 104 508 M122 268 C128 300 128 330 132 384 C132 430 132 470 136 508 M112 108 C96 104 78 108 64 120 C58 150 54 190 48 250 M128 108 C144 104 162 108 176 120 C182 150 186 190 192 250" /></Org>

      {LABELS.map(l => { const x = l.side === "r" ? 214 : 10; const on = selected === l.id; return (
        <g key={l.id} className={"lab" + (on ? " on" : "")} onClick={() => onSelect(l.id)} style={{ cursor: "pointer" }}>
          <polyline points={`${l.ax},${l.ay} ${l.side === "r" ? 206 : 18},${l.y} ${x},${l.y}`} fill="none" /><circle cx={l.ax} cy={l.ay} r="2.6" />
          <text x={l.side === "r" ? x + 6 : x - 6} y={l.y + 4} textAnchor={l.side === "r" ? "start" : "end"}>{l.name}</text></g>); })}
    </svg>);
}
