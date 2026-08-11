'use client';
import { useState, ReactNode } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar';
import { EditableProvider } from './editable-context';
import { ToastProvider } from './ui/toast';

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <EditableProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          {open && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
          <aside className={`fixed inset-y-0 left-0 z-30 w-56 bg-navy transform transition-transform md:translate-x-0 md:static ${open ? 'translate-x-0' : '-translate-x-full'}`}>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
          <div className="flex-1 flex flex-col min-w-0">
            <Topbar onToggleSidebar={() => setOpen(o => !o)} />
            <main className="flex-1 p-3 md:p-5 max-w-6xl w-full mx-auto">{children}</main>
          </div>
        </div>
      </ToastProvider>
    </EditableProvider>
  );
}
