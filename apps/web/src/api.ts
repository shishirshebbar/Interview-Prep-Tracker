export interface DashboardResponse {
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
    category: string;
    completionPercentage: number;
  }>;
  todaysPlan: {
    date: string;
    availableMinutes: number;
    completionRate: number;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      plannedMinutes: number;
      actualMinutes: number;
    }>;
  } | null;
}

export interface TopicResponse {
  id: string;
  slug: string;
  name: string;
  category: string;
  parentTopicId: string | null;
  difficulty: string;
  priority: string;
  estimatedHours: number;
  recommendedProblems: number;
  status: string;
  completionPercentage: number;
  notes: string | null;
}

export interface ProblemResponse {
  id: string;
  title: string;
  platform: string;
  url: string | null;
  topic: string;
  topicSlug: string;
  difficulty: string;
  pattern: string | null;
  status: string;
  attemptsCount: number;
  confidenceScore: number | null;
  revisionDate: string | null;
}

export interface DailyPlanResponse {
  id: string;
  planDate: string;
  availableMinutes: number;
  plannedStudyMinutes: number;
  completedStudyMinutes: number;
  completionRate: number;
  source: string;
  summary: string | null;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    plannedMinutes: number;
    actualMinutes: number;
    topic: string | null;
  }>;
}

export interface RevisionResponse {
  id: string;
  dueAt: string;
  status: string;
  intervalDays: number;
  confidenceAtSchedule: number;
  problem: {
    id: string;
    title: string;
    platform: string;
    topic: string;
  };
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function sendJson<T>(
  path: string,
  method: "PATCH" | "POST",
  body: unknown,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchDashboard(signal?: AbortSignal) {
  return getJson<DashboardResponse>("/api/dashboard", signal);
}

export function fetchTopics(signal?: AbortSignal) {
  return getJson<TopicResponse[]>("/api/topics", signal);
}

export function fetchProblems(signal?: AbortSignal) {
  return getJson<ProblemResponse[]>("/api/problems", signal);
}

export function fetchDailyPlan(date: string, signal?: AbortSignal) {
  return getJson<DailyPlanResponse>(`/api/daily-plan?date=${date}`, signal);
}

export function fetchDueRevisions(date: string, signal?: AbortSignal) {
  return getJson<RevisionResponse[]>(`/api/revisions/due?date=${date}`, signal);
}

export function updateProblemStatus(problemId: string, status: string) {
  return sendJson<ProblemResponse>(
    `/api/problems/${problemId}/status`,
    "PATCH",
    { status },
  );
}

export function updateDailyTaskStatus(taskId: string, status: string) {
  return sendJson<DailyPlanResponse["tasks"][number]>(
    `/api/daily-plan/tasks/${taskId}`,
    "PATCH",
    { status },
  );
}
