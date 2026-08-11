import type { DatabaseSync } from 'node:sqlite';

const SURNAMES = ['李','王','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗','梁','宋','郑','谢','韩','唐','冯','于','董','萧','程','曹','袁','邓','许','傅','沈','曾','彭','吕','苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎','余','潘','杜','戴','夏','钟','汪','田','任','姜','范','方','石','姚','谭','廖','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史','顾','侯','邵','孟','龙','万','段','雷','钱','汤','尹','黎','易','常','武','乔','贺','赖','龚'];
const GIVEN = ['子涵','雨欣','欣怡','梓萱','浩然','子轩','宇轩','思远','俊杰','天佑','佳琪','梦洁','诗涵','可欣','一诺','欣妍','奕辰','梓豪','若曦','语嫣','悦彤','雨泽','志强','文博','明轩','芷晴','思彤','博文','子墨','峻熙','嘉懿','煜城','懿轩','烨霖','楷瑞','建辉','致远','文昊','凯瑞','昊然','奕然','黎昕','志远','轩磊','浩宇','瑾瑜','子航','梓童','静怡','思睿'];
const PHONE_PREFIX = ['130','131','132','133','135','136','137','138','139','150','151','152','153','155','156','157','158','159','180','181','182','183','185','186','187','188','189'];
const LEVELS = ['优秀','良好','合格','重点关注'];
const ROLES = ['班长','副班长','学习委员','纪律委员','劳动委员','体育委员','语文课代表','数学课代表','英语课代表', ''];
const DISCIPLINE_CATS = ['常规纪律','迟到早退','课堂表现','课间行为','卫生值日'];
const WORK_TYPES = ['班级管理','教学教研','家校沟通','学生培优','生涯活动','安全教育','会议培训','心理辅导'];
const SAFETY_CATS = ['课间','交通','食品','消防','防溺水','其他'];

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

export function seedIfEmpty(db: DatabaseSync): void {
  const has = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
  if (has > 0) return;

  const ins = db.prepare(`INSERT INTO students (name, gender, parent_phone, role, group_no, level, afternoon_care, remark)
    VALUES (@name, @gender, @phone, @role, @group, @level, @care, '')`);
  const students = uniqueNames(45);
  for (const name of students) {
    ins.run({
      name,
      gender: rand(2) === 0 ? '女' : '男',
      phone: phone(),
      role: rand(4) === 0 ? pick(ROLES) : '',
      group: rand(6) + 1,
      level: pick(LEVELS),
      care: rand(2) === 0 ? 0 : 1,
    });
  }

  db.prepare(`INSERT INTO settings (key, value) VALUES
    ('class_name', '长沙青园小学六年级（1）班'),
    ('head_teacher', '王老师'),
    ('grade_band', '六年级'),
    ('total_count', '45'),
    ('male_count', '23'),
    ('female_count', '22')`).run();

  db.prepare(`INSERT INTO classroom_config (row_count, col_count, desk_label) VALUES (6, 8, '双人课桌')`).run();

  // 课表：周一~周五，早读/正课/中午托/下午托；语文标 is_chinese=1
  const periods = ['早读', '正课', '正课', '正课', '中午托', '下午托'];
  const subjects = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];
  const tt = db.prepare(`INSERT INTO timetable (weekday, period, subject, is_chinese) VALUES (?, ?, ?, ?)`);
  for (let wd = 1; wd <= 5; wd++) {
    periods.forEach((p, i) => {
      let subject = pick(subjects);
      if (p === '早读') subject = '语文';
      if (p === '中午托' || p === '下午托') subject = '自习';
      tt.run(wd, p, subject, subject === '语文' ? 1 : 0);
    });
  }

  // 日程
  const sch = db.prepare(`INSERT INTO schedules (date, title, type, duration_min, done) VALUES (?, ?, ?, ?, ?)`);
  const scheduleSeed = [
    ['集体备课：第六单元', '备课', 90, 0],
    ['年级教研会', '教研', 60, 1],
    ['培优辅导：作文专项', '培优', 60, 0],
    ['监考：单元小测', '监考', 120, 0],
    ['家长会', '会议', 120, 0],
  ];
  scheduleSeed.forEach(([title, type, dur, done], i) => sch.run(date(i * 2), title as string, type as string, dur as number, done as number));

  // 作业
  const hw = db.prepare(`INSERT INTO homework (subject, assign_date, requirement, deadline, submitted, late, missing, missing_names) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  hw.run('语文', date(2), '预习第 12 课生字词，抄写两遍', date(1), 40, 3, 2, '张三,李四');
  hw.run('数学', date(2), '练习册第 45-46 页', date(1), 38, 5, 2, '王五,赵六');
  hw.run('语文', date(4), '周记一篇', date(3), 42, 1, 2, '刘七,陈八');

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
  lv.run(students[1], '病假', '感冒发烧', date(3), date(2), 16);

  // 违纪
  const dc = db.prepare(`INSERT INTO discipline_records (date, student_name, category, content, action) VALUES (?, ?, ?, ?, ?)`);
  dc.run(date(1), students[2], '课堂表现', '上课讲话', '谈话教育');
  dc.run(date(2), students[3], '迟到早退', '迟到 10 分钟', '提醒并联系家长');

  // 谈话 / 家访 / 综合素质 / 家校沟通 / 安全 / 培优
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
  const py = db.prepare(`INSERT INTO peiyou_records (student_name, subject, weak_point, target_score, record) VALUES (?, ?, ?, ?, ?)`);
  py.run(students[4], '语文', '阅读理解', 85, '每周一篇阅读训练');
  py.run(students[5], '数学', '应用题', 90, '每日 2 题巩固');

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
  const tables = ['todos', 'work_logs', 'peiyou_records', 'safety_logs', 'parent_comm',
    'evaluation', 'home_visits', 'conversations', 'timetable', 'schedules', 'homework',
    'grades', 'discipline_records', 'leave_records', 'seats', 'students', 'settings', 'classroom_config'];
  db.exec(tables.map(t => `DELETE FROM ${t}`).join(';'));
  seedIfEmpty(db);
}
