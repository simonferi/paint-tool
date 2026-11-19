import { describe, expect, it } from "vitest";
import { createProject } from "./project-factory";
import { projectSchema } from "./project";

describe("project contracts", () => {
  it("creates a valid versioned project", () => {
    const project = createProject("  Téli tanulmány  ");

    expect(project.name).toBe("Téli tanulmány");
    expect(projectSchema.parse(project)).toEqual(project);
  });

  it("rejects an empty project name", () => {
    expect(() => projectSchema.parse(createProject(" "))).not.toThrow();
    expect(() => projectSchema.parse({ ...createProject("x"), name: "" })).toThrow();
  });
});
