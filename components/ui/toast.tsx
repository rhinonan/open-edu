'use client';
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

const Ctx = createContext<{ toast: (msg: string, tone?: 'ok' | 'err') => void }>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: 'ok' | 'err' }[]>([]);
  const toast = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems(list => [...list, { id, msg, tone }]);
    setTimeout(() => setItems(list => list.filter(i => i.id !== id)), 2200);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-14 right-4 z-50 flex flex-col gap-2">
        {items.map(i => (
          <div key={i.id} className={`px-3 py-2 rounded-md text-sm text-white shadow ${i.tone === 'err' ? 'bg-red-500' : 'bg-teal-600'}`}>
            {i.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
