export type Row = Record<string, string | number | null>;

export type ResourceKey =
  | 'settings' | 'students' | 'classroom_config' | 'leave_records'
  | 'discipline_records' | 'grades' | 'homework' | 'schedules'
  | 'timetable' | 'todos' | 'conversations' | 'home_visits'
  | 'evaluation' | 'parent_comm' | 'safety_logs' | 'peiyou_records'
  | 'work_logs' | 'seats';

export interface DashboardStats {
  studentCount: number;
  maleCount: number;
  femaleCount: number;
  todayLeaves: number;
  weekDiscipline: number;
  todoPending: number;
  homeworkSubmitRate: number; // 0-100
  latestExamAvg: number | null;
  monthWorkLogs: number;
  homeVisitCount: number;
  parentMeetingCount: number;
  parentMeetingRate: number; // 0-100
  criticalCount: number;
}
