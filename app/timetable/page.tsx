'use client';
import { Tabs } from 'antd';
import ClassTimetable from '@/components/timetable/class-timetable';
import TeacherSchedule from '@/components/timetable/teacher-schedule';

export default function TimetablePage() {
  return (
    <Tabs
      items={[
        { key: 'class', label: '班级课表', children: <ClassTimetable /> },
        { key: 'teacher', label: '我的授课', children: <TeacherSchedule /> },
      ]}
    />
  );
}
