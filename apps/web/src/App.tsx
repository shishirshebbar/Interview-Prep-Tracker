import {
  currentDateInTimeZone,
  defaultStudySchedule,
  interviewPriorities,
} from "@tracker/shared";
import { useEffect, useState } from "react";
import {
  type DailyPlanResponse,
  type DashboardResponse,
  type ProblemResponse,
  type RevisionResponse,
  type TopicResponse,
  completeRevision,
  fetchDailyPlan,
  fetchDashboard,
  fetchDueRevisions,
  fetchProblems,
  fetchTopics,
  recordProblemAttempt,
  updateDailyTaskStatus,
  updateProblemStatus,
} from "./api";

const today = currentDateInTimeZone(defaultStudySchedule.timezone);
const navItems = [
  "Today's Plan",
  "Dashboard",
  "Roadmap",
  "Problems",
  "Revision",
] as const;
const problemStatuses = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SOLVED",
  "REVIEW",
  "MASTERED",
] as const;
const taskActions = ["COMPLETED", "PARTIALLY_COMPLETED", "SKIPPED"] as const;

type View = (typeof navItems)[number];

function formatTargetRole(value: string) {
  return value.replaceAll("_", "-");
}

function formatRevisionDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

function formatCategory(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimeOffset(startTime: string, offset: number) {
  const parsed = startTime.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!parsed) {
    return `${offset} min`;
  }
  let hour = Number(parsed[1]);
  const minute = Number(parsed[2]);
  const period = parsed[3]?.toUpperCase();
  if (period === "PM" && hour < 12) {
    hour += 12;
  } else if (period === "AM" && hour === 12) {
    hour = 0;
  }
  const total = (hour * 60 + minute + offset) % (24 * 60);
  const hour24 = Math.floor(total / 60);
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour12}:${String(total % 60).padStart(2, "0")} ${suffix}`;
}

function taskActionLabel(status: (typeof taskActions)[number]) {
  if (status === "COMPLETED") {
    return "Done";
  }
  if (status === "PARTIALLY_COMPLETED") {
    return "Partial";
  }
  return "Skip";
}

function statusLabel(status: (typeof problemStatuses)[number]) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (value) => value.toUpperCase());
}

export function App() {
  const [activeView, setActiveView] = useState<View>("Today's Plan");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [topics, setTopics] = useState<TopicResponse[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlanResponse | null>(null);
  const [revisions, setRevisions] = useState<RevisionResponse[]>([]);
  const [problems, setProblems] = useState<ProblemResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyProblemId, setBusyProblemId] = useState<string | null>(null);
  const [busyRevisionId, setBusyRevisionId] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confidenceByProblem, setConfidenceByProblem] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [
          dashboardResponse,
          topicsResponse,
          dailyPlanResponse,
          revisionsResponse,
          problemsResponse,
        ] = await Promise.all([
          fetchDashboard(controller.signal),
          fetchTopics(controller.signal),
          fetchDailyPlan(today, controller.signal),
          fetchDueRevisions(today, controller.signal),
          fetchProblems(controller.signal),
        ]);
        setDashboard(dashboardResponse);
        setTopics(topicsResponse);
        setDailyPlan(dailyPlanResponse);
        setRevisions(revisionsResponse);
        setProblems(problemsResponse);
      } catch {
        if (!controller.signal.aborted) {
          setError(
            "Could not load your tracker data. Start the API and try again.",
          );
        }
      }
    }

    load();
    return () => controller.abort();
  }, []);

  const visibleProblems = problems
    .filter(
      (problem) =>
        (topicFilter === "all" || problem.topicSlug === topicFilter) &&
        (statusFilter === "all" || problem.status === statusFilter),
    )
    .slice(0, 30);

  async function handleTaskAction(
    taskId: string,
    status: (typeof taskActions)[number],
  ) {
    try {
      setBusyTaskId(taskId);
      const updatedTask = await updateDailyTaskStatus(taskId, status);
      setDailyPlan((current) => {
        if (!current) {
          return current;
        }
        const tasks = current.tasks.map((task) =>
          task.id === taskId ? updatedTask : task,
        );
        const completedStudyMinutes = tasks.reduce(
          (total, task) => total + task.actualMinutes,
          0,
        );
        return {
          ...current,
          tasks,
          completedStudyMinutes,
          completionRate:
            current.plannedStudyMinutes === 0
              ? 0
              : Math.round(
                  (completedStudyMinutes / current.plannedStudyMinutes) * 100,
                ),
        };
      });
    } catch {
      setError("Could not update the daily task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleProblemStatus(problemId: string, status: string) {
    try {
      setBusyProblemId(problemId);
      const updatedProblem = await updateProblemStatus(problemId, status);
      setProblems((current) =>
        current.map((problem) =>
          problem.id === problemId ? updatedProblem : problem,
        ),
      );
    } catch {
      setError("Could not update the problem status.");
    } finally {
      setBusyProblemId(null);
    }
  }

  async function handleProblemAttempt(problemId: string) {
    try {
      setBusyProblemId(problemId);
      const updatedProblem = await recordProblemAttempt(problemId, {
        statusAfterAttempt: "SOLVED",
        wasSuccessful: true,
        confidenceScore: confidenceByProblem[problemId] ?? 3,
      });
      setProblems((current) =>
        current.map((problem) =>
          problem.id === problemId ? updatedProblem : problem,
        ),
      );
      setRevisions(await fetchDueRevisions(today));
      setDashboard(await fetchDashboard());
    } catch {
      setError("Could not record the problem attempt.");
    } finally {
      setBusyProblemId(null);
    }
  }

  async function handleRevisionComplete(revisionId: string) {
    try {
      setBusyRevisionId(revisionId);
      await completeRevision(revisionId);
      setRevisions((current) =>
        current.filter((revision) => revision.id !== revisionId),
      );
      setDashboard(await fetchDashboard());
    } catch {
      setError("Could not complete the revision.");
    } finally {
      setBusyRevisionId(null);
    }
  }

  let taskOffset = 0;
  const viewHeadings: Record<View, string> = {
    "Today's Plan": "What do I study today?",
    Dashboard: "Your preparation at a glance",
    Roadmap: "A focused path to interview readiness",
    Problems: "Practice, reflect, and schedule revisions",
    Revision: "Strengthen what you have already learned",
  };
  const isWeekend =
    new Date(`${today}T12:00:00.000Z`).getUTCDay() === 0 ||
    new Date(`${today}T12:00:00.000Z`).getUTCDay() === 6;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Personal Interview Prep</p>
          <h1>Learning Tracker</h1>
          <p className="muted">
            A calm, DSA-first plan for your SDE-1 preparation.
          </p>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              aria-current={activeView === item ? "page" : undefined}
              className={activeView === item ? "nav-item active" : "nav-item"}
              key={item}
              onClick={() => setActiveView(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-icon" aria-hidden="true">
            01
          </span>
          <p>
            Small, consistent sessions beat catching up on everything at once.
          </p>
        </div>
      </aside>

      <main className="content">
        <header className="page-header">
          <div>
            <p className="eyebrow">
              {activeView} · {today}
            </p>
            <h2>{viewHeadings[activeView]}</h2>
          </div>
          <div className="hero-card">
            <span className="hero-label">Current goal</span>
            <strong>
              {dashboard
                ? formatTargetRole(dashboard.user.targetRole)
                : "SDE-1"}
            </strong>
            <p>
              {dailyPlan?.availableMinutes ??
                defaultStudySchedule.weekday.studyMinutes}{" "}
              minutes available today
            </p>
            <span className="pill">{defaultStudySchedule.timezone}</span>
          </div>
        </header>

        {error ? (
          <p className="error-banner" role="alert">
            {error}
          </p>
        ) : null}

        {activeView === "Today's Plan" ? (
          <>
            <section className="plan-summary" aria-label="Today's progress">
              <div>
                <span>Planned</span>
                <strong>{dailyPlan?.plannedStudyMinutes ?? "--"} min</strong>
              </div>
              <div>
                <span>Studied</span>
                <strong>{dailyPlan?.completedStudyMinutes ?? "--"} min</strong>
              </div>
              <div>
                <span>Completion</span>
                <strong>{dailyPlan?.completionRate ?? "--"}%</strong>
              </div>
              <div>
                <span>Due revisions</span>
                <strong>{revisions.length}</strong>
              </div>
            </section>

            <section className="panel plan-panel">
              <div className="section-heading">
                <div>
                  <p className="panel-label">Your study blocks</p>
                  <p className="muted">
                    Mark each block complete, partial, or skipped. Unfinished
                    work is carried forward selectively, not piled onto
                    tomorrow.
                  </p>
                </div>
                <span className="pill">
                  {dailyPlan?.availableMinutes ?? 90} min capacity
                </span>
              </div>
              {dailyPlan ? (
                <div className="action-list">
                  {dailyPlan.tasks.map((task, index) => {
                    const startTime = isWeekend
                      ? `Block ${index + 1}`
                      : formatTimeOffset(
                          defaultStudySchedule.weekday.startTime,
                          taskOffset,
                        );
                    taskOffset += task.plannedMinutes;
                    return (
                      <article
                        className={`action-card task-card task-${task.status.toLowerCase()}`}
                        key={task.id}
                      >
                        <div className="task-time">{startTime}</div>
                        <div className="task-details">
                          <div className="task-title-row">
                            <strong>{task.title}</strong>
                            <span className="task-duration">
                              {task.plannedMinutes} min
                            </span>
                          </div>
                          <p className="muted action-copy">
                            {task.description ?? task.topic ?? "Study task"}
                          </p>
                          {task.actualMinutes > 0 ? (
                            <span className="task-actual">
                              {task.actualMinutes} minutes recorded
                            </span>
                          ) : null}
                        </div>
                        <div className="button-row">
                          {taskActions.map((status) => (
                            <button
                              className={
                                task.status === status
                                  ? "action-button active"
                                  : "action-button"
                              }
                              disabled={busyTaskId === task.id}
                              key={status}
                              onClick={() => handleTaskAction(task.id, status)}
                              type="button"
                            >
                              {taskActionLabel(status)}
                            </button>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">Loading today&apos;s plan...</p>
              )}
            </section>
            {revisions.length > 0 ? (
              <section className="revision-callout">
                <span className="revision-dot" aria-hidden="true" />
                <p>
                  <strong>
                    {revisions.length} revision
                    {revisions.length === 1 ? "" : "s"} due today
                  </strong>
                  {" — "}
                  {revisions
                    .slice(0, 3)
                    .map((revision) => revision.problem.title)
                    .join(", ")}
                </p>
                <button
                  className="text-button"
                  onClick={() => setActiveView("Revision")}
                  type="button"
                >
                  Review now
                </button>
              </section>
            ) : null}
          </>
        ) : null}

        {activeView === "Dashboard" ? (
          <>
            <section className="stat-grid dashboard-stats">
              <div>
                <strong>
                  {dashboard?.overallCompletionPercentage ?? "--"}%
                </strong>
                <span>Overall progress</span>
              </div>
              <div>
                <strong>{dashboard?.streak ?? "--"} days</strong>
                <span>Current streak</span>
              </div>
              <div>
                <strong>{dashboard?.solvedProblems ?? "--"}</strong>
                <span>Problems solved</span>
              </div>
              <div>
                <strong>{dashboard?.studyMinutesThisWeek ?? "--"} min</strong>
                <span>Study this week</span>
              </div>
              <div>
                <strong>{dashboard?.dueRevisionCount ?? "--"}</strong>
                <span>Revisions due</span>
              </div>
              <div>
                <strong>{dashboard?.pendingTopics ?? "--"}</strong>
                <span>Topics in progress</span>
              </div>
            </section>
            <section className="grid grid-secondary">
              <article className="panel">
                <p className="panel-label">Progress by area</p>
                <div className="progress-list">
                  {dashboard?.progress.map((item) => (
                    <div className="progress-item" key={item.category}>
                      <div className="progress-caption">
                        <span>{formatCategory(item.label)}</span>
                        <strong>{item.completionPercentage}%</strong>
                      </div>
                      <progress max={100} value={item.completionPercentage}>
                        {item.completionPercentage}%
                      </progress>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel priority-panel">
                <p className="panel-label">Interview priority</p>
                <ol className="priority-list">
                  {interviewPriorities.map((item) => (
                    <li key={item.rank}>
                      <span className="priority-number">
                        {String(item.rank).padStart(2, "0")}
                      </span>
                      {item.area}
                    </li>
                  ))}
                </ol>
              </article>
            </section>
          </>
        ) : null}

        {activeView === "Roadmap" ? (
          <section className="roadmap-list">
            {topics.map((topic) => (
              <article className="roadmap-card" key={topic.id}>
                <div className="roadmap-meta">
                  <span>{formatCategory(topic.category)}</span>
                  <span
                    className={`priority-tag priority-${topic.priority.toLowerCase()}`}
                  >
                    {topic.priority}
                  </span>
                </div>
                <div className="roadmap-title-row">
                  <h3>{topic.name}</h3>
                  <strong>{topic.completionPercentage}%</strong>
                </div>
                <progress max={100} value={topic.completionPercentage}>
                  {topic.completionPercentage}%
                </progress>
                <p className="roadmap-status">
                  {formatCategory(topic.status)} · {topic.estimatedHours}{" "}
                  estimated hours
                </p>
                {topic.notes ? (
                  <p className="muted roadmap-notes">{topic.notes}</p>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        {activeView === "Problems" ? (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="panel-label">Problem tracker</p>
                <p className="muted">
                  Record a successful attempt with your confidence to schedule
                  spaced revision.
                </p>
              </div>
              <div className="filter-row">
                <label>
                  Topic
                  <select
                    value={topicFilter}
                    onChange={(event) => setTopicFilter(event.target.value)}
                  >
                    <option value="all">All topics</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.slug}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {problemStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="action-list">
              {visibleProblems.map((problem) => (
                <article className="action-card problem-card" key={problem.id}>
                  <div className="problem-info">
                    <strong>{problem.title}</strong>
                    <p className="muted action-copy">
                      {problem.topic} · {problem.platform} ·{" "}
                      {problem.difficulty}
                      {problem.pattern ? ` · ${problem.pattern}` : ""}
                    </p>
                    {problem.revisionDate ? (
                      <span className="task-actual">
                        Next revision:{" "}
                        {formatRevisionDate(problem.revisionDate)}
                      </span>
                    ) : null}
                  </div>
                  <div className="problem-actions">
                    <div className="button-row button-row-wrap">
                      {problemStatuses.map((status) => (
                        <button
                          className={
                            problem.status === status
                              ? "action-button active"
                              : "action-button"
                          }
                          disabled={busyProblemId === problem.id}
                          key={status}
                          onClick={() =>
                            handleProblemStatus(problem.id, status)
                          }
                          type="button"
                        >
                          {statusLabel(status)}
                        </button>
                      ))}
                    </div>
                    <div className="attempt-row">
                      <label>
                        Confidence
                        <select
                          aria-label={`Confidence for ${problem.title}`}
                          value={
                            confidenceByProblem[problem.id] ??
                            problem.confidenceScore ??
                            3
                          }
                          onChange={(event) =>
                            setConfidenceByProblem((current) => ({
                              ...current,
                              [problem.id]: Number(event.target.value),
                            }))
                          }
                        >
                          {[1, 2, 3, 4, 5].map((score) => (
                            <option key={score} value={score}>
                              {score} / 5
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="action-button action-button-primary"
                        disabled={busyProblemId === problem.id}
                        onClick={() => handleProblemAttempt(problem.id)}
                        type="button"
                      >
                        Log solved attempt
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {visibleProblems.length === 0 ? (
                <p className="muted empty-state">
                  No problems match these filters.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeView === "Revision" ? (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="panel-label">Due for revision</p>
                <p className="muted">
                  Review these problems to reinforce recall, then mark the
                  revision complete.
                </p>
              </div>
              <span className="pill">{revisions.length} due</span>
            </div>
            {revisions.length > 0 ? (
              <div className="action-list">
                {revisions.map((revision) => (
                  <article
                    className="action-card revision-card"
                    key={revision.id}
                  >
                    <div>
                      <strong>{revision.problem.title}</strong>
                      <p className="muted action-copy">
                        {revision.problem.topic} · {revision.problem.platform} ·
                        confidence {revision.confidenceAtSchedule}/5
                      </p>
                      <span className="task-actual">
                        Due {formatRevisionDate(revision.dueAt)} ·{" "}
                        {revision.intervalDays}-day interval
                      </span>
                    </div>
                    <button
                      className="action-button action-button-primary"
                      disabled={busyRevisionId === revision.id}
                      onClick={() => handleRevisionComplete(revision.id)}
                      type="button"
                    >
                      Mark reviewed
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state-mark">✓</span>
                <strong>You&apos;re up to date</strong>
                <p className="muted">
                  No revisions are due. Keep practicing and log confidence after
                  solving.
                </p>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
