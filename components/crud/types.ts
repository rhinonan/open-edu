import type { ReactNode } from 'react';
import type { ResourceKey, Row } from '@/lib/types';
import type { ImportItem } from '@/lib/import';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

export interface ColumnDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  width?: string;
  readOnly?: boolean;
  render?: (row: Row) => ReactNode;
  nullOnEmpty?: boolean;
}

export interface FilterDef { key: string; label: string; options: string[]; }

export interface StatDef { label: string; value: string | number; tone?: 'blue' | 'teal' | 'purple' | 'amber' | 'red' | 'default'; }

export interface ImportTemplate {
  filename: string;
  columns: { key: string; label: string }[];
  exampleRow: Record<string, string | number>;
  parseRow: (fields: Record<string, string>, line: number) =>
    { ok: true; row: ImportItem } | { ok: false; message: string };
}

export interface CrudPageConfig {
  resource: ResourceKey;
  title: string;
  columns: ColumnDef[];
  filters?: { key: string; label: string; options: string[] }[];
  stats?: (rows: Row[]) => StatDef[];
  defaultNewRow?: (rows: Row[]) => Record<string, string | number | null>;
  canDelete?: boolean;
  sortRows?: (a: Row, b: Row) => number;
  defaultHidden?: string[];
  importTemplate?: ImportTemplate;
}
