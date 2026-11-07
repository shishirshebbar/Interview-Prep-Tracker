import {
  PlanSource,
  PriorityLevel,
  ProblemStatus,
  RevisionStatus,
  TaskStatus,
  TopicCategory,
  TopicStatus,
} from "@prisma/client";
import type {
  DailyPlanData,
  DailyTaskUpdateInput,
  DueRevisionItem,
  ProblemAttemptInput,
  ProblemListFilters,
  ProblemListItem,
  TopicListItem,
  TrackerRepository,
} from "../src/lib/repository.js";

const problems: ProblemListItem[] = [
  {
    id: "problem-1",
    title: "Longest Common Prefix",
    platform: "LeetCode",
    url: "https://leetcode.com/problems/longest-common-prefix/",
    topic: "Strings",
    topicSlug: "strings",
    difficulty: "EASY",
    pattern: "Prefix scanning",
    status: ProblemStatus.NOT_STARTED,
    attemptsCount: 0,
    confidenceScore: null,
    revisionDate: null,
  },
  {
    id: "problem-2",
    title: "Nth Highest Salary",
    platform: "LeetCode",
    url: "https://leetcode.com/problems/nth-highest-salary/",
    topic: "SQL",
    topicSlug: "sql",
    difficulty: "MEDIUM",
    pattern: "Ranking",
    status: ProblemStatus.SOLVED,
    attemptsCount: 2,
    confidenceScore: 3,
    revisionDate: "2026-08-11T00:00:00.000Z",
  },
];

const topics: TopicListItem[] = [
  {
    id: "topic-1",
    slug: "strings",
    name: "Strings",
    category: TopicCategory.DSA,
    parentTopicId: "topic-root",
    difficulty: "MEDIUM",
    priority: PriorityLevel.CRITICAL,
    estimatedHours: 10,
    recommendedProblems: 12,
    status: TopicStatus.IN_PROGRESS,
    completionPercentage: 35,
    notes: "Current DSA focus.",
  },
  {
    id: "topic-2",
    slug: "sql",
    name: "SQL",
    category: TopicCategory.SQL,
    parentTopicId: null,
    difficulty: "MEDIUM",
    priority: PriorityLevel.HIGH,
    estimatedHours: 20,
    recommendedProblems: 18,
    status: TopicStatus.STRONG_FOUNDATION,
    completionPercentage: 65,
    notes: "Good foundation.",
  },
];

const dailyPlan: DailyPlanData = {
  id: "plan-1",
  planDate: "2026-08-11",
  availableMinutes: 90,
  plannedStudyMinutes: 90,
  completedStudyMinutes: 40,
  completionRate: 44,
  source: PlanSource.RULE_BASED,
  summary: "Keep the day realistic and DSA-first.",
  tasks: [
    {
      id: "task-1",
      title: "DSA - Strings",
      description: "Solve Longest Common Prefix and Isomorphic Strings.",
      status: TaskStatus.COMPLETED,
      priority: PriorityLevel.CRITICAL,
      plannedMinutes: 40,
      actualMinutes: 40,
      topic: "Strings",
    },
  ],
};

const revisions: DueRevisionItem[] = [
  {
    id: "revision-1",
    dueAt: "2026-08-11T00:00:00.000Z",
    status: RevisionStatus.PENDING,
    intervalDays: 7,
    confidenceAtSchedule: 3,
    problem: {
      id: "problem-2",
      title: "Nth Highest Salary",
      platform: "LeetCode",
      topic: "SQL",
    },
  },
];

export function createTestRepository(): TrackerRepository {
  const mutableProblems = structuredClone(problems);

  return {
    async getDashboard() {
      return {
        user: {
          id: "user-1",
          name: "Shish",
          targetRole: "SDE_1",
          prepDeadline: "2026-09-11T18:29:59.000Z",
        },
        overallCompletionPercentage: 42,
        streak: 4,
        studyMinutesThisWeek: 175,
        solvedProblems: 1,
        pendingTopics: 1,
        dueRevisionCount: 1,
        progress: [
          {
            label: "DSA",
            category: TopicCategory.DSA,
            completionPercentage: 35,
          },
        ],
        todaysPlan: {
          date: "2026-08-11",
          availableMinutes: 90,
          completionRate: 44,
          tasks: dailyPlan.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            plannedMinutes: task.plannedMinutes,
            actualMinutes: task.actualMinutes,
          })),
        },
      };
    },

    async listTopics() {
      return topics;
    },

    async listProblems(filters: ProblemListFilters) {
      return mutableProblems.filter((problem) => {
        return (
          (!filters.topic || problem.topicSlug === filters.topic) &&
          (!filters.status || problem.status === filters.status) &&
          (!filters.difficulty || problem.difficulty === filters.difficulty) &&
          (!filters.platform || problem.platform === filters.platform)
        );
      });
    },

    async updateProblemStatus(problemId, status) {
      const problem = mutableProblems.find((item) => item.id === problemId);

      if (!problem) {
        return null;
      }

      problem.status = status;
      return problem;
    },

    async createProblemAttempt(problemId, input: ProblemAttemptInput) {
      const problem = mutableProblems.find((item) => item.id === problemId);

      if (!problem) {
        return null;
      }

      problem.status = input.statusAfterAttempt;
      problem.attemptsCount += 1;
      problem.confidenceScore =
        input.confidenceScore ?? problem.confidenceScore;
      return problem;
    },

    async getDailyPlan(date: string) {
      return date === "2026-08-11" ? dailyPlan : null;
    },

    async generateDailyPlan(date: string) {
      if (date === dailyPlan.planDate) {
        return dailyPlan;
      }
      return {
        ...structuredClone(dailyPlan),
        id: `plan-${date}`,
        planDate: date,
        completedStudyMinutes: 0,
        completionRate: 0,
        tasks: dailyPlan.tasks.map((task) => ({
          ...task,
          id: `${date}-${task.id}`,
          status: TaskStatus.PLANNED,
          actualMinutes: 0,
        })),
      };
    },

    async updateDailyTaskStatus(taskId: string, input: DailyTaskUpdateInput) {
      const task = dailyPlan.tasks.find((item) => item.id === taskId);

      if (!task) {
        return null;
      }

      task.status = input.status;
      task.actualMinutes =
        input.status === TaskStatus.COMPLETED
          ? (input.actualMinutes ?? task.plannedMinutes)
          : input.status === TaskStatus.PARTIALLY_COMPLETED
            ? (input.actualMinutes ?? Math.floor(task.plannedMinutes / 2))
            : 0;
      return task;
    },

    async getDueRevisions(date: string) {
      return date >= "2026-08-11" ? revisions : [];
    },

    async completeRevision(revisionId: string) {
      return revisions.some((revision) => revision.id === revisionId);
    },
  };
}
