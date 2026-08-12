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
