'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

const Ctx = createContext<{ editable: boolean; toggle: () => void }>({ editable: true, toggle: () => {} });

export function EditableProvider({ children }: { children: ReactNode }) {
  const [editable, setEditable] = useState(true);
  return <Ctx.Provider value={{ editable, toggle: () => setEditable(v => !v) }}>{children}</Ctx.Provider>;
}

export const useEditable = () => useContext(Ctx);
