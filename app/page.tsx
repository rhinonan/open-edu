'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Statistic } from 'antd';
import { PlusCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { get, post } from '@/lib/api-client';
import type { DashboardStats, ResourceKey } from '@/lib/types';

const fmt = (n: number) => n.toLocaleString('zh-CN');

interface FieldDef { key: string; label: string; type?: 'text' | 'number' | 'date'; }
interface QuickDef { label: string; href?: string; quick?: { resource: ResourceKey; title: string; fields: FieldDef[] } }

const QUICK: QuickDef[] = [
  { label: '记违纪', quick: { resource: 'discipline_records', title: '记违纪', fields: [{ key: 'student_name', label: '学生' }, { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容' }, { key: 'action', label: '处理方式' }] } },
  { label: '布置作业', quick: { resource: 'homework', title: '布置作业', fields: [{ key: 'subject', label: '学科' }, { key: 'assign_date', label: '布置日期', type: 'date' }, { key: 'requirement', label: '作业要求' }, { key: 'deadline', label: '截止时间', type: 'date' }] } },
  { label: '请假登记', quick: { resource: 'leave_records', title: '请假登记', fields: [{ key: 'student_name', label: '学生' }, { key: 'leave_type', label: '假别' }, { key: 'reason', label: '事由' }, { key: 'start_date', label: '开始日期', type: 'date' }, { key: 'end_date', label: '结束日期', type: 'date' }] } },
  { label: '工作留痕', href: '/work-logs' },
  { label: '谈心谈话', quick: { resource: 'conversations', title: '谈心谈话', fields: [{ key: 'student_name', label: '学生' }, { key: 'topic', label: '主题' }, { key: 'content', label: '内容' }, { key: 'effect', label: '效果' }] } },
  { label: '录入成绩', href: '/grades' },
  { label: '添加待办', quick: { resource: 'todos', title: '添加待办', fields: [{ key: 'title', label: '事项' }, { key: 'date', label: '日期', type: 'date' }, { key: 'priority', label: '优先级' }] } },
  { label: '发布家校通知', quick: { resource: 'parent_comm', title: '家校沟通', fields: [{ key: 'student_name', label: '学生/对象' }, { key: 'way', label: '方式' }, { key: 'content', label: '内容' }] } },
  { label: '日程安排', href: '/schedule' },
  { label: '班级排位', href: '/seats' },
  { label: '学生档案', href: '/students' },
  { label: '家访记录', quick: { resource: 'home_visits', title: '家访记录', fields: [{ key: 'student_name', label: '学生' }, { key: 'way', label: '方式' }, { key: 'content', label: '内容' }] } },
];

export default function HomePage() {
  const { message } = App.useApp();
  const [s, setS] = useState<DashboardStats | null>(null);
  const [active, setActive] = useState<QuickDef | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { get<DashboardStats>('/api/dashboard').then(setS).catch(() => {}); }, []);

  const submit = async () => {
    if (!active?.quick) return;
    try {
      const v = await form.validateFields();
      const body: Record<string, string | number | null> = {};
      for (const f of active.quick.fields) {
        const val = v[f.key];
        body[f.key] = f.type === 'date' ? (val ? (val as dayjs.Dayjs).format('YYYY-MM-DD') : '') : (val ?? '');
      }
      await post(`/api/${active.quick.resource}`, body);
      message.success('已记录');
      setActive(null); form.resetFields();
    } catch { /* 表单校验或请求失败 */ }
  };

  const cards = [
    { title: '班级人数', value: s ? `${s.studentCount} 人` : '—', suffix: s ? `男${s.maleCount}/女${s.femaleCount}` : '' },
    { title: '当日请假', value: s ? `${s.todayLeaves} 人` : '—', suffix: '' },
    { title: '本周常规违纪', value: s ? `${s.weekDiscipline} 条` : '—', suffix: '' },
    { title: '待办事项', value: s ? `${s.todoPending} 项` : '—', suffix: '' },
    { title: '作业收缴率', value: s ? `${s.homeworkSubmitRate}%` : '—', suffix: '' },
    { title: '最近单元测平均分', value: s && s.latestExamAvg != null ? `${s.latestExamAvg} 分` : '—', suffix: '' },
    { title: '本月工作留痕', value: s ? `${fmt(s.monthWorkLogs)} 条` : '—', suffix: '' },
    { title: '家校沟通', value: s ? `家访${s.homeVisitCount} 次` : '—', suffix: s ? `家长会${s.parentMeetingCount} 场 / 沟通率${s.parentMeetingRate}%` : '' },
  ];

  return (
    <div>
      <Row gutter={[12, 12]} className="mb-5">
        {cards.map(c => (
          <Col xs={12} md={6} key={c.title}>
            <Card size="small" style={{ height: '100%' }}>
              <Statistic title={c.title} value={c.value} suffix={c.suffix} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card size="small">
        <h3 className="mb-3 font-semibold text-slate-600" style={{ marginTop: 0 }}>快捷操作</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {QUICK.map(t => t.href ? (
            <Link key={t.label} href={t.href}>
              <Button block style={{ height: 56 }}>{t.label}</Button>
            </Link>
          ) : (
            <Button key={t.label} block style={{ height: 56 }} icon={<PlusCircleOutlined />}
              onClick={() => { setActive(t); form.resetFields(); }}>
              {t.label}
            </Button>
          ))}
        </div>
      </Card>

      <Modal title={active?.quick?.title ?? '快速新增'} open={!!active} onCancel={() => setActive(null)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          {active?.quick?.fields.map(f => (
            <Form.Item key={f.key} name={f.key} label={f.label} rules={f.key === 'student_name' || f.key === 'title' ? [{ required: true, message: `请填写${f.label}` }] : undefined}
              initialValue={f.type === 'date' ? dayjs() : undefined}>
              {f.type === 'date' ? <DatePicker style={{ width: '100%' }} />
                : f.type === 'number' ? <InputNumber style={{ width: '100%' }} />
                : <Input />}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}