import type { ReactNode } from 'react';
import type { ResourceKey, Row } from '@/lib/types';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

export interface ColumnDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  width?: string;
  readOnly?: boolean;
  render?: (row: Row) => ReactNode;
}

export interface FilterDef { key: string; label: string; options: string[]; }

export interface StatDef { label: string; value: string | number; tone?: 'blue' | 'teal' | 'purple' | 'amber' | 'red' | 'default'; }

export interface CrudPageConfig {
  resource: ResourceKey;
  title: string;
  columns: ColumnDef[];
  stats?: (rows: Row[]) => StatDef[];
  filters?: FilterDef[];
  defaultNewRow?: () => Partial<Row>;
  canDelete?: boolean;
}
