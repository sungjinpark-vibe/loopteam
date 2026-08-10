/**
 * NPC sprite — ported from `C:\Users\user\app-dev-team\lifetown`'s plain-JS
 * SVG generators (our own prior work): base 6 species from
 * `docs/design/npcs/npcs.html` (`el`/`eyes`/`cheeks`/`smile`/`animal`), shop
 * species + `patch`/`beak`/`armColor` fields and 5 new `ear` shapes from
 * `docs/design/shop/new_npcs.html`. `new_npcs.html`'s `animal()` is a strict
 * superset of `npcs.html`'s (every base-6 branch renders identically), so
 * this component ports that superset once and covers all 12 species with
 * one shared body rig, matching ADDENDUM-05 §3's "one shared body + per-
 * species head" shape. JS string-concat SVG -> TS emitting JSX; coordinates
 * (cx=110, hy=96, hr=50, …) are copied verbatim from the source, not
 * re-derived, to avoid re-introducing bugs into hand-tuned chibi proportions.
 * Chibi big-eyed style verified against the source's own rendered previews
 * (`npcs.png` / `new_npcs.png`) and the director's reference
 * `docs/refs/npc-animal-reference.jpg` — the reference image itself is never
 * traced, embedded, or shipped.
 *
 * The neck scarf (`scarfColor`) is a new element neither JS prototype drew —
 * added here to render the Dart table's `scarfColor` field (see
 * `species.ts`'s header): a single band drawn last, low enough on the neck
 * to never cross the face.
 *
 * Rendered at the source's native 220x224 viewBox and scaled down via CSS
 * (`npc.css`) rather than hand-rescaling every one of the ~30 coordinate
 * literals per ear shape — same pixel-accurate proportions, far less risk.
 * ponytail: viewBox stays 220x224 (not literally "24x32"); CSS sizes the
 * rendered footprint instead. Revisit only if a real visual bug demands
 * different internal proportions at small sizes.
 */
import type { NpcEarShape, NpcSpeciesDef } from "./species";

const CX = 110;
const HY = 96;
const HR = 50;
const TOP = HY - HR;

function Eyes({ cx, cy, gap = 18, rx = 8.5, ry = 10 }: { cx: number; cy: number; gap?: number; rx?: number; ry?: number }) {
  return (
    <>
      <ellipse cx={cx - gap} cy={cy} rx={rx} ry={ry} fill="#4a3a52" />
      <ellipse cx={cx + gap} cy={cy} rx={rx} ry={ry} fill="#4a3a52" />
      <circle cx={cx - gap - 2} cy={cy - 4} r={3.2} fill="#fff" />
      <circle cx={cx + gap - 2} cy={cy - 4} r={3.2} fill="#fff" />
      <circle cx={cx - gap + 3} cy={cy + 4} r={1.7} fill="#fff" opacity={0.75} />
      <circle cx={cx + gap + 3} cy={cy + 4} r={1.7} fill="#fff" opacity={0.75} />
    </>
  );
}

function Cheeks({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <ellipse cx={cx - 30} cy={cy} rx={9} ry={7} fill="#ffb3cf" opacity={0.75} />
      <ellipse cx={cx + 30} cy={cy} rx={9} ry={7} fill="#ffb3cf" opacity={0.75} />
    </>
  );
}

function Smile({ cx, cy }: { cx: number; cy: number }) {
  return <path d={`M${cx - 7} ${cy} Q${cx} ${cy + 7} ${cx + 7} ${cy}`} stroke="#4a3a52" strokeWidth={2.6} fill="none" strokeLinecap="round" />;
}

function Grin({ cx, cy }: { cx: number; cy: number }) {
  return <path d={`M${cx - 15} ${cy - 2} Q${cx} ${cy + 13} ${cx + 15} ${cy - 2}`} stroke="#356b45" strokeWidth={2.6} fill="none" strokeLinecap="round" />;
}

function Ears({ ear, dark, body, inner }: { ear: NpcEarShape; dark: string; body: string; inner: string }) {
  switch (ear) {
    case "cat":
    case "fox":
      return (
        <>
          <polygon points={`${CX - 46},${TOP - 6} ${CX - 20},${TOP + 22} ${CX - 54},${TOP + 24}`} fill={body} />
          <polygon points={`${CX + 46},${TOP - 6} ${CX + 20},${TOP + 22} ${CX + 54},${TOP + 24}`} fill={body} />
          <polygon points={`${CX - 44},${TOP + 4} ${CX - 28},${TOP + 22} ${CX - 49},${TOP + 22}`} fill={inner} />
          <polygon points={`${CX + 44},${TOP + 4} ${CX + 28},${TOP + 22} ${CX + 49},${TOP + 22}`} fill={inner} />
        </>
      );
    case "round":
      return (
        <>
          <circle cx={CX - 36} cy={TOP + 8} r={19} fill={body} />
          <circle cx={CX + 36} cy={TOP + 8} r={19} fill={body} />
          <circle cx={CX - 36} cy={TOP + 10} r={10} fill={inner} />
          <circle cx={CX + 36} cy={TOP + 10} r={10} fill={inner} />
        </>
      );
    case "roundDark":
      return (
        <>
          <circle cx={CX - 36} cy={TOP + 8} r={19} fill={dark} />
          <circle cx={CX + 36} cy={TOP + 8} r={19} fill={dark} />
        </>
      );
    case "floppy":
      return (
        <>
          <ellipse cx={CX - 44} cy={HY + 14} rx={16} ry={32} fill={dark} />
          <ellipse cx={CX + 44} cy={HY + 14} rx={16} ry={32} fill={dark} />
        </>
      );
    case "rabbit":
      return (
        <>
          <ellipse cx={CX - 22} cy={TOP - 24} rx={13} ry={36} fill={body} />
          <ellipse cx={CX + 22} cy={TOP - 24} rx={13} ry={36} fill={body} />
          <ellipse cx={CX - 22} cy={TOP - 22} rx={6.5} ry={26} fill={inner} />
          <ellipse cx={CX + 22} cy={TOP - 22} rx={6.5} ry={26} fill={inner} />
        </>
      );
    case "antler": {
      const branch = (dir: 1 | -1) => {
        const sx = CX + dir * 18;
        return (
          <>
            <path
              d={`M${sx} ${TOP + 8} Q${sx + dir * 4} ${TOP - 16} ${sx + dir * 8} ${TOP - 34}`}
              stroke={dark}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M${sx + dir * 2} ${TOP - 4} Q${sx + dir * 12} ${TOP - 10} ${sx + dir * 17} ${TOP - 20}`}
              stroke={dark}
              strokeWidth={4.5}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M${sx + dir * 3} ${TOP - 16} Q${sx + dir * 11} ${TOP - 22} ${sx + dir * 15} ${TOP - 30}`}
              stroke={dark}
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
            />
          </>
        );
      };
      return (
        <>
          {branch(-1)}
          {branch(1)}
          <ellipse cx={CX - 40} cy={TOP + 16} rx={11} ry={14} fill={body} />
          <ellipse cx={CX + 40} cy={TOP + 16} rx={11} ry={14} fill={body} />
          <ellipse cx={CX - 40} cy={TOP + 17} rx={5.5} ry={8} fill={inner} />
          <ellipse cx={CX + 40} cy={TOP + 17} rx={5.5} ry={8} fill={inner} />
        </>
      );
    }
    case "spike": {
      const spikes = [];
      for (let i = -3; i <= 3; i++) {
        const ang = i * 0.34;
        const bx = CX + Math.sin(ang) * 46;
        const by = HY - Math.cos(ang) * 46 - 6;
        const tx = CX + Math.sin(ang) * 74;
        const ty = HY - Math.cos(ang) * 74 - 6;
        const nx = Math.cos(ang) * 8;
        const ny = Math.sin(ang) * 8;
        spikes.push(<polygon key={i} points={`${bx - nx},${by + ny} ${bx + nx},${by - ny} ${tx},${ty}`} fill={dark} />);
      }
      return <>{spikes}</>;
    }
    case "bird":
      return <path d={`M${CX} ${TOP - 2} q-9 -18 5 -22 q7 11 -5 22`} fill={dark} />;
    case "bump":
      return (
        <>
          <circle cx={CX - 24} cy={TOP + 8} r={17} fill={body} />
          <circle cx={CX + 24} cy={TOP + 8} r={17} fill={body} />
        </>
      );
    case "none":
      return null;
  }
}

/** One species as inline SVG, native 220x224 viewBox (see file header). Renders without throwing for every entry in `SPECIES`. */
export function NpcSprite({ species }: { species: NpcSpeciesDef }) {
  const { body, dark, ear, inner, belly, muzzle, patch, beak, armColor, scarfColor } = species;
  const arm = armColor ?? body;

  return (
    <svg viewBox="0 0 220 224" role="img" aria-hidden="true">
      {/* ground shadow */}
      <ellipse cx={CX} cy={207} rx={54} ry={12} fill="rgba(90,74,106,0.12)" />
      {/* feet */}
      <ellipse cx={CX - 20} cy={198} rx={15} ry={11} fill={dark} />
      <ellipse cx={CX + 20} cy={198} rx={15} ry={11} fill={dark} />
      {/* body + belly */}
      <ellipse cx={CX} cy={162} rx={46} ry={40} fill={body} />
      <ellipse cx={CX} cy={170} rx={28} ry={24} fill={belly} />
      {/* front paws */}
      <ellipse cx={CX - 28} cy={172} rx={11} ry={12} fill={arm} />
      <ellipse cx={CX + 28} cy={172} rx={11} ry={12} fill={arm} />
      {/* ears / head decoration, drawn behind the head */}
      <Ears ear={ear} dark={dark} body={body} inner={inner} />
      {/* head */}
      <circle cx={CX} cy={HY} r={HR} fill={body} />
      {muzzle && <ellipse cx={CX} cy={HY + 15} rx={27} ry={21} fill="#ffffff" />}
      {patch && (
        <>
          <ellipse cx={CX - 19} cy={HY - 3} rx={16} ry={19} fill={patch} />
          <ellipse cx={CX + 19} cy={HY - 3} rx={16} ry={19} fill={patch} />
        </>
      )}
      {ear === "bump" ? <Eyes cx={CX} cy={TOP + 7} gap={24} rx={8} ry={9} /> : <Eyes cx={CX} cy={HY} />}
      {beak || ear === "bird" ? (
        <polygon points={`${CX - 8},${HY + 13} ${CX + 8},${HY + 13} ${CX},${HY + 26}`} fill="#ffb347" />
      ) : ear === "bump" ? (
        <Grin cx={CX} cy={HY + 20} />
      ) : (
        <>
          <ellipse cx={CX} cy={HY + 13} rx={5} ry={4} fill="#4a3a52" />
          <Smile cx={CX} cy={HY + 20} />
        </>
      )}
      <Cheeks cx={CX} cy={HY + 11} />
      {/* neck scarf — new element, see file header */}
      {scarfColor && <ellipse cx={CX} cy={HY + HR - 4} rx={34} ry={12} fill={scarfColor} />}
    </svg>
  );
}
