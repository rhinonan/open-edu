'use client';
import { Tabs } from '@heroui/react';
import ClassTimetable from '@/components/timetable/class-timetable';
import TeacherSchedule from '@/components/timetable/teacher-schedule';

export default function TimetablePage() {
  return (
    <div className="flex flex-col gap-4">
      <Tabs>
        <Tabs.ListContainer className="w-fit">
          <Tabs.List aria-label="课表视图">
            <Tabs.Tab id="class">班级课表<Tabs.Indicator /></Tabs.Tab>
            <Tabs.Tab id="teacher">我的授课<Tabs.Indicator /></Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="class"><ClassTimetable /></Tabs.Panel>
        <Tabs.Panel id="teacher"><TeacherSchedule /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
