import {
  type DifficultyLevel,
  ProblemStatus,
  RevisionStatus,
  TopicStatus,
} from "@prisma/client";
import type {
  PlanSource,
  PriorityLevel,
  TaskStatus,
  TopicCategory,
} from "@prisma/client";
import { prisma } from "@tracker/db";

export interface DashboardData {
  user: {
    id: string;
    name: string;
    targetRole: string;
    prepDeadline: string;
  };
  overallCompletionPercentage: number;
  streak: number;
  studyMinutesThisWeek: number;
  solvedProblems: number;
  pendingTopics: number;
  dueRevisionCount: number;
  progress: Array<{
    label: string;
    category: TopicCategory;
    completionPercentage: number;
  }>;
  todaysPlan: {
    date: string;
    availableMinutes: number;
    completionRate: number;
    tasks: Array<{
      id: string;
      title: string;
      status: TaskStatus;
      plannedMinutes: number;
      actualMinutes: number;
    }>;
  } | null;
}

export interface TopicListItem {
  id: string;
  slug: string;
  name: string;
  category: TopicCategory;
  parentTopicId: string | null;
  difficulty: string;
  priority: PriorityLevel;
  estimatedHours: number;
  recommendedProblems: number;
  status: TopicStatus;
  completionPercentage: number;
  notes: string | null;
}

export interface ProblemListFilters {
  topic?: string;
  status?: ProblemStatus;
  difficulty?: DifficultyLevel;
  platform?: string;
}

export interface ProblemListItem {
  id: string;
  title: string;
  platform: string;
  url: string | null;
  topic: string;
  topicSlug: string;
  difficulty: string;
  pattern: string | null;
  status: ProblemStatus;
  attemptsCount: number;
  confidenceScore: number | null;
  revisionDate: string | null;
}

export interface ProblemAttemptInput {
  statusAfterAttempt: ProblemStatus;
  wasSuccessful: boolean;
  durationMinutes?: number;
  confidenceScore?: number;
  notes?: string;
  solutionApproach?: string;
  mistakes?: string;
}

export interface DailyPlanData {
  id: string;
  planDate: string;
  availableMinutes: number;
  plannedStudyMinutes: number;
  completedStudyMinutes: number;
  completionRate: number;
  source: PlanSource;
  summary: string | null;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: PriorityLevel;
    plannedMinutes: number;
    actualMinutes: number;
    topic: string | null;
  }>;
}

export interface DailyTaskUpdateInput {
  status: TaskStatus;
}

export interface DueRevisionItem {
  id: string;
  dueAt: string;
  status: RevisionStatus;
  intervalDays: number;
  confidenceAtSchedule: number;
  problem: {
    id: string;
    title: string;
    platform: string;
    topic: string;
  };
}

export interface TrackerRepository {
  getDashboard(): Promise<DashboardData>;
  listTopics(): Promise<TopicListItem[]>;
  listProblems(filters: ProblemListFilters): Promise<ProblemListItem[]>;
  updateProblemStatus(
    problemId: string,
    status: ProblemStatus,
  ): Promise<ProblemListItem | null>;
  createProblemAttempt(
    problemId: string,
    input: ProblemAttemptInput,
  ): Promise<ProblemListItem | null>;
  getDailyPlan(date: string): Promise<DailyPlanData | null>;
  updateDailyTaskStatus(
    taskId: string,
    input: DailyTaskUpdateInput,
  ): Promise<DailyPlanData["tasks"][number] | null>;
  getDueRevisions(date: string): Promise<DueRevisionItem[]>;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function getDefaultUserId() {
  const user = await prisma.user.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("No user found. Seed the database first.");
  }

  return user.id;
}

export const prismaRepository: TrackerRepository = {
  async getDashboard() {
    const userId = await getDefaultUserId();
    const today = "2026-08-11";

    const [user, topicProgress, revisions, analytics, todaysPlan] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            targetRole: true,
            prepDeadline: true,
          },
        }),
        prisma.topicProgress.findMany({
          where: { userId },
          include: {
            topic: {
              select: {
                category: true,
              },
            },
          },
        }),
        prisma.revision.count({
          where: {
            userId,
            status: RevisionStatus.PENDING,
            dueAt: {
              lte: new Date(`${today}T23:59:59.999Z`),
            },
          },
        }),
        prisma.analyticsSnapshot.findMany({
          where: { userId },
          orderBy: {
            snapshotDate: "desc",
          },
          take: 7,
        }),
        prisma.dailyPlan.findFirst({
          where: {
            userId,
            planDate: {
              gte: new Date(`${today}T00:00:00.000Z`),
              lte: new Date(`${today}T23:59:59.999Z`),
            },
          },
          include: {
            tasks: {
              orderBy: {
                orderIndex: "asc",
              },
            },
          },
        }),
      ]);

    const totalCompletion = topicProgress.length
      ? Math.round(
          topicProgress.reduce(
            (sum, item) => sum + item.completionPercentage,
            0,
          ) / topicProgress.length,
        )
      : 0;

    const progressByCategory = new Map<
      TopicCategory,
      { total: number; count: number }
    >();

    for (const item of topicProgress) {
      const current = progressByCategory.get(item.topic.category) ?? {
        total: 0,
        count: 0,
      };

      current.total += item.completionPercentage;
      current.count += 1;
      progressByCategory.set(item.topic.category, current);
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        targetRole: user.targetRole,
        prepDeadline: user.prepDeadline.toISOString(),
      },
      overallCompletionPercentage: totalCompletion,
      streak: analytics[0]?.streak ?? 0,
      studyMinutesThisWeek: analytics.reduce(
        (sum, item) => sum + item.studyMinutes,
        0,
      ),
      solvedProblems: await prisma.problem.count({
        where: {
          userId,
          status: {
            in: [ProblemStatus.SOLVED, ProblemStatus.MASTERED],
          },
        },
      }),
      pendingTopics: topicProgress.filter(
        (item) => item.status !== TopicStatus.COMPLETE,
      ).length,
      dueRevisionCount: revisions,
      progress: Array.from(progressByCategory.entries()).map(
        ([category, value]) => ({
          label: category,
          category,
          completionPercentage: Math.round(value.total / value.count),
        }),
      ),
      todaysPlan: todaysPlan
        ? {
            date: toIsoDate(todaysPlan.planDate),
            availableMinutes: todaysPlan.availableMinutes,
            completionRate: todaysPlan.completionRate,
            tasks: todaysPlan.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              status: task.status,
              plannedMinutes: task.plannedMinutes,
              actualMinutes: task.actualMinutes,
            })),
          }
        : null,
    };
  },

  async listTopics() {
    const userId = await getDefaultUserId();
    const rows = await prisma.studyTopic.findMany({
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
      include: {
        progressEntries: {
          where: { userId },
          take: 1,
        },
      },
    });

    return rows.map((row) => {
      const progress = row.progressEntries[0];

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.category,
        parentTopicId: row.parentTopicId,
        difficulty: row.difficulty,
        priority: row.priority,
        estimatedHours: row.estimatedHours,
        recommendedProblems: row.recommendedProblems,
        status: progress?.status ?? TopicStatus.NOT_STARTED,
        completionPercentage: progress?.completionPercentage ?? 0,
        notes: progress?.notes ?? null,
      };
    });
  },

  async listProblems(filters) {
    const userId = await getDefaultUserId();
    const rows = await prisma.problem.findMany({
      where: {
        userId,
        status: filters.status,
        platform: filters.platform,
        difficulty: filters.difficulty,
        topic: filters.topic
          ? {
              slug: filters.topic,
            }
          : undefined,
      },
      include: {
        topic: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { title: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      platform: row.platform,
      url: row.url,
      topic: row.topic.name,
      topicSlug: row.topic.slug,
      difficulty: row.difficulty,
      pattern: row.pattern,
      status: row.status,
      attemptsCount: row.attemptsCount,
      confidenceScore: row.confidenceScore,
      revisionDate: row.revisionDate?.toISOString() ?? null,
    }));
  },

  async updateProblemStatus(problemId, status) {
    const userId = await getDefaultUserId();
    const existing = await prisma.problem.findFirst({
      where: {
        id: problemId,
        userId,
      },
      include: {
        topic: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!existing) {
      return null;
    }

    await prisma.problem.update({
      where: {
        id: problemId,
      },
      data: {
        status,
      },
    });

    const row = await prisma.problem.findUniqueOrThrow({
      where: {
        id: problemId,
      },
      include: {
        topic: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      id: row.id,
      title: row.title,
      platform: row.platform,
      url: row.url,
      topic: row.topic.name,
      topicSlug: row.topic.slug,
      difficulty: row.difficulty,
      pattern: row.pattern,
      status: row.status,
      attemptsCount: row.attemptsCount,
      confidenceScore: row.confidenceScore,
      revisionDate: row.revisionDate?.toISOString() ?? null,
    };
  },

  async createProblemAttempt(problemId, input) {
    const userId = await getDefaultUserId();

    const existing = await prisma.problem.findFirst({
      where: {
        id: problemId,
        userId,
      },
      include: {
        topic: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!existing) {
      return null;
    }

    await prisma.$transaction([
      prisma.problemAttempt.create({
        data: {
          userId,
          problemId,
          statusAfterAttempt: input.statusAfterAttempt,
          wasSuccessful: input.wasSuccessful,
          durationMinutes: input.durationMinutes,
          confidenceScore: input.confidenceScore,
          notes: input.notes,
          solutionApproach: input.solutionApproach,
          mistakes: input.mistakes,
        },
      }),
      prisma.problem.update({
        where: { id: problemId },
        data: {
          status: input.statusAfterAttempt,
          attemptsCount: {
            increment: 1,
          },
          timeTakenMinutes: input.durationMinutes ?? existing.timeTakenMinutes,
          confidenceScore: input.confidenceScore ?? existing.confidenceScore,
          notes: input.notes ?? existing.notes,
          solutionApproach: input.solutionApproach ?? existing.solutionApproach,
          mistakes: input.mistakes ?? existing.mistakes,
          solvedAt: input.wasSuccessful ? new Date() : existing.solvedAt,
        },
      }),
    ]);

    const updated = await prisma.problem.findUniqueOrThrow({
      where: { id: problemId },
      include: {
        topic: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      platform: updated.platform,
      url: updated.url,
      topic: updated.topic.name,
      topicSlug: updated.topic.slug,
      difficulty: updated.difficulty,
      pattern: updated.pattern,
      status: updated.status,
      attemptsCount: updated.attemptsCount,
      confidenceScore: updated.confidenceScore,
      revisionDate: updated.revisionDate?.toISOString() ?? null,
    };
  },

  async getDailyPlan(date) {
    const userId = await getDefaultUserId();
    const plan = await prisma.dailyPlan.findFirst({
      where: {
        userId,
       planDate: {
  gte: new Date(`${date}T00:00:00+05:30`),
  lte: new Date(`${date}T23:59:59.999+05:30`),
},
      },
      include: {
        tasks: {
          include: {
            topic: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            orderIndex: "asc",
          },
        },
      },
    });

    if (!plan) {
      return null;
    }

    return {
      id: plan.id,
      planDate: toIsoDate(plan.planDate),
      availableMinutes: plan.availableMinutes,
      plannedStudyMinutes: plan.plannedStudyMinutes,
      completedStudyMinutes: plan.completedStudyMinutes,
      completionRate: plan.completionRate,
      source: plan.source,
      summary: plan.summary,
      tasks: plan.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        plannedMinutes: task.plannedMinutes,
        actualMinutes: task.actualMinutes,
        topic: task.topic?.name ?? null,
      })),
    };
  },

  async getDueRevisions(date) {
    const userId = await getDefaultUserId();
    const rows = await prisma.revision.findMany({
      where: {
        userId,
        status: RevisionStatus.PENDING,
        dueAt: {
          lte: new Date(`${date}T23:59:59.999Z`),
        },
      },
      include: {
        problem: {
          include: {
            topic: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        dueAt: "asc",
      },
    });

    return rows.map((row) => ({
      id: row.id,
      dueAt: row.dueAt.toISOString(),
      status: row.status,
      intervalDays: row.intervalDays,
      confidenceAtSchedule: row.confidenceAtSchedule,
      problem: {
        id: row.problem.id,
        title: row.problem.title,
        platform: row.problem.platform,
        topic: row.problem.topic.name,
      },
    }));
  },

  async updateDailyTaskStatus(taskId, input) {
    const userId = await getDefaultUserId();
    const task = await prisma.dailyTask.findFirst({
      where: {
        id: taskId,
        dailyPlan: {
          userId,
        },
      },
      include: {
        topic: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!task) {
      return null;
    }

    const updatedTask = await prisma.dailyTask.update({
      where: {
        id: taskId,
      },
      data: {
        status: input.status,
        actualMinutes:
          input.status === "COMPLETED"
            ? task.actualMinutes > 0
              ? task.actualMinutes
              : task.plannedMinutes
            : input.status === "SKIPPED"
              ? 0
              : task.actualMinutes,
      },
      include: {
        topic: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      id: updatedTask.id,
      title: updatedTask.title,
      description: updatedTask.description,
      status: updatedTask.status,
      priority: updatedTask.priority,
      plannedMinutes: updatedTask.plannedMinutes,
      actualMinutes: updatedTask.actualMinutes,
      topic: updatedTask.topic?.name ?? null,
    };
  },
};
