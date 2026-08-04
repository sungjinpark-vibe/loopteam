/**
 * `SavingsRow` in isolation, mounted directly rather than through `TownGrid`
 * — the seam the road task built (round-1 finding C3). Placement/fragment-
 * emission is covered end-to-end via `TownGrid.test.tsx`; this file covers
 * the per-structure content ACs (ADDENDUM-01 §2.9: AC-F13-8/-9/-10(c)/-11(b)).
 */
import { afterEach, describe, expect, it } from "vitest";
import { CATEGORY_CONTENT, SAVINGS_STRUCTURE } from "../content.placeholder";
import { ladderFor, towerSegments } from "../selectors";
import { SAVING_CATEGORY_IDS } from "../savingsBuckets";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import {
  districtLadderLength,
  freeSavingsCells,
  savingsCellFor,
  savingsPlotHeightPx,
  savingsPlotTemplateRows,
  structureLevelHeightPx,
} from "../townLayout";
import type { SavingCategoryId } from "../types";
import { SavingsRow, type SavingsRowProps } from "./SavingsRow";

let mounted: MountedComponent | null = null;

// jsdom has no layout engine and does not implement scrollIntoView (§2.9) —
// SavingsRow's level-up auto-scroll effect (§2.6 step 1) calls it whenever
// `justGrew` is non-null at mount/update, same as TownGrid's justBuiltId
// effect. A no-op stub is enough; the scroll itself is `qa`'s job in a real browser.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const DEFAULT_PROPS: SavingsRowProps = {
  savingsByCategoryKrw: undefined,
  ladder: [1, 2, 3],
  ladderOverrides: {},
  justGrew: null,
  onRiseSettled: () => {},
};

function mount(props: Partial<SavingsRowProps> = {}): HTMLElement {
  mounted = mountComponent(
    <div className="town-grid">
      <SavingsRow {...DEFAULT_PROPS} {...props} />
    </div>,
  );
  return mounted.container;
}

describe("SavingsRow (ADDENDUM-01 §2.4a/§3.4 item 4)", () => {
  it("mounts as a bare fragment: parent's direct children are exactly the plots + the signpost", () => {
    const container = mount();
    const grid = container.querySelector(".town-grid") as HTMLElement;
    expect(grid.children.length).toBe(SAVING_CATEGORY_IDS.length + freeSavingsCells().length);
  });

  it("AC-F13-8: a fresh town (no savingsByCategoryKrw) renders 5 empty level-0 plots with signboard + emptyHint", () => {
    const container = mount();
    const plots = [...container.querySelectorAll(".savings-plot")] as HTMLElement[];
    expect(plots.length).toBe(SAVING_CATEGORY_IDS.length);
    for (const plot of plots) {
      const id = plot.dataset.structureId as SavingCategoryId;
      const cell = savingsCellFor(id);
      expect(Number(plot.style.gridColumn)).toBe(cell.col + 1);
      expect(Number(plot.style.gridRow)).toBe(cell.row + 1);
      expect(plot.classList.contains("savings-plot--empty")).toBe(true);
      expect(plot.classList.contains(`savings-plot--${SAVINGS_STRUCTURE[id].kind}`)).toBe(true);
      expect(plot.classList.contains(`savings-plot--cap-${SAVINGS_STRUCTURE[id].capShape}`)).toBe(true);
      expect(plot.querySelector(".savings-structure-board")?.textContent).toBe(SAVINGS_STRUCTURE[id].signboard);
      expect(plot.querySelector(".savings-structure-hint")?.textContent).toBe(SAVINGS_STRUCTURE[id].emptyHint);
      expect(plot.querySelector(".savings-structure-label")?.textContent).toBe(CATEGORY_CONTENT[id].label);
    }
  });

  it("the five structures are visually distinct: every kind/capShape pair is unique", () => {
    const container = mount();
    const plots = [...container.querySelectorAll(".savings-plot")] as HTMLElement[];
    const signatures = new Set(
      plots.map((p) => [...p.classList].filter((c) => c.startsWith("savings-plot--")).sort().join(" ")),
    );
    expect(signatures.size).toBe(SAVING_CATEGORY_IDS.length); // no two plots share a class signature
  });

  it("AC-F13-9: no 원/₩/comma anywhere in the savings block — level is pips, never an amount", () => {
    const container = mount({ savingsByCategoryKrw: { deposit: 5_000_000, stock: 2_000_000 } });
    const text = (container.querySelector(".town-grid") as HTMLElement).textContent ?? "";
    expect(text).not.toMatch(/원|₩|\d{1,3}(,\d{3})+/);
  });

  it("a structure with enough saved crosses into a non-empty level and its pips light up", () => {
    const container = mount({ savingsByCategoryKrw: { deposit: 3 } }); // ladder [1,2,3] -> level 3
    const plot = container.querySelector('[data-structure-id="deposit"]') as HTMLElement;
    expect(plot.classList.contains("savings-plot--empty")).toBe(false);
    const onPips = plot.querySelectorAll(".savings-pip--on");
    expect(onPips.length).toBe(3);
    const otherPlot = container.querySelector('[data-structure-id="stock"]') as HTMLElement;
    expect(otherPlot.classList.contains("savings-plot--empty")).toBe(true);
  });

  it("AC-F13-10(c): exactly one plot carries .savings-plot--rise, matching justGrew.id", () => {
    const container = mount({ justGrew: { id: "goal", seq: 1 } });
    const risen = container.querySelectorAll(".savings-plot--rise");
    expect(risen.length).toBe(1);
    expect((risen[0] as HTMLElement).dataset.structureId).toBe("goal");
  });

  it("AC-F13-11(b): a per-structure ladderOverrides entry changes only that structure's pip count, all five plots still share one height", () => {
    const shortLadder = [1, 2, 3];
    const withoutOverride = mount({ ladder: shortLadder, ladderOverrides: {} });
    const pipsWithout = new Map(
      [...withoutOverride.querySelectorAll(".savings-plot")].map((p) => [
        (p as HTMLElement).dataset.structureId,
        p.querySelectorAll(".savings-pip").length,
      ]),
    );
    const heightWithout = (withoutOverride.querySelector(".savings-plot") as HTMLElement).style.height;
    mounted?.unmount();

    const longerStock = [1, 2, 3, 4, 5];
    const withOverride = mount({ ladder: shortLadder, ladderOverrides: { stock: longerStock } });
    for (const plot of withOverride.querySelectorAll(".savings-plot")) {
      const id = (plot as HTMLElement).dataset.structureId;
      const pipCount = plot.querySelectorAll(".savings-pip").length;
      if (id === "stock") expect(pipCount).toBe(longerStock.length);
      else expect(pipCount).toBe(pipsWithout.get(id));
      // shared-longest rule (§2.5): every plot's reserved height still agrees.
      expect((plot as HTMLElement).style.height).toBe((withOverride.querySelector(".savings-plot") as HTMLElement).style.height);
    }
    expect((withOverride.querySelector(".savings-plot") as HTMLElement).style.height).not.toBe(heightWithout);
  });

  it("a longer shared ladder grows the reserved plot height", () => {
    const short = mount({ ladder: [1, 2, 3] });
    const shortHeight = Number((short.querySelector(".savings-plot") as HTMLElement).style.height.replace("px", ""));
    mounted?.unmount();

    const long = mount({ ladder: [1, 2, 3, 4, 5, 6, 7, 8] });
    const longHeight = Number((long.querySelector(".savings-plot") as HTMLElement).style.height.replace("px", ""));
    expect(longHeight).toBeGreaterThan(shortHeight);
  });

  // AC-F13-7 (round-2 finding C1 #3) — the inline style/geometry identity
  // was previously unasserted anywhere in the suite: run at two different
  // `ladder` lengths, plus once more with a `ladderOverrides` entry longer
  // than `ladder`, and check every plot's inline height/template against
  // townLayout.ts's own functions rather than against each other.
  it("AC-F13-7: every .savings-plot's inline height/gridTemplateRows and every .savings-structure's inline height equal townLayout.ts's functions, exactly", () => {
    const cases: Array<Pick<SavingsRowProps, "ladder" | "ladderOverrides" | "savingsByCategoryKrw">> = [
      { ladder: [1, 2, 3], ladderOverrides: {}, savingsByCategoryKrw: { deposit: 3 } },
      { ladder: [1, 2, 3, 4, 5, 6, 7, 8], ladderOverrides: {}, savingsByCategoryKrw: { stock: 4 } },
      { ladder: [1, 2, 3], ladderOverrides: { goal: [1, 2, 3, 4, 5] }, savingsByCategoryKrw: { emergency: 1 } },
    ];
    for (const props of cases) {
      const container = mount(props);
      const len = districtLadderLength(props.ladder!, props.ladderOverrides!);
      const expectedPlotHeight = `${savingsPlotHeightPx(len)}px`;
      const expectedTemplate = savingsPlotTemplateRows(len);
      for (const plot of container.querySelectorAll(".savings-plot")) {
        const el = plot as HTMLElement;
        expect(el.style.height).toBe(expectedPlotHeight);
        expect(el.style.gridTemplateRows).toBe(expectedTemplate);

        const id = el.dataset.structureId as SavingCategoryId;
        const ownLadder = ladderFor(id, props.ladder!, props.ladderOverrides!);
        const level = towerSegments(props.savingsByCategoryKrw?.[id] ?? 0, ownLadder);
        const structure = el.querySelector(".savings-structure") as HTMLElement;
        expect(structure.style.height).toBe(`${structureLevelHeightPx(level)}px`);
      }
      mounted?.unmount();
      mounted = null;
    }
  });

  // Round-2 finding C1 #2 — the level-0 idle-animation leak. A structure at
  // level 0 has nothing standing on the lot, only its signboard + emptyHint
  // text, and that text must never carry an infinite idle loop.
  it("a level-0 (empty) structure never carries a savings-idle--* class, even when its kind has one", () => {
    const container = mount(); // no savingsByCategoryKrw -> every structure at level 0
    for (const id of SAVING_CATEGORY_IDS) {
      // every one of the five ids' idleAnim is non-"none" except other_saving,
      // which already proves nothing here — assert on the whole set anyway.
      const structure = container.querySelector(`[data-structure-id="${id}"] .savings-structure`) as HTMLElement;
      expect([...structure.classList].some((c) => c.startsWith("savings-idle--"))).toBe(false);
    }
  });

  it("a non-empty (level >= 1) structure with a real idleAnim does carry its savings-idle--* class", () => {
    const container = mount({ savingsByCategoryKrw: { deposit: 3 } }); // ladder [1,2,3] -> level 3, SAVINGS_STRUCTURE.deposit.idleAnim === "seal-glint"
    const structure = container.querySelector('[data-structure-id="deposit"] .savings-structure') as HTMLElement;
    expect(structure.classList.contains(`savings-idle--${SAVINGS_STRUCTURE.deposit.idleAnim}`)).toBe(true);
  });

  // Round-4 finding C1 #2 — `justGrew` is a one-shot event, not sticky
  // state; the rising structure must report back when its animation ends so
  // `useTownStore` can clear it (`onRiseSettled`, mirroring `dismissNotice`)
  // and fall back to its idle loop instead of staying risen forever.
  it("round-4 C1 #2: the rising structure's native animationend calls onRiseSettled exactly once", () => {
    // jsdom has no `AnimationEvent` global (this file's own header note: no
    // layout engine either); react-dom's own vendor-prefix feature detection
    // (getVendorPrefixedEventName) reacts to that by picking jsdom's
    // WebKit-prefixed `style.WebkitAnimation` over the unprefixed property,
    // so under THIS test environment specifically, React listens for
    // `webkitAnimationEnd`, not `animationend` (a real browser has
    // `AnimationEvent` and keeps the unprefixed name — production is
    // unaffected). Dispatching the plain, unprefixed event here would
    // silently no-op rather than fail, which is worse than using the name
    // React actually registered.
    const ANIMATION_END_EVENT = "AnimationEvent" in window ? "animationend" : "webkitAnimationEnd";
    let calls = 0;
    const container = mount({ justGrew: { id: "goal", seq: 1 }, onRiseSettled: () => (calls += 1) });
    const structure = container.querySelector('[data-structure-id="goal"] .savings-structure') as HTMLElement;
    structure.dispatchEvent(new Event(ANIMATION_END_EVENT, { bubbles: true }));
    expect(calls).toBe(1);

    // Only the RISING structure listens — a non-rising sibling's idle loop
    // (an infinite animation) never fires `animationend` for real, but this
    // also proves the handler isn't wired to every `.savings-structure`.
    const other = container.querySelector('[data-structure-id="deposit"] .savings-structure') as HTMLElement;
    other.dispatchEvent(new Event(ANIMATION_END_EVENT, { bubbles: true }));
    expect(calls).toBe(1);
  });

  // Round-4 finding C1 #1/#3/#6 — the level-0 lot's board+hint previously
  // painted over the label/pip rows below it (a real screenshot regression).
  // jsdom has no layout engine (this file's own header note), so a real
  // bounding-box assertion isn't possible here — this instead asserts the
  // CODE CONTRACT that makes the overflow direction upward-only (a flex
  // column packed to its end always overflows off its START edge, never its
  // end), for every level, so the fix can't silently regress back to plain
  // block flow (which overflows downward, over the label row).
  it("round-4 C1 #1/#6: .savings-structure is a flex column packed to its end, at every level — the code contract that keeps overflow from ever painting the label row below it", () => {
    const container = mount({ savingsByCategoryKrw: { deposit: 3 } }); // deposit at level 3 (non-empty), the rest at level 0 (empty)
    for (const structure of container.querySelectorAll(".savings-structure")) {
      const el = structure as HTMLElement;
      expect(el.style.display).toBe("flex");
      expect(el.style.flexDirection).toBe("column");
      expect(el.style.justifyContent).toBe("flex-end");
    }
  });
});
