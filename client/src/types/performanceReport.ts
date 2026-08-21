export interface ApprovalBreakdown {
  approved: number;
  rejected: number;
  rate: number | null;
}

export interface ProjectApprovalBreakdown extends ApprovalBreakdown {
  projectId: string;
  projectName: string;
}

export interface WorkerApprovalBreakdown extends ApprovalBreakdown {
  userId: string;
  userName: string;
}

export interface WorkerProductivity {
  userId: string;
  userName: string;
  completedActivities: number;
  hoursWorked: number;
  activitiesPerHour: number | null;
}

export interface PerformanceReport {
  filters: {
    from: string | null;
    to: string | null;
    projectId: string | null;
    userId: string | null;
  };
  avgCostPerCompletedActivity: number | null;
  completedActivitiesCount: number;
  avgProjectDelayDays: number | null;
  projectsWithCompletedActivityCount: number;
  evidenceApproval: {
    overall: ApprovalBreakdown;
    byProject: ProjectApprovalBreakdown[];
    byWorker: WorkerApprovalBreakdown[];
  };
  productivityByWorker: WorkerProductivity[];
}
