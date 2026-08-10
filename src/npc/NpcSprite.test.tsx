import { afterEach, describe, expect, it } from "vitest";
import { mountComponent, type MountedComponent } from "../testUtils/mount";
import { SPECIES } from "./species";
import { NpcSprite } from "./NpcSprite";

let mounted: MountedComponent | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("NpcSprite", () => {
  for (const species of SPECIES) {
    it(`renders "${species.id}" as inline SVG without throwing`, () => {
      mounted = mountComponent(<NpcSprite species={species} />);
      const svg = mounted.container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("viewBox")).toBe("0 0 220 224");
      // No stray <img>/<use>/network-referencing element — inline SVG only (hard constraint).
      expect(mounted.container.querySelector("img, use, image")).toBeNull();
    });
  }
});
