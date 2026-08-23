import type { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema';

const SURNAMES = ['李','王','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗','梁','宋','郑','谢','韩','唐','冯','于','董','萧','程','曹','袁','邓','许','傅','沈','曾','彭','吕','苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎','余','潘','杜','戴','夏','钟','汪','田','任','姜','范','方','石','姚','谭','廖','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史','顾','侯','邵','孟','龙','万','段','雷','钱','汤','尹','黎','易','常','武','乔','贺','赖','龚'];
const GIVEN = ['子涵','雨欣','欣怡','梓萱','浩然','子轩','宇轩','思远','俊杰','天佑','佳琪','梦洁','诗涵','可欣','一诺','欣妍','奕辰','梓豪','若曦','语嫣','悦彤','雨泽','志强','文博','明轩','芷晴','思彤','博文','子墨','峻熙','嘉懿','煜城','懿轩','烨霖','楷瑞','建辉','致远','文昊','凯瑞','昊然','奕然','黎昕','志远','轩磊','浩宇','瑾瑜','子航','梓童','静怡','思睿'];
const PHONE_PREFIX = ['130','131','132','133','135','136','137','138','139','150','151','152','153','155','156','157','158','159','180','181','182','183','185','186','187','188','189'];
const AREAS = ['青园街道', '侯家塘街道', '金盆岭街道', '东塘街道', '赤岭路街道', '文源街道'];
const RESIDENCES = ['天心阁小区', '湘府华庭', '阳光壹佰', '白沙花园', '翡翠云天', '翰林府'];
const ROLES = ['班长','副班长','学习委员','纪律委员','劳动委员','体育委员','语文课代表','数学课代表','英语课代表', ''];

function rand(n: number) { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rand(arr.length)]; }
function phone() { return pick(PHONE_PREFIX) + String(rand(90000000) + 10000000); }
function date(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function uniqueNames(n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(pick(SURNAMES) + pick(GIVEN));
  return [...out];
}

function fakeIdcard(i: number): string {
  const area = '430102';
  const birth = `${2013 + rand(2)}${String(rand(12) + 1).padStart(2, '0')}${String(rand(28) + 1).padStart(2, '0')}`;
  const seq = String(i + 1).padStart(3, '0'); // i 0..44 → 唯一
  const body = area + birth + seq; // 17 位
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const map = '10X98765432';
  const sum = body.split('').reduce((s, ch, idx) => s + Number(ch) * weights[idx], 0);
  return body + map[sum % 11];
}

export function seedIfEmpty(db: DatabaseSync): void {
  const has = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
  if (has > 0) return;

  const ins = db.prepare(`INSERT INTO students (student_no, name, gender, parent_name, parent_phone, idcard, address, level, group_no, role, noon_care, breakfast, afternoon_care, remark)
    VALUES (@student_no, @name, @gender, @parent_name, @phone, @idcard, @address, @level, @group, @role, @noon, @breakfast, @care, '')`);
  const students = uniqueNames(45);
  students.forEach((name, i) => {
    ins.run({
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

  db.prepare(`INSERT INTO settings (key, value) VALUES
    ('class_name', '长沙青园小学六年级（1）班'),
    ('head_teacher', '王老师'),
    ('grade_band', '六年级'),
    ('total_count', '45'),
    ('male_count', '23'),
    ('female_count', '22')`).run();

  db.prepare(`INSERT INTO classroom_config (row_count, col_count, desk_label) VALUES (7, 8, '双人课桌')`).run();

  // 时段定义：早自习 + 上午正课4 + 中午托 + 陪餐 + 下午正课3 + 下午托（共 11 个）
  const slots: [string, string, string, string][] = [
    ['早自习', '08:00', '08:20', '自习'],
    ['上午第1节', '08:25', '09:05', '正课'],
    ['上午第2节', '09:15', '09:55', '正课'],
    ['上午第3节', '10:05', '10:45', '正课'],
    ['上午第4节', '10:55', '11:35', '正课'],
    ['中午托', '11:40', '12:10', '托管'],
    ['陪餐', '12:10', '12:40', '陪餐'],
    ['下午第1节', '14:00', '14:40', '正课'],
    ['下午第2节', '14:50', '15:30', '正课'],
    ['下午第3节', '15:40', '16:20', '正课'],
    ['下午托', '16:20', '17:00', '托管'],
  ];
  const insSlot = db.prepare(`INSERT INTO period_slots (seq, name, start_time, end_time, kind) VALUES (?, ?, ?, ?, ?)`);
  slots.forEach(([name, s, e, kind], i) => insSlot.run(i + 1, name, s, e, kind));

  // 正课科目：语数英科学道法体音美班会劳动；仍用 lib/seed.ts 顶部已有的 subjects 字典改个名避免冲突
  const ttSubjects = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];
  const insTt = db.prepare(`INSERT INTO timetable (weekday, period_id, subject, is_chinese) VALUES (?, ?, ?, ?)`);
  for (let wd = 1; wd <= 5; wd++) {
    slots.forEach(([, , , kind], i) => {
      if (kind !== '正课') return;
      const subject = pick(ttSubjects);
      insTt.run(wd, i + 1, subject, subject === '语文' ? 1 : 0);
    });
  }

  // 班主任授课安排（演示）：本班 + 跨班各若干
  const insTs = db.prepare(`INSERT INTO teacher_schedule (weekday, period_id, class_name, subject, remark) VALUES (?, ?, ?, ?, ?)`);
  insTs.run(1, 2, '长沙青园小学六年级（1）班', '语文', '本班');
  insTs.run(2, 9, '六年级（2）班', '数学', '跨班');
  insTs.run(4, 4, '长沙青园小学六年级（1）班', '语文', '');

  // 一次单元测成绩（语数英，45 人）
  const g = db.prepare(`INSERT INTO grades (exam_name, subject, student_name, score) VALUES ('单元小测（一）', ?, ?, ?)`);
  for (const s of students) {
    for (const subj of ['语文', '数学', '英语']) {
      g.run(subj, s, 60 + rand(40));
    }
  }

  // 请假
  const lv = db.prepare(`INSERT INTO leave_records (student_name, leave_type, reason, start_date, end_date, hours) VALUES (?, ?, ?, ?, ?, ?)`);
  lv.run(students[0], '事假', '家里有事', date(1), date(1), 8);
  lv.run(students[1], '病假', '感冒发烧', date(2), date(1), 16);

  // 违纪
  const dc = db.prepare(`INSERT INTO discipline_records (date, student_name, category, content, action) VALUES (?, ?, ?, ?, ?)`);
  dc.run(date(1), students[2], '课堂表现', '上课讲话', '谈话教育');
  dc.run(date(2), students[3], '迟到早退', '迟到 10 分钟', '提醒并联系家长');

  // 谈话 / 家访 / 综合素质 / 家校沟通 / 安全
  const conv = db.prepare(`INSERT INTO conversations (date, student_name, topic, content, effect) VALUES (?, ?, ?, ?, ?)`);
  conv.run(date(1), students[2], '课堂纪律', '约定课堂不讲话', '有改善');
  const hv = db.prepare(`INSERT INTO home_visits (date, student_name, way, content, is_meeting) VALUES (?, ?, ?, ?, ?)`);
  hv.run(date(5), students[0], '家访', '了解家庭学习环境', 0);
  hv.run(date(6), '全班', '家长会', '期中家长会：学情反馈', 1);
  const ev = db.prepare(`INSERT INTO evaluation (student_name, moral, study, sports, art, labor, comment) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const s of students) {
    ev.run(s, 3 + rand(3), 2 + rand(4), 2 + rand(4), 2 + rand(4), 2 + rand(4), '');
  }
  const pc = db.prepare(`INSERT INTO parent_comm (date, student_name, way, content) VALUES (?, ?, ?, ?)`);
  pc.run(date(1), students[0], '微信', '反馈近期作业情况');
  const sl = db.prepare(`INSERT INTO safety_logs (date, category, content, action) VALUES (?, ?, ?, ?)`);
  sl.run(date(3), '消防', '消防疏散演练', '已完成');

  // 工作留痕
  const wl = db.prepare(`INSERT INTO work_logs (date, title, type, place, hours) VALUES (?, ?, ?, ?, ?)`);
  const workSeed: [string, string, string, number][] = [
    ['早读巡查', '班级管理', '教室', 0.5],
    ['集体备课', '教学教研', '办公室', 1.5],
    ['家长会筹备', '家校沟通', '办公室', 1],
    ['作文培优', '学生培优', '教室', 1],
    ['安全主题班会', '安全教育', '教室', 0.5],
  ];
  workSeed.forEach(([title, type, place, hours], i) => wl.run(date(i * 2), title, type, place, hours));

  // 待办
  const td = db.prepare(`INSERT INTO todos (title, date, status, priority) VALUES (?, ?, ?, ?)`);
  td.run('准备下周家长会材料', date(0), '待办', '高');
  td.run('核对期末评语', date(2), '待办', '普通');
  td.run('收集研学回执', date(4), '已完成', '普通');

  // 座位初始排布（默认空，由排座位页分配）
  const seat = db.prepare(`INSERT INTO seats (row_index, col_index, student_name) VALUES (?, ?, ?)`);
  const cc = db.prepare('SELECT row_count, col_count FROM classroom_config').get() as { row_count: number; col_count: number };
  let si = 0;
  for (let r = 0; r < cc.row_count; r++) {
    for (let c = 0; c < cc.col_count; c++) {
      seat.run(r, c, si < students.length ? students[si] : '');
      si++;
    }
  }
}

export function resetData(db: DatabaseSync): void {
  const tables = ['todos', 'work_logs', 'safety_logs', 'parent_comm',
    'evaluation', 'home_visits', 'conversations', 'timetable', 'period_slots', 'teacher_schedule',
    'grades', 'discipline_records', 'leave_records', 'seats', 'students', 'settings', 'classroom_config'];
  db.exec(tables.map(t => `DROP TABLE IF EXISTS ${t}`).join(';'));
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
}
