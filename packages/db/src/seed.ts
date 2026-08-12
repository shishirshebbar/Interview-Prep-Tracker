import { type Prisma, ProblemStatus, TopicStatus } from "@prisma/client";
import { prisma } from "./client.js";
import {
  aiInteractionSeed,
  analyticsSeed,
  dailyPlanSeed,
  defaultUserSeed,
  goalsSeed,
  notificationSeed,
  problemSeed,
  resumeItemsSeed,
  resumeProfileSeed,
  revisionSeed,
  seedDates,
  topicSeed,
} from "./seed-data.js";

async function main() {
  await prisma.emailLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.analyticsSnapshot.deleteMany();
  await prisma.resumeItem.deleteMany();
  await prisma.resumeProfile.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.dailyTask.deleteMany();
  await prisma.dailyPlan.deleteMany();
  await prisma.revision.deleteMany();
  await prisma.problemAttempt.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.topicProgress.deleteMany();
  await prisma.studyTopic.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.aIInteraction.deleteMany();
  await prisma.project.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      ...defaultUserSeed,
      prepStartDate: seedDates.prepStart,
      prepDeadline: seedDates.prepDeadline,
      settings: {
        create: {
          weekdayStartTime: "22:15",
          weekdayStudyMinutes: 90,
          weekendStudyMinutes: 480,
          timezone: "Asia/Kolkata",
          preferredProblemPlatform: "LeetCode",
          emailAddress: "shish@example.com",
          emailReminderEnabled: false,
          weeklySummaryEnabled: false,
          aiEnabled: true,
          openAiModel: "gpt-5-mini",
          reminderCron: "15 22 * * *",
          weeklySummaryCron: "0 9 * * 0",
          revisionIntervalsDays: [1, 3, 7, 14, 30],
        },
      },
      goals: {
        create: goalsSeed,
      },
      resumeProfile: {
        create: {
          ...resumeProfileSeed,
          items: {
            create: resumeItemsSeed,
          },
        },
      },
    },
  });

  const topicMap = new Map<string, { id: string; slug: string }>();

  for (const topic of topicSeed) {
    const progress = "progress" in topic ? topic.progress : undefined;

    const createdTopic = await prisma.studyTopic.create({
      data: {
        slug: topic.slug,
        name: topic.name,
        description: progress?.notes,
        category: topic.category,
        parentTopicId:
          "parentSlug" in topic && topic.parentSlug
            ? topicMap.get(topic.parentSlug)?.id
            : null,
        difficulty: topic.difficulty,
        priority: topic.priority,
        estimatedHours: topic.estimatedHours,
        displayOrder: topic.displayOrder,
        recommendedProblems: topic.recommendedProblems,
      },
    });

    topicMap.set(topic.slug, createdTopic);

    if (progress) {
      await prisma.topicProgress.create({
        data: {
          userId: user.id,
          topicId: createdTopic.id,
          status: progress.status,
          completionPercentage: progress.completionPercentage,
          notes: progress.notes,
          confidenceScore:
            progress.status === TopicStatus.COMPLETE
              ? 5
              : progress.status === TopicStatus.STRONG_FOUNDATION
                ? 4
                : progress.status === TopicStatus.IN_PROGRESS
                  ? 3
                  : null,
          weakAreaScore:
            progress.status === TopicStatus.NOT_STARTED
              ? 0
              : progress.status === TopicStatus.IN_PROGRESS
                ? 4
                : 1,
        },
      });
    }
  }

  const problemMap = new Map<string, { id: string; title: string }>();

  for (const problem of problemSeed) {
    const topic = topicMap.get(problem.topicSlug);

    if (!topic) {
      throw new Error(`Missing topic for problem seed: ${problem.topicSlug}`);
    }

    const createdProblem = await prisma.problem.create({
      data: {
        userId: user.id,
        topicId: topic.id,
        title: problem.title,
        platform: problem.platform,
        url: problem.url,
        subtopic: problem.subtopic,
        difficulty: problem.difficulty,
        pattern: problem.pattern,
        status: problem.status,
        attemptsCount: problem.attemptsCount,
        solvedAt: problem.solvedAt,
        timeTakenMinutes: problem.timeTakenMinutes,
        confidenceScore: problem.confidenceScore,
        revisionDate: problem.revisionDate,
      },
    });

    problemMap.set(problem.title, createdProblem);

    if (problem.attemptsCount > 0) {
      await prisma.problemAttempt.create({
        data: {
          userId: user.id,
          problemId: createdProblem.id,
          statusAfterAttempt: problem.status,
          attemptedAt: problem.solvedAt ?? seedDates.yesterday,
          durationMinutes: problem.timeTakenMinutes,
          wasSuccessful:
            problem.status === ProblemStatus.SOLVED ||
            problem.status === ProblemStatus.MASTERED,
          confidenceScore: problem.confidenceScore,
          notes:
            problem.status === ProblemStatus.NOT_STARTED
              ? undefined
              : "Seeded from the current interview preparation snapshot.",
        },
      });
    }
  }

  for (const revision of revisionSeed) {
    const problem = problemMap.get(revision.problemTitle);

    if (!problem) {
      throw new Error(
        `Missing problem for revision seed: ${revision.problemTitle}`,
      );
    }

    await prisma.revision.create({
      data: {
        userId: user.id,
        problemId: problem.id,
        dueAt: revision.dueAt,
        status: revision.status,
        confidenceAtSchedule: revision.confidenceAtSchedule,
        intervalDays: revision.intervalDays,
      },
    });
  }

  const dailyPlan = await prisma.dailyPlan.create({
    data: {
      userId: user.id,
      planDate: dailyPlanSeed.planDate,
      availableMinutes: dailyPlanSeed.availableMinutes,
      plannedStudyMinutes: dailyPlanSeed.plannedStudyMinutes,
      completedStudyMinutes: dailyPlanSeed.completedStudyMinutes,
      completionRate: dailyPlanSeed.completionRate,
      source: dailyPlanSeed.source,
      summary: dailyPlanSeed.summary,
    },
  });

  for (const task of dailyPlanSeed.tasks) {
    await prisma.dailyTask.create({
      data: {
        dailyPlanId: dailyPlan.id,
        topicId: task.topicSlug ? topicMap.get(task.topicSlug)?.id : null,
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        status: task.status,
        priority: task.priority,
        orderIndex: task.orderIndex,
        plannedMinutes: task.plannedMinutes,
        actualMinutes: task.actualMinutes,
        startMinuteOffset: task.startMinuteOffset,
        completionNotes: task.completionNotes,
      },
    });
  }

  for (const snapshot of analyticsSeed) {
    await prisma.analyticsSnapshot.create({
      data: {
        userId: user.id,
        ...snapshot,
      },
    });
  }

  for (const notification of notificationSeed) {
    const createdNotification = await prisma.notification.create({
      data: {
        userId: user.id,
        type: notification.type,
        status: notification.status,
        subject: notification.subject,
        scheduledFor: notification.scheduledFor,
        payload: notification.payload as Prisma.JsonObject,
      },
    });

    await prisma.emailLog.create({
      data: {
        notificationId: createdNotification.id,
        recipient: "shish@example.com",
        provider: "smtp",
        status: notification.status,
        subject: notification.subject,
        attemptCount: 0,
      },
    });
  }

  for (const interaction of aiInteractionSeed) {
    await prisma.aIInteraction.create({
      data: {
        userId: user.id,
        type: interaction.type,
        status: interaction.status,
        model: interaction.model,
        promptVersion: interaction.promptVersion,
        inputSummary: interaction.inputSummary as Prisma.JsonObject,
        responseSummary: interaction.responseSummary as Prisma.JsonObject,
      },
    });
  }

  console.log(`Seeded learning tracker database for ${user.name}.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
