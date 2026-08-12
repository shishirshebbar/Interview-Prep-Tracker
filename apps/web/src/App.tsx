import { defaultStudySchedule, interviewPriorities } from "@tracker/shared";
import { useEffect, useState } from "react";
import {
  type DailyPlanResponse,
  type DashboardResponse,
  type ProblemResponse,
  type RevisionResponse,
  type TopicResponse,
  fetchDailyPlan,
  fetchDashboard,
  fetchDueRevisions,
  fetchProblems,
  fetchTopics,
  updateDailyTaskStatus,
  updateProblemStatus,
} from "./api";

const today = "2026-08-11";

const navItems = [
  "Dashboard",
  "Today's Plan",
  "Problems",
  "Revision",
  "Projects",
  "Resume",
  "Analytics",
  "Settings",
] as const;

const problemStatuses = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SOLVED",
  "REVIEW",
] as const;
const taskActions = ["COMPLETED", "SKIPPED"] as const;

function formatTargetRole(value: string) {
  return value.replaceAll("_", "-");
}

function formatTask(task: DailyPlanResponse["tasks"][number]) {
  return `${task.plannedMinutes} min ${task.title}`;
}

function formatRevisionDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

function statusLabel(value: (typeof problemStatuses)[number]) {
  if (value === "NOT_STARTED") {
    return "Not started";
  }

  if (value === "IN_PROGRESS") {
    return "Start";
  }

  if (value === "SOLVED") {
    return "Solved";
  }

  return "Review";
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [topics, setTopics] = useState<TopicResponse[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlanResponse | null>(null);
  const [revisions, setRevisions] = useState<RevisionResponse[]>([]);
  const [problems, setProblems] = useState<ProblemResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyProblemId, setBusyProblemId] = useState<string | null>(null);

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

  const focusTopics = topics
    .filter((topic) => !topic.parentTopicId && topic.completionPercentage < 100)
    .sort(
      (left, right) => right.completionPercentage - left.completionPercentage,
    )
    .slice(0, 4);

  const visibleProblems = problems.slice(0, 8);

  async function handleTaskAction(taskId: string, status: string) {
    try {
      setBusyTaskId(taskId);
      const updatedTask = await updateDailyTaskStatus(taskId, status);
      setDailyPlan((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((task) =>
                task.id === taskId ? updatedTask : task,
              ),
            }
          : current,
      );
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

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Personal Interview Prep</p>
          <h1>Learning Tracker</h1>
          <p className="muted">
            A simple single-user tracker for what to study today.
          </p>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <a
              className={
                item === "Today's Plan" ? "nav-item active" : "nav-item"
              }
              href="/"
              key={item}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">Today&apos;s Main Screen</p>
            <h2>What do I study today?</h2>
            <p className="lead">
              The tracker keeps the plan realistic, shows what is due, and lets
              you update progress quickly without extra workflow.
            </p>
          </div>

          <div className="hero-card">
            <span className="hero-label">Current Goal</span>
            <strong>
              {dashboard
                ? formatTargetRole(dashboard.user.targetRole)
                : "Loading"}
            </strong>
            <p>
              {dailyPlan?.availableMinutes ??
                dashboard?.todaysPlan?.availableMinutes ??
                defaultStudySchedule.weekday.studyMinutes}{" "}
              minutes available today
            </p>
            <span className="pill">{defaultStudySchedule.timezone}</span>
          </div>
        </section>

        {error ? <p className="error-banner">{error}</p> : null}

        <section className="grid">
          <article className="panel panel-primary">
            <p className="panel-label">Today&apos;s Plan</p>
            {dailyPlan ? (
              <div className="action-list">
                {dailyPlan.tasks.map((task) => (
                  <div className="action-card" key={task.id}>
                    <div>
                      <strong>{formatTask(task)}</strong>
                      <p className="muted action-copy">
                        {task.description ?? task.topic ?? "Study task"}
                      </p>
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
                          {status === "COMPLETED" ? "Done" : "Skip"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Loading today&apos;s plan...</p>
            )}
          </article>

          <article className="panel">
            <p className="panel-label">Tracker Snapshot</p>
            <div className="stat-grid">
              <div>
                <strong>
                  {dashboard?.overallCompletionPercentage ?? "--"}%
                </strong>
                <span>Overall progress</span>
              </div>
              <div>
                <strong>{dashboard?.solvedProblems ?? "--"}</strong>
                <span>Problems solved</span>
              </div>
              <div>
                <strong>{dashboard?.studyMinutesThisWeek ?? "--"}</strong>
                <span>Study minutes this week</span>
              </div>
              <div>
                <strong>{dashboard?.dueRevisionCount ?? "--"}</strong>
                <span>Due revisions</span>
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="panel-label">Priority Order</p>
            <ol className="priority-list">
              {interviewPriorities.map((item) => (
                <li key={item.rank}>
                  <span>{item.rank}.</span> {item.area}
                </li>
              ))}
            </ol>
          </article>
        </section>

        <section className="grid grid-secondary">
          <article className="panel">
            <p className="panel-label">Current Focus Areas</p>
            <div className="stat-grid">
              {focusTopics.length > 0 ? (
                focusTopics.map((topic) => (
                  <div key={topic.id}>
                    <strong>{topic.completionPercentage}%</strong>
                    <span>{topic.name}</span>
                  </div>
                ))
              ) : (
                <div>
                  <strong>Loading</strong>
                  <span>Topics</span>
                </div>
              )}
            </div>
          </article>

          <article className="panel">
            <p className="panel-label">Today&apos;s Status</p>
            <div className="status-stack">
              <div className="status-row">
                <strong>{dashboard?.streak ?? "--"}</strong>
                <span>Current streak</span>
              </div>
              <div className="status-row">
                <strong>{dashboard?.pendingTopics ?? "--"}</strong>
                <span>Pending topics</span>
              </div>
              <div className="status-row">
                <strong>
                  {dailyPlan?.completionRate ??
                    dashboard?.todaysPlan?.completionRate ??
                    "--"}
                  {dailyPlan || dashboard?.todaysPlan ? "%" : ""}
                </strong>
                <span>Today&apos;s completion rate</span>
              </div>
            </div>
          </article>
        </section>

        <section className="grid grid-secondary">
          <article className="panel">
            <p className="panel-label">Problems</p>
            <div className="action-list">
              {visibleProblems.map((problem) => (
                <div className="action-card" key={problem.id}>
                  <div>
                    <strong>{problem.title}</strong>
                    <p className="muted action-copy">
                      {problem.topic} · {problem.platform} ·{" "}
                      {problem.difficulty}
                    </p>
                  </div>
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
                        onClick={() => handleProblemStatus(problem.id, status)}
                        type="button"
                      >
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <p className="panel-label">Due Revisions</p>
            {revisions.length > 0 ? (
              <ul className="revision-list">
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    <strong>{revision.problem.title}</strong>
                    <span>
                      {revision.problem.topic} · due{" "}
                      {formatRevisionDate(revision.dueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No revisions due today.</p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
