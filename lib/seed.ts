import type { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema';
import { hashPassword } from './auth';
import { DEFAULT_SLOTS, applySlotsToClass, seedDefaultTemplate } from './templates';

const SURNAMES = ['李','王','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗','梁','宋','郑','谢','韩','唐','冯','于','董','萧','程','曹','袁','邓','许','傅','沈','曾','彭','吕','苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎','余','潘','杜','戴','夏','钟','汪','田','任','姜','范','方','石','姚','谭','廖','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史','顾','侯','邵','孟','龙','万','段','雷','钱','汤','尹','黎','易','常','武','乔','贺','赖','龚'];
const GIVEN = ['子涵','雨欣','欣怡','梓萱','浩然','子轩','宇轩','思远','俊杰','天佑','佳琪','梦洁','诗涵','可欣','一诺','欣妍','奕辰','梓豪','若曦','语嫣','悦彤','雨泽','志强','文博','明轩','芷晴','思彤','博文','子墨','峻熙','嘉懿','煜城','懿轩','烨霖','楷瑞','建辉','致远','文昊','凯瑞','昊然','奕然','黎昕','志远','轩磊','浩宇','瑾瑜','子航','梓童','静怡','思睿'];
const PHONE_PREFIX = ['130','131','132','133','135','136','137','138','139','150','151','152','153','155','156','157','158','159','180','181','182','183','185','186','187','188','189'];
const AREAS = ['青园街道', '侯家塘街道', '金盆岭街道', '东塘街道', '赤岭路街道', '文源街道'];
const RESIDENCES = ['天心阁小区', '湘府华庭', '阳光壹佰', '白沙花园', '翡翠云天', '翰林府'];
const ROLES = ['班长','副班长','学习委员','纪律委员','劳动委员','体育委员','语文课代表','数学课代表','英语课代表', ''];

function rand(n: number) { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rand(arr.length)]; }
function phone() { return pick(PHONE_PREFIX) + String(rand(90000000) + 10000000); }
function date(daysAgo: number) { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); }
function uniqueNames(n: number): string[] { const out = new Set<string>(); while (out.size < n) out.add(pick(SURNAMES) + pick(GIVEN)); return [...out]; }

function fakeIdcard(i: number): string {
  const area = '430102';
  const birth = `${2013 + rand(2)}${String(rand(12) + 1).padStart(2, '0')}${String(rand(28) + 1).padStart(2, '0')}`;
  const seq = String(i + 1).padStart(3, '0');
  const body = area + birth + seq;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const map = '10X98765432';
  const sum = body.split('').reduce((s, ch, idx) => s + Number(ch) * weights[idx], 0);
  return body + map[sum % 11];
}

/** 为指定班级灌入一套完整演示数据（45 名学生 + 班级配置 + 课表 + 成绩 + 各类业务行） */
export function seedClass(db: DatabaseSync, classId: number): void {
  applySlotsToClass(db, classId, DEFAULT_SLOTS);

  const ins = db.prepare(`INSERT INTO students (class_id, student_no, name, gender, parent_name, parent_phone, idcard, address, level, group_no, role, noon_care, breakfast, afternoon_care, remark)
    VALUES (@classId, @student_no, @name, @gender, @parent_name, @phone, @idcard, @address, @level, @group, @role, @noon, @breakfast, @care, '')`);
  const students = uniqueNames(45);
  students.forEach((name, i) => {
    ins.run({
      classId,
      student_no: String(i + 1).padStart(2, '0'),
      name,
      gender: rand(2) === 0 ? '女' : '男',
      parent_name: pick(SURNAMES) + pick(GIVEN),
      phone: phone(),
      idcard: fakeIdcard(i),
      address: pick(AREAS) + pick(RESIDENCES),
      level: 1 + rand(6),
      group: rand(6) + 1,
      role: rand(4) === 0 ? pick(ROLES) : '',
      noon: rand(2) === 0 ? 0 : 1,
      breakfast: rand(2) === 0 ? 0 : 1,
      care: rand(2) === 0 ? 0 : 1,
    });
  });

  db.prepare(`INSERT INTO classroom_config (class_id, row_count, col_count, desk_label) VALUES (?, 7, 8, '双人课桌')`).run(classId);

  // 班级课表：只为「正课」时段生成（7 个正课时段 × 5 天 = 35 行），关联本班 period_slots
  const slotRows = (db.prepare('SELECT id, kind FROM period_slots WHERE class_id = ? ORDER BY seq').all(classId) as { id: number; kind: string }[]);
  const subjects = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];
  const insTt = db.prepare(`INSERT INTO timetable (class_id, weekday, period_id, subject, is_chinese) VALUES (?, ?, ?, ?, ?)`);
  for (let wd = 1; wd <= 5; wd++) {
    for (const s of slotRows) {
      if (s.kind !== '正课') continue;
      const subject = pick(subjects);
      insTt.run(classId, wd, s.id, subject, subject === '语文' ? 1 : 0);
    }
  }

  // 班主任授课安排（演示）：本班 + 跨班各若干（class_id 均归属当前班，跨班仅 class_name 文本指向他班）。时段按 seq 查本班 id
  const idOfSeq = (seq: number) => (db.prepare('SELECT id FROM period_slots WHERE class_id = ? AND seq = ?').get(classId, seq) as { id: number }).id;
  const insTs = db.prepare(`INSERT INTO teacher_schedule (class_id, weekday, period_id, class_name, subject, remark) VALUES (?, ?, ?, ?, ?, ?)`);
  insTs.run(classId, 1, idOfSeq(2), '长沙青园小学六年级（1）班', '语文', '本班');
  insTs.run(classId, 2, idOfSeq(9), '六年级（2）班', '数学', '跨班');
  insTs.run(classId, 4, idOfSeq(4), '长沙青园小学六年级（1）班', '语文', '');

  const g = db.prepare(`INSERT INTO grades (class_id, exam_name, subject, student_name, score) VALUES (?, '单元小测（一）', ?, ?, ?)`);
  for (const s of students) for (const subj of ['语文', '数学', '英语']) g.run(classId, subj, s, 60 + rand(40));

  const lv = db.prepare(`INSERT INTO leave_records (class_id, student_name, leave_type, reason, start_date, end_date, hours) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  lv.run(classId, students[0], '事假', '家里有事', date(1), date(1), 8);
  lv.run(classId, students[1], '病假', '感冒发烧', date(2), date(1), 16);

  const dc = db.prepare(`INSERT INTO discipline_records (class_id, date, student_name, category, content, action) VALUES (?, ?, ?, ?, ?, ?)`);
  dc.run(classId, date(1), students[2], '课堂表现', '上课讲话', '谈话教育');
  dc.run(classId, date(2), students[3], '迟到早退', '迟到 10 分钟', '提醒并联系家长');

  const conv = db.prepare(`INSERT INTO conversations (class_id, date, student_name, topic, content, effect) VALUES (?, ?, ?, ?, ?, ?)`);
  conv.run(classId, date(1), students[2], '课堂纪律', '约定课堂不讲话', '有改善');
  const hv = db.prepare(`INSERT INTO home_visits (class_id, date, student_name, way, content, is_meeting) VALUES (?, ?, ?, ?, ?, ?)`);
  hv.run(classId, date(5), students[0], '家访', '了解家庭学习环境', 0);
  hv.run(classId, date(6), '全班', '家长会', '期中家长会：学情反馈', 1);
  const ev = db.prepare(`INSERT INTO evaluation (class_id, student_name, moral, study, sports, art, labor, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const s of students) ev.run(classId, s, 3 + rand(3), 2 + rand(4), 2 + rand(4), 2 + rand(4), 2 + rand(4), '');
  const pc = db.prepare(`INSERT INTO parent_comm (class_id, date, student_name, way, content) VALUES (?, ?, ?, ?, ?)`);
  pc.run(classId, date(1), students[0], '微信', '反馈近期作业情况');
  const sl = db.prepare(`INSERT INTO safety_logs (class_id, date, category, content, action) VALUES (?, ?, ?, ?, ?)`);
  sl.run(classId, date(3), '消防', '消防疏散演练', '已完成');

  const wl = db.prepare(`INSERT INTO work_logs (class_id, date, title, type, place, hours) VALUES (?, ?, ?, ?, ?, ?)`);
  const workSeed: [string, string, string, number][] = [
    ['早读巡查', '班级管理', '教室', 0.5],
    ['集体备课', '教学教研', '办公室', 1.5],
    ['家长会筹备', '家校沟通', '办公室', 1],
    ['作文培优', '学生培优', '教室', 1],
    ['安全主题班会', '安全教育', '教室', 0.5],
  ];
  workSeed.forEach(([title, type, place, hours], i) => wl.run(classId, date(i * 2), title, type, place, hours));

  const td = db.prepare(`INSERT INTO todos (class_id, title, date, status, priority) VALUES (?, ?, ?, ?, ?)`);
  td.run(classId, '准备下周家长会材料', date(0), '待办', '高');
  td.run(classId, '核对期末评语', date(2), '待办', '普通');
  td.run(classId, '收集研学回执', date(4), '已完成', '普通');

  const seat = db.prepare(`INSERT INTO seats (class_id, row_index, col_index, student_name) VALUES (?, ?, ?, ?)`);
  const cc = db.prepare('SELECT row_count, col_count FROM classroom_config WHERE class_id = ?').get(classId) as { row_count: number; col_count: number };
  let si = 0;
  for (let r = 0; r < cc.row_count; r++) for (let c = 0; c < cc.col_count; c++) { seat.run(classId, r, c, si < students.length ? students[si] : ''); si++; }
}

/** users 为空时引导：建 admin、一个演示班、一个 demo 老师。返回是否新建了账号 */
export function bootstrap(db: DatabaseSync): { createdAdmin: boolean } {
  seedDefaultTemplate(db);
  const n = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (n > 0) return { createdAdmin: false };
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users (username, password_hash, name, role, class_id, created_at) VALUES ('admin', ?, '系统管理员', 'admin', NULL, ?)`)
    .run(hashPassword('admin'), now);
  const { lastInsertRowid: classId } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('长沙青园小学六年级（1）班', '王老师', '六年级')`).run();
  seedClass(db, Number(classId));
  db.prepare(`INSERT INTO users (username, password_hash, name, role, class_id, created_at) VALUES ('demo', ?, '王老师', 'teacher', ?, ?)`)
    .run(hashPassword('demo'), Number(classId), now);
  return { createdAdmin: true };
}

/** 重置某一班级：删除其全部业务行并重新播种 */
export function resetClass(db: DatabaseSync, classId: number): void {
  const childTables = ['todos', 'work_logs', 'safety_logs', 'parent_comm', 'evaluation', 'home_visits',
    'conversations', 'timetable', 'period_slots', 'teacher_schedule', 'grades', 'discipline_records', 'leave_records', 'seats', 'students', 'classroom_config'];
  for (const t of childTables) {
    const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(c => c.name);
    if (cols.includes('class_id')) db.prepare(`DELETE FROM ${t} WHERE class_id = ?`).run(classId);
    else db.prepare(`DELETE FROM ${t}`).run();
  }
  seedClass(db, classId);
}

/** 全库重置（启动自愈用）：DROP 全部 → 重建 → 引导 */
export function resetData(db: DatabaseSync): void {
  const tables = ['sessions', 'work_logs', 'safety_logs', 'parent_comm', 'evaluation', 'home_visits',
    'conversations', 'timetable', 'period_slots', 'schedule_templates', 'teacher_schedule', 'grades', 'discipline_records', 'leave_records', 'seats', 'students',
    'classroom_config', 'users', 'classes'];
  db.exec(tables.map(t => `DROP TABLE IF EXISTS ${t}`).join(';'));
  db.exec(SCHEMA_SQL);
  bootstrap(db);
}
