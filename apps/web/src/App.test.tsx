import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import "./test/setup";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("App", () => {
  it("shows the main planning prompt and loaded content", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          id: "user-1",
          name: "Shish",
          targetRole: "SDE_1",
          prepDeadline: "2026-09-11T18:29:59.000Z",
        },
        overallCompletionPercentage: 42,
        streak: 4,
        studyMinutesThisWeek: 175,
        solvedProblems: 8,
        pendingTopics: 6,
        dueRevisionCount: 2,
        progress: [],
        todaysPlan: {
          date: "2026-08-11",
          availableMinutes: 90,
          completionRate: 44,
          tasks: [
            {
              id: "task-1",
              title: "DSA - Strings",
              status: "COMPLETED",
              plannedMinutes: 40,
              actualMinutes: 40,
            },
          ],
        },
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "topic-1",
          slug: "strings",
          name: "Strings",
          category: "DSA",
          parentTopicId: null,
          difficulty: "MEDIUM",
          priority: "CRITICAL",
          estimatedHours: 10,
          recommendedProblems: 12,
          status: "IN_PROGRESS",
          completionPercentage: 35,
          notes: "Current focus",
        },
      ],
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "plan-1",
        planDate: "2026-08-11",
        availableMinutes: 90,
        plannedStudyMinutes: 90,
        completedStudyMinutes: 40,
        completionRate: 44,
        source: "RULE_BASED",
        summary: "Keep the day realistic.",
        tasks: [
          {
            id: "task-1",
            title: "DSA - Strings",
            description: "Solve Longest Common Prefix and Isomorphic Strings.",
            status: "COMPLETED",
            priority: "CRITICAL",
            plannedMinutes: 40,
            actualMinutes: 40,
            topic: "Strings",
          },
        ],
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "revision-1",
          dueAt: "2026-08-11T00:00:00.000Z",
          status: "PENDING",
          intervalDays: 7,
          confidenceAtSchedule: 3,
          problem: {
            id: "problem-2",
            title: "Nth Highest Salary",
            platform: "LeetCode",
            topic: "SQL",
          },
        },
      ],
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "problem-1",
          title: "Longest Common Prefix",
          platform: "LeetCode",
          url: "https://leetcode.com/problems/longest-common-prefix/",
          topic: "Strings",
          topicSlug: "strings",
          difficulty: "EASY",
          pattern: "Prefix scanning",
          status: "NOT_STARTED",
          attemptsCount: 0,
          confidenceScore: null,
          revisionDate: null,
        },
      ],
    });

    render(<App />);

    expect(
      await screen.findByText(/what do i study today/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /not started/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Nth Highest Salary/i)).toBeInTheDocument();
  });
});
