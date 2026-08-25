'use client';
import { Tabs } from '@heroui/react';
import ClassTimetable from '@/components/timetable/class-timetable';
import TeacherSchedule from '@/components/timetable/teacher-schedule';

export default function TimetablePage() {
  return (
    <Tabs>
      <Tabs.List>
        <Tabs.Tab id="class">班级课表</Tabs.Tab>
        <Tabs.Tab id="teacher">我的授课</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="class"><ClassTimetable /></Tabs.Panel>
      <Tabs.Panel id="teacher"><TeacherSchedule /></Tabs.Panel>
    </Tabs>
  );
}
