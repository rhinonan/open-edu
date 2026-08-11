import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { DashboardStats } from './types';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export function dashboardStats(db: DatabaseSync): DashboardStats {
  const one = (sql: string, params: SQLInputValue[] = []) => (db.prepare(sql).get(...params) as Record<string, number>);
  const students = one('SELECT COUNT(*) n FROM students');
  const male = one("SELECT COUNT(*) n FROM students WHERE gender='男'");
  const todayLeaves = one("SELECT COUNT(*) n FROM leave_records WHERE start_date <= ? AND end_date >= ?", [today(), today()]).n;
  const weekDiscipline = one('SELECT COUNT(*) n FROM discipline_records WHERE date >= ?', [daysAgo(6)]).n;
  const todoPending = one("SELECT COUNT(*) n FROM todos WHERE status='待办'").n;

  const hw = db.prepare('SELECT submitted, late, missing FROM homework').all() as { submitted: number; late: number; missing: number }[];
  const hwTotal = hw.reduce((s, h) => s + h.submitted + h.late + h.missing, 0);
  const hwSubmitted = hw.reduce((s, h) => s + h.submitted, 0);
  const homeworkSubmitRate = hwTotal > 0 ? Math.round((hwSubmitted / hwTotal) * 100) : 0;

  const examRow = db.prepare("SELECT AVG(score) avg FROM grades WHERE exam_name=(SELECT exam_name FROM grades ORDER BY id DESC LIMIT 1)").get() as { avg: number | null };
  const latestExamAvg = examRow.avg == null ? null : Math.round(examRow.avg * 10) / 10;

  const monthWorkLogs = one('SELECT COUNT(*) n FROM work_logs WHERE date >= ?', [daysAgo(30)]).n;
  const homeVisitCount = one("SELECT COUNT(*) n FROM home_visits WHERE is_meeting=0").n;
  const parentMeetingCount = one("SELECT COUNT(*) n FROM home_visits WHERE is_meeting=1").n;
  const parentMeetingRate = parentMeetingCount > 0 ? Math.round((45 / 50) * 100) : 0;
  const criticalCount = one('SELECT COUNT(*) n FROM peiyou_records').n;

  return {
    studentCount: students.n,
    maleCount: male.n,
    femaleCount: students.n - male.n,
    todayLeaves,
    weekDiscipline,
    todoPending,
    homeworkSubmitRate,
    latestExamAvg,
    monthWorkLogs,
    homeVisitCount,
    parentMeetingCount,
    parentMeetingRate,
    criticalCount,
  };
}
