import { describe, expect, it } from "vitest";
import { isStorySpec, isEpicSpec, isProjectSpec } from "./index";

describe("validation logic", () => {
  describe("isStorySpec", () => {
    it("returns true for valid story spec", () => {
      const validStory = {
        title: "Test story",
        description: "A description"
      };
      expect(isStorySpec(validStory)).toBe(true);
    });

    it("returns true for valid story spec with all fields", () => {
      const validStory = {
        title: "Test story",
        description: "A description",
        assignee: "atul",
        milestone: "M1"
      };
      expect(isStorySpec(validStory)).toBe(true);
    });

    it("returns false for invalid story spec", () => {
      expect(isStorySpec(null)).toBe(false);
      expect(isStorySpec({})).toBe(false);
      expect(isStorySpec({ title: "" })).toBe(false);
      expect(isStorySpec({ title: "T", description: 123 })).toBe(false);
      expect(isStorySpec({ title: "T", description: "D", assignee: 123 })).toBe(false);
      expect(isStorySpec({ title: "T", description: "D", milestone: 123 })).toBe(false);
    });
  });

  describe("isEpicSpec", () => {
    it("returns true for valid epic spec", () => {
      const validEpic = {
        title: "Test epic",
        description: "A description"
      };
      expect(isEpicSpec(validEpic)).toBe(true);
    });

    it("returns true for valid epic spec with stories", () => {
      const validEpic = {
        title: "Test epic",
        description: "A description",
        stories: [
          { title: "S1", description: "D1" },
          { title: "S2", description: "D2" }
        ]
      };
      expect(isEpicSpec(validEpic)).toBe(true);
    });

    it("returns false for invalid epic spec", () => {
      expect(isEpicSpec({ title: "T", description: "D", stories: "invalid" })).toBe(false);
      expect(isEpicSpec({ title: "T", description: "D", stories: [{ title: "" }] })).toBe(false);
    });
  });

  describe("isProjectSpec", () => {
    it("returns true for valid project spec", () => {
      const validProject = {
        project: {
          name: "Test project",
          description: "A description"
        }
      };
      expect(isProjectSpec(validProject)).toBe(true);
    });

    it("returns true for full project spec", () => {
      const validProject = {
        project: {
          name: "Test project",
          description: "A description"
        },
        milestones: [{ name: "M1" }],
        epics: [
          {
            title: "E1",
            description: "D1",
            stories: [{ title: "S1", description: "D1" }]
          }
        ]
      };
      expect(isProjectSpec(validProject)).toBe(true);
    });

    it("returns false for invalid project spec", () => {
      expect(isProjectSpec({})).toBe(false);
      expect(isProjectSpec({ project: { name: "" } })).toBe(false);
      expect(isProjectSpec({ project: { name: "P", description: "D" }, milestones: "invalid" })).toBe(false);
      expect(isProjectSpec({ project: { name: "P", description: "D" }, epics: "invalid" })).toBe(false);
    });
  });
});
