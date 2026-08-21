'use client';
import { useEffect, useState } from 'react';
import { Button, Checkbox, Dropdown, Space, Typography, Upload } from 'antd';
import { DownloadOutlined, PlusOutlined, SettingOutlined, UploadOutlined } from '@ant-design/icons';
import type { Row } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';

export function useColumnVisibility(storageKey: string, defaultHidden: string[] = []) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (Array.isArray(v)) return new Set(v);
    } catch { /* localStorage 不可用 */ }
    return new Set(defaultHidden);
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...hidden])); } catch { /* ignore */ }
  }, [hidden, storageKey]);
  return {
    hidden,
    toggle: (key: string) => setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    }),
  };
}

export interface ToolbarColumn { key: string; label: string; exportable?: boolean; }

interface Props {
  title: string;
  columns: ToolbarColumn[];
  hidden: Set<string>;
  onToggleColumn: (key: string) => void;
  rows: Row[];
  onAdd?: () => void;
  onImport?: (text: string) => Promise<void>;
}

export default function TableToolbar({ title, columns, hidden, onToggleColumn, rows, onAdd, onImport }: Props) {
  const exportable = columns.filter(c => (c.exportable ?? true) && !hidden.has(c.key));
  const exportCsv = () => {
    downloadCsv(`${title}.csv`, exportable.map(c => c.label), rows.map(r => exportable.map(c => r[c.key] ?? '')));
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
      <Space wrap>
        {onImport && (
          <Upload accept=".csv" showUploadList={false} beforeUpload={(file) => {
            const reader = new FileReader();
            reader.onload = () => { void onImport!(String(reader.result ?? '')); };
            reader.readAsText(file);
            return false;
          }}>
            <Button icon={<UploadOutlined />}>导入</Button>
          </Upload>
        )}
        <Button icon={<DownloadOutlined />} onClick={exportCsv}>导出</Button>
        <Dropdown trigger={['click']} menu={{ items: columns.map(c => ({
          key: c.key,
          label: (
            <Checkbox checked={!hidden.has(c.key)} onChange={() => onToggleColumn(c.key)} style={{ width: '100%' }}>
              {c.label}
            </Checkbox>
          ),
        })) }}>
          <Button icon={<SettingOutlined />}>列</Button>
        </Dropdown>
        {onAdd && <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增</Button>}
      </Space>
    </div>
  );
}
