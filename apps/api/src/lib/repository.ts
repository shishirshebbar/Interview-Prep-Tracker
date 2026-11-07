import {
  type DifficultyLevel,
  ProblemStatus,
  RevisionStatus,
  TaskStatus,
  TopicStatus,
} from "@prisma/client";
import type { PlanSource, PriorityLevel, TopicCategory } from "@prisma/client";
import { prisma } from "@tracker/db";
import {
  currentDateInTimeZone,
  generateDailyPlan,
  revisionIntervalDays,
} from "@tracker/shared";
import { env } from "../config/env.js";

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
  actualMinutes?: number;
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
  generateDailyPlan(date: string): Promise<DailyPlanData>;
  updateDailyTaskStatus(
    taskId: string,
    input: DailyTaskUpdateInput,
  ): Promise<DailyPlanData["tasks"][number] | null>;
  getDueRevisions(date: string): Promise<DueRevisionItem[]>;
  completeRevision(revisionId: string): Promise<boolean>;
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dateBounds(date: string) {
  return {
    gte: new Date(`${date}T00:00:00.000Z`),
    lte: new Date(`${date}T23:59:59.999Z`),
  };
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
    const today = currentDateInTimeZone(env.TIMEZONE);

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
            dueAt: { lte: dateBounds(today).lte },
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
            planDate: dateBounds(today),
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

    await prisma.$transaction(async (transaction) => {
      await transaction.problemAttempt.create({
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
      });
      await transaction.problem.update({
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
      });

      if (input.confidenceScore !== undefined) {
        const settings = await transaction.userSettings.findUnique({
          where: { userId },
          select: { revisionIntervalsDays: true, timezone: true },
        });
        const intervalDays = revisionIntervalDays(
          input.confidenceScore,
          settings?.revisionIntervalsDays,
        );
        const dueAt = new Date(
          `${currentDateInTimeZone(settings?.timezone ?? env.TIMEZONE)}T00:00:00.000Z`,
        );
        dueAt.setUTCDate(dueAt.getUTCDate() + intervalDays);

        await transaction.revision.updateMany({
          where: {
            userId,
            problemId,
            status: RevisionStatus.PENDING,
          },
          data: { status: RevisionStatus.SKIPPED },
        });
        await transaction.revision.create({
          data: {
            userId,
            problemId,
            dueAt,
            confidenceAtSchedule: input.confidenceScore,
            intervalDays,
          },
        });
        await transaction.problem.update({
          where: { id: problemId },
          data: { revisionDate: dueAt },
        });
      }
    });

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
        planDate: dateBounds(date),
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

  async generateDailyPlan(date) {
    const userId = await getDefaultUserId();
    const bounds = dateBounds(date);
    const existing = await prisma.dailyPlan.findFirst({
      where: { userId, planDate: bounds },
      include: {
        tasks: {
          include: { topic: { select: { name: true } } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (existing) {
      return {
        id: existing.id,
        planDate: toIsoDate(existing.planDate),
        availableMinutes: existing.availableMinutes,
        plannedStudyMinutes: existing.plannedStudyMinutes,
        completedStudyMinutes: existing.completedStudyMinutes,
        completionRate: existing.completionRate,
        source: existing.source,
        summary: existing.summary,
        tasks: existing.tasks.map((task) => ({
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
    }

    const [settings, topics, problems, revisions, previousPlan] =
      await Promise.all([
        prisma.userSettings.findUnique({
          where: { userId },
          select: {
            weekdayStudyMinutes: true,
            weekendStudyMinutes: true,
          },
        }),
        prisma.studyTopic.findMany({
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          include: {
            progressEntries: { where: { userId }, take: 1 },
          },
        }),
        prisma.problem.findMany({
          where: { userId },
          select: {
            title: true,
            status: true,
            topic: { select: { slug: true } },
          },
        }),
        prisma.revision.findMany({
          where: {
            userId,
            status: RevisionStatus.PENDING,
            dueAt: { lte: bounds.lte },
          },
          include: { problem: { select: { title: true } } },
          orderBy: { dueAt: "asc" },
          take: 10,
        }),
        prisma.dailyPlan.findFirst({
          where: {
            userId,
            planDate: {
              gte: new Date(
                new Date(`${date}T00:00:00.000Z`).getTime() -
                  7 * 24 * 60 * 60 * 1000,
              ),
              lt: new Date(`${date}T00:00:00.000Z`),
            },
          },
          include: {
            tasks: {
              where: { status: { not: TaskStatus.COMPLETED } },
              orderBy: [{ priority: "desc" }, { orderIndex: "asc" }],
              take: 1,
              include: { topic: { select: { slug: true } } },
            },
          },
          orderBy: { planDate: "desc" },
        }),
      ]);

    const localDate = new Date(`${date}T12:00:00.000Z`);
    const weekday = localDate.getUTCDay();
    const availableMinutes =
      weekday === 0 || weekday === 6
        ? (settings?.weekendStudyMinutes ?? env.DEFAULT_WEEKEND_STUDY_MINUTES)
        : (settings?.weekdayStudyMinutes ?? env.DEFAULT_WEEKDAY_STUDY_MINUTES);
    const carryOver = previousPlan?.tasks[0];
    const tasks = generateDailyPlan({
      availableMinutes,
      topics: topics.map((topic) => ({
        slug: topic.slug,
        name: topic.name,
        category: topic.category,
        parentTopicId: topic.parentTopicId,
        priority: topic.priority,
        completionPercentage:
          topic.progressEntries[0]?.completionPercentage ?? 0,
        notes: topic.progressEntries[0]?.notes ?? null,
      })),
      problems: problems.map((problem) => ({
        title: problem.title,
        topicSlug: problem.topic.slug,
        status: problem.status,
      })),
      dueRevisions: revisions.map((revision) => revision.problem.title),
      carryOver: carryOver
        ? [
            {
              title: carryOver.title,
              description: carryOver.description,
              taskType: carryOver.taskType,
              priority: carryOver.priority,
              plannedMinutes: carryOver.plannedMinutes,
              topicSlug: carryOver.topic?.slug ?? null,
            },
          ]
        : [],
    });

    const plan = await prisma.dailyPlan.create({
      data: {
        userId,
        planDate: new Date(`${date}T00:00:00.000Z`),
        availableMinutes,
        plannedStudyMinutes: tasks.reduce(
          (total, task) => total + task.plannedMinutes,
          0,
        ),
        source: carryOver ? "RESCHEDULED" : "RULE_BASED",
        summary: carryOver
          ? "One unfinished task was carried forward into a realistic plan; missed work is not stacked."
          : `A realistic ${availableMinutes}-minute plan, weighted toward DSA and your highest-priority unfinished topics.`,
        tasks: {
          create: tasks.map((task, index) => ({
            topicId: task.topicSlug
              ? topics.find((topic) => topic.slug === task.topicSlug)?.id
              : undefined,
            title: task.title,
            description: task.description,
            taskType: task.taskType,
            priority: task.priority,
            orderIndex: index,
            plannedMinutes: task.plannedMinutes,
          })),
        },
      },
      include: {
        tasks: {
          include: { topic: { select: { name: true } } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

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
        dueAt: { lte: dateBounds(date).lte },
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

  async completeRevision(revisionId) {
    const userId = await getDefaultUserId();
    const revision = await prisma.revision.findFirst({
      where: {
        id: revisionId,
        userId,
        status: RevisionStatus.PENDING,
      },
      select: { id: true },
    });

    if (!revision) {
      return false;
    }

    await prisma.revision.update({
      where: { id: revision.id },
      data: {
        status: RevisionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    return true;
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

    const actualMinutes =
      input.status === TaskStatus.COMPLETED
        ? (input.actualMinutes ?? task.plannedMinutes)
        : input.status === TaskStatus.PARTIALLY_COMPLETED
          ? (input.actualMinutes ?? Math.floor(task.plannedMinutes / 2))
          : 0;
    if (actualMinutes > task.plannedMinutes) {
      throw new RangeError("Actual study time cannot exceed planned time.");
    }

    const updatedTask = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.dailyTask.update({
        where: { id: taskId },
        data: { status: input.status, actualMinutes },
        include: { topic: { select: { name: true } } },
      });
      const tasks = await transaction.dailyTask.findMany({
        where: { dailyPlanId: task.dailyPlanId },
        select: { status: true, actualMinutes: true },
      });
      const completedMinutes = tasks.reduce(
        (total, item) => total + item.actualMinutes,
        0,
      );
      const originalPlannedMinutes =
        await transaction.dailyPlan.findUniqueOrThrow({
          where: { id: task.dailyPlanId },
          select: { plannedStudyMinutes: true },
        });
      await transaction.dailyPlan.update({
        where: { id: task.dailyPlanId },
        data: {
          completedStudyMinutes: completedMinutes,
          completionRate:
            originalPlannedMinutes.plannedStudyMinutes === 0
              ? 0
              : Math.round(
                  (completedMinutes /
                    originalPlannedMinutes.plannedStudyMinutes) *
                    100,
                ),
        },
      });
      return updated;
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
