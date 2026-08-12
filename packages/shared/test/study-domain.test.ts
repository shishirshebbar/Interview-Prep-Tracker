import { describe, expect, it } from "vitest";
import {
  defaultStudySchedule,
  interviewPriorities,
} from "../src/study-domain.js";

describe("study domain defaults", () => {
  it("keeps the expected weekday study window", () => {
    expect(defaultStudySchedule.weekday.studyMinutes).toBe(90);
    expect(defaultStudySchedule.weekend.studyMinutes).toBe(480);
  });

  it("keeps DSA as the top interview priority", () => {
    expect(interviewPriorities[0]?.area).toBe("DSA");
  });
});
