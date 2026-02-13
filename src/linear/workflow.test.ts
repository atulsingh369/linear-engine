import { describe, expect, it } from "vitest";
import { findStateByName, getFirstActiveState, getStateNameById } from "./workflow";

describe("workflow helpers", () => {
  it("matches state by name case-insensitively", () => {
    const state = findStateByName(
      [
        { id: "1", name: "Todo" },
        { id: "2", name: "In Progress" }
      ],
      "in progress"
    );

    expect(state?.id).toBe("2");
  });

  it("returns first started state for start command", () => {
    const state = getFirstActiveState([
      { id: "a", name: "Todo", type: "unstarted", position: 1 },
      { id: "b", name: "In Progress", type: "started", position: 2 },
      { id: "c", name: "Done", type: "completed", position: 3 }
    ]);

    expect(state?.id).toBe("b");
  });

  it("resolves state name by id", () => {
    const name = getStateNameById(
      [
        { id: "a", name: "Todo" },
        { id: "b", name: "Done" }
      ],
      "b"
    );

    expect(name).toBe("Done");
  });
});
