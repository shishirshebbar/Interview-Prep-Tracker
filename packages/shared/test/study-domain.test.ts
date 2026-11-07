import { describe, expect, it } from "vitest";
import {
  currentDateInTimeZone,
  defaultStudySchedule,
  generateDailyPlan,
  interviewPriorities,
  revisionIntervalDays,
} from "../src/study-domain.js";

describe("study domain defaults", () => {
  it("keeps the expected weekday study window", () => {
    expect(defaultStudySchedule.weekday.studyMinutes).toBe(90);
    expect(defaultStudySchedule.weekend.studyMinutes).toBe(480);
  });

  it("keeps DSA as the top interview priority", () => {
    expect(interviewPriorities[0]?.area).toBe("DSA");
  });

  it("generates a DSA-first plan within the available time", () => {
    const tasks = generateDailyPlan({
      availableMinutes: 90,
      topics: [
        {
          slug: "strings",
          name: "Strings",
          category: "DSA",
          parentTopicId: "dsa",
          priority: "CRITICAL",
          completionPercentage: 35,
          notes: null,
        },
        {
          slug: "core-java",
          name: "Core Java",
          category: "CORE_JAVA",
          parentTopicId: null,
          priority: "CRITICAL",
          completionPercentage: 60,
          notes: null,
        },
        {
          slug: "sql",
          name: "SQL",
          category: "SQL",
          parentTopicId: null,
          priority: "HIGH",
          completionPercentage: 65,
          notes: null,
        },
        {
          slug: "dbms",
          name: "DBMS",
          category: "DBMS",
          parentTopicId: null,
          priority: "HIGH",
          completionPercentage: 45,
          notes: null,
        },
        {
          slug: "javascript",
          name: "JavaScript",
          category: "JAVASCRIPT",
          parentTopicId: null,
          priority: "HIGH",
          completionPercentage: 10,
          notes: null,
        },
        {
          slug: "resume-prep",
          name: "Resume Readiness",
          category: "RESUME",
          parentTopicId: null,
          priority: "MEDIUM",
          completionPercentage: 40,
          notes: null,
        },
      ],
      problems: [
        {
          title: "Longest Common Prefix",
          topicSlug: "strings",
          status: "NOT_STARTED",
        },
        {
          title: "Remove Outermost Parentheses",
          topicSlug: "strings",
          status: "SOLVED",
        },
      ],
      dueRevisions: ["Reverse Words in a String"],
    });

    expect(tasks.reduce((total, task) => total + task.plannedMinutes, 0)).toBe(
      90,
    );
    expect(tasks[0]).toMatchObject({
      title: "DSA - Strings",
      plannedMinutes: 40,
      description: expect.stringContaining("Longest Common Prefix"),
    });
    expect(tasks[0]?.description).not.toContain("Remove Outermost Parentheses");
  });

  it("carries forward at most one unfinished task without exceeding capacity", () => {
    const tasks = generateDailyPlan({
      availableMinutes: 90,
      topics: [
        {
          slug: "strings",
          name: "Strings",
          category: "DSA",
          parentTopicId: "dsa",
          priority: "CRITICAL",
          completionPercentage: 35,
          notes: null,
        },
        {
          slug: "java",
          name: "Core Java",
          category: "CORE_JAVA",
          parentTopicId: null,
          priority: "HIGH",
          completionPercentage: 60,
          notes: null,
        },
      ],
      problems: [],
      dueRevisions: [],
      carryOver: [
        {
          title: "Core Java - Exceptions",
          description: null,
          taskType: "CORE_JAVA",
          priority: "HIGH",
          plannedMinutes: 20,
          topicSlug: "java",
        },
        {
          title: "Old task",
          description: null,
          taskType: "SQL",
          priority: "LOW",
          plannedMinutes: 10,
          topicSlug: null,
        },
      ],
    });

    expect(
      tasks.filter((task) => task.title.startsWith("Carry over:")),
    ).toHaveLength(1);
    expect(tasks[0]?.plannedMinutes).toBe(10);
    expect(tasks.reduce((total, task) => total + task.plannedMinutes, 0)).toBe(
      90,
    );
  });

  it("breaks an eight-hour weekend plan into focused blocks of at most an hour", () => {
    const tasks = generateDailyPlan({
      availableMinutes: 480,
      topics: [
        {
          slug: "strings",
          name: "Strings",
          category: "DSA",
          parentTopicId: "dsa",
          priority: "CRITICAL",
          completionPercentage: 35,
          notes: null,
        },
      ],
      problems: [],
      dueRevisions: [],
    });

    expect(tasks.reduce((total, task) => total + task.plannedMinutes, 0)).toBe(
      480,
    );
    expect(tasks).toHaveLength(8);
    expect(tasks.every((task) => task.plannedMinutes <= 60)).toBe(true);
  });

  it("uses configured confidence-based revision intervals", () => {
    expect(revisionIntervalDays(1)).toBe(1);
    expect(revisionIntervalDays(3, [2, 4, 8, 16, 32])).toBe(8);
    expect(() => revisionIntervalDays(6)).toThrow(RangeError);
  });

  it("formats the current date in the requested timezone", () => {
    expect(
      currentDateInTimeZone("Asia/Kolkata", new Date("2026-11-07T20:00:00Z")),
    ).toBe("2026-11-08");
  });
});
