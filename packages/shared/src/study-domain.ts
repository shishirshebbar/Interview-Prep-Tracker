export type TopicStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "STRONG_FOUNDATION"
  | "COMPLETE";

export interface StudySchedule {
  timezone: string;
  weekday: {
    startTime: string;
    studyMinutes: number;
  };
  weekend: {
    studyMinutes: number;
  };
}

export interface InterviewPriority {
  rank: number;
  area: string;
}

export interface PlannerTopic {
  slug: string;
  name: string;
  category: string;
  parentTopicId: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  completionPercentage: number;
  notes: string | null;
}

export interface PlannerProblem {
  title: string;
  topicSlug: string;
  status: string;
}

export interface PlannerCarryOver {
  title: string;
  description: string | null;
  taskType:
    | "DSA"
    | "CORE_JAVA"
    | "JAVASCRIPT"
    | "SQL"
    | "CS_FUNDAMENTALS"
    | "RESUME"
    | "PROJECT"
    | "REVISION"
    | "SYSTEM_DESIGN";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  plannedMinutes: number;
  topicSlug: string | null;
}

export interface PlannedTask {
  title: string;
  description: string;
  taskType:
    | "DSA"
    | "CORE_JAVA"
    | "JAVASCRIPT"
    | "SQL"
    | "CS_FUNDAMENTALS"
    | "RESUME"
    | "PROJECT"
    | "REVISION"
    | "SYSTEM_DESIGN";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  plannedMinutes: number;
  topicSlug: string | null;
}

export interface DailyPlanInput {
  availableMinutes: number;
  topics: PlannerTopic[];
  problems: PlannerProblem[];
  dueRevisions: string[];
  carryOver?: PlannerCarryOver[];
}

export const defaultStudySchedule: StudySchedule = {
  timezone: "Asia/Kolkata",
  weekday: {
    startTime: "10:15 PM",
    studyMinutes: 90,
  },
  weekend: {
    studyMinutes: 480,
  },
};

export const interviewPriorities: InterviewPriority[] = [
  { rank: 1, area: "DSA" },
  { rank: 2, area: "Core Java" },
  { rank: 3, area: "SQL" },
  { rank: 4, area: "DBMS / OS / CN" },
  { rank: 5, area: "JavaScript" },
  { rank: 6, area: "Resume + Projects" },
  { rank: 7, area: "Basic System Design" },
];

const plannerAreas = [
  {
    key: "DSA",
    weight: 0.58,
    taskType: "DSA",
    priority: "CRITICAL",
    topicCategories: ["DSA"],
    title: "DSA",
    fallback: "Continue the highest-priority DSA pattern.",
  },
  {
    key: "CORE_JAVA",
    weight: 0.18,
    taskType: "CORE_JAVA",
    priority: "HIGH",
    topicCategories: ["CORE_JAVA"],
    title: "Core Java",
    fallback: "Review a Core Java interview topic and explain it aloud.",
  },
  {
    key: "SQL",
    weight: 0.1,
    taskType: "SQL",
    priority: "HIGH",
    topicCategories: ["SQL"],
    title: "SQL",
    fallback: "Practice one intermediate SQL interview pattern.",
  },
  {
    key: "CS_FUNDAMENTALS",
    weight: 0.08,
    taskType: "CS_FUNDAMENTALS",
    priority: "HIGH",
    topicCategories: ["DBMS", "OPERATING_SYSTEMS", "COMPUTER_NETWORKS"],
    title: "CS fundamentals",
    fallback: "Review one DBMS, OS, or networking concept.",
  },
  {
    key: "JAVASCRIPT",
    weight: 0.04,
    taskType: "JAVASCRIPT",
    priority: "MEDIUM",
    topicCategories: ["JAVASCRIPT"],
    title: "JavaScript",
    fallback: "Review a JavaScript topic relevant to your resume.",
  },
  {
    key: "INTERVIEW_PREP",
    weight: 0.02,
    taskType: "RESUME",
    priority: "MEDIUM",
    topicCategories: ["RESUME", "PROJECTS"],
    title: "Resume / project",
    fallback: "Practice a concise project or resume explanation.",
  },
] as const;

const priorityWeight: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function chooseTopic(topics: PlannerTopic[], categories: readonly string[]) {
  return topics
    .filter(
      (topic) =>
        categories.includes(topic.category) &&
        (categories.includes("DSA")
          ? topic.slug !== "dsa"
          : topic.parentTopicId === null) &&
        topic.completionPercentage < 100,
    )
    .sort((left, right) => {
      const priorityDifference =
        (priorityWeight[right.priority] ?? 0) -
        (priorityWeight[left.priority] ?? 0);
      return (
        priorityDifference ||
        left.completionPercentage - right.completionPercentage ||
        left.name.localeCompare(right.name)
      );
    })[0];
}

function allocateMinutes(
  totalMinutes: number,
  areas: ReadonlyArray<{ weight: number }>,
) {
  const minimum = Math.min(5, Math.floor(totalMinutes / areas.length));
  const allocation = Array.from({ length: areas.length }, () => minimum);
  let remainder = Math.max(0, totalMinutes - minimum * areas.length);
  const weights = areas.map((area) => area.weight);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const fractions = weights.map((weight, index) => {
    const raw = (remainder * weight) / weightTotal;
    const rounded = Math.floor(raw / 5) * 5;
    allocation[index] = (allocation[index] ?? 0) + rounded;
    return { index, fraction: raw - rounded };
  });
  remainder =
    totalMinutes - allocation.reduce((sum, minutes) => sum + minutes, 0);

  while (remainder >= 5) {
    fractions.sort((left, right) => right.fraction - left.fraction);
    const winner = fractions[0];
    if (!winner) {
      break;
    }
    allocation[winner.index] = (allocation[winner.index] ?? 0) + 5;
    winner.fraction = 0;
    remainder -= 5;
  }

  if (remainder > 0) {
    allocation[0] = (allocation[0] ?? 0) + remainder;
  }
  return allocation;
}

export function generateDailyPlan(input: DailyPlanInput): PlannedTask[] {
  const availableMinutes = Math.max(0, Math.floor(input.availableMinutes));
  if (availableMinutes === 0) {
    return [];
  }

  const areaLimit = Math.max(1, Math.floor(availableMinutes / 5));
  const activeAreas = plannerAreas
    .filter((area) => chooseTopic(input.topics, area.topicCategories))
    .slice(0, areaLimit);
  if (activeAreas.length === 0) {
    return [];
  }

  const allocations = allocateMinutes(availableMinutes, activeAreas);
  const tasks: PlannedTask[] = activeAreas.map((area, index) => {
    const topic = chooseTopic(input.topics, area.topicCategories);
    const selectedProblems =
      area.key === "DSA" || area.key === "SQL"
        ? input.problems
            .filter(
              (problem) =>
                problem.topicSlug === topic?.slug &&
                !["SOLVED", "MASTERED"].includes(problem.status),
            )
            .slice(0, 2)
        : [];
    const revision = area.key === "DSA" ? input.dueRevisions[0] : undefined;
    const details = [
      ...selectedProblems.map((problem) => problem.title),
      ...(revision ? [`Revise ${revision}`] : []),
    ];
    const plannedMinutes = allocations[index] ?? 0;

    return {
      title: `${area.title}${topic ? ` - ${topic.name}` : ""}`,
      description:
        details.length > 0
          ? `Focus on: ${details.join(", ")}. Keep notes on the approach and mistakes.`
          : (topic?.notes ?? area.fallback),
      taskType: area.taskType,
      priority: area.priority,
      plannedMinutes,
      topicSlug: topic?.slug ?? null,
    };
  });

  const carryOver = input.carryOver?.find((task) => task.plannedMinutes > 0);
  if (carryOver && availableMinutes >= 30 && tasks.length > 1) {
    const carryMinutes = Math.min(
      10,
      Math.max(5, Math.round((availableMinutes * 0.1) / 5) * 5),
    );
    let remaining = carryMinutes;
    for (
      let index = tasks.length - 1;
      index >= 0 && remaining > 0;
      index -= 1
    ) {
      const task = tasks[index];
      if (!task || task.plannedMinutes <= 5) {
        continue;
      }
      const deduction = Math.min(task.plannedMinutes - 5, remaining);
      task.plannedMinutes -= deduction;
      remaining -= deduction;
    }
    if (remaining === 0) {
      tasks.unshift({
        title: `Carry over: ${carryOver.title}`,
        description:
          carryOver.description ??
          "One unfinished item is carried forward; older work is not stacked onto today's plan.",
        taskType: carryOver.taskType,
        priority: carryOver.priority,
        plannedMinutes: carryMinutes,
        topicSlug: carryOver.topicSlug,
      });
    }
  }

  return tasks.flatMap((task) => {
    if (task.plannedMinutes <= 60) {
      return [task];
    }

    const blocks: PlannedTask[] = [];
    let remaining = task.plannedMinutes;
    let block = 1;
    while (remaining > 0) {
      const plannedMinutes = Math.min(60, remaining);
      blocks.push({
        ...task,
        title: `${task.title} - Block ${block}`,
        description:
          block === 1
            ? task.description
            : `Continue ${task.title}; use a short break between study blocks and focus on a new example or review.`,
        plannedMinutes,
      });
      remaining -= plannedMinutes;
      block += 1;
    }
    return blocks;
  });
}

export function revisionIntervalDays(
  confidence: number,
  configuredIntervals = [1, 3, 7, 14, 30],
) {
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
    throw new RangeError("Confidence must be an integer from 1 to 5.");
  }
  const interval = configuredIntervals[confidence - 1];
  if (!interval || !Number.isInteger(interval) || interval < 1) {
    throw new RangeError(
      "Revision intervals must contain five positive integers.",
    );
  }
  return interval;
}

export function currentDateInTimeZone(
  timeZone: string,
  now: Date = new Date(),
) {
  return formatDateInTimeZone(now, timeZone);
}

export function formatDateInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) {
    throw new Error(`Could not determine the current date in ${timeZone}.`);
  }
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(date: string, offsetDays: number) {
  const result = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(result.getTime()) || !Number.isInteger(offsetDays)) {
    throw new RangeError("A valid calendar date and integer day offset are required.");
  }
  result.setUTCDate(result.getUTCDate() + offsetDays);
  return result.toISOString().slice(0, 10);
}

export function dateAtTimeZoneMidnight(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (
    !year ||
    !month ||
    !day ||
    !Number.isFinite(Date.parse(`${date}T00:00:00.000Z`))
  ) {
    throw new RangeError("A valid calendar date is required.");
  }
  const desiredUtc = Date.UTC(year, month - 1, day);
  let guess = desiredUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const value = (type: string) =>
      Number(parts.find((item) => item.type === type)?.value);
    const representedUtc = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    const difference = desiredUtc - representedUtc;
    guess += difference;
    if (difference === 0) {
      break;
    }
  }

  return new Date(guess);
}

export const currentStudySummary = {
  dsa: {
    completedAreas: 6,
    inProgress: "Strings",
    strongFoundation: "Binary Trees",
    nextFocus: ["BST", "Heap", "Graphs", "MST", "Topological Sort", "DP"],
  },
  sql: {
    status: "GOOD_FOUNDATION" as const,
    nextFocus: ["CTE", "ROW_NUMBER", "LAG", "LEAD", "gaps and islands"],
  },
  coreJava: {
    status: "GOOD_FOUNDATION" as const,
    nextFocus: [
      "JVM/JDK/JRE",
      "Exception Handling",
      "Generics",
      "Multithreading",
    ],
  },
  javascript: {
    status: "NEEDS_ATTENTION" as const,
    nextFocus: ["Closures", "Promises", "Event Loop", "this", "Prototypes"],
  },
};
