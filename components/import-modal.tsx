'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Label, ListBox, Modal, Select, TextArea } from '@heroui/react';
import { Check, Copy, Download, FileUp } from 'lucide-react';
import type { FieldDef } from '@/components/form-modal';
import { downloadCsv } from '@/lib/csv';
import { toast } from '@/lib/toast';

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  prompt: string;
  templateFilename?: string;
  templateHeaders: string[];
  templateRows?: (string | number)[][];
  fields?: FieldDef[];
  onImport: (text: string, extra: Record<string, string | number | null>) => Promise<ImportResult>;
  onSuccess?: () => void;
}

const dateInputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-accent focus:outline-none';

const optsOf = (o?: Array<string | { value: string; label: string }>) =>
  (o ?? []).map(x => (typeof x === 'string' ? { value: x, label: x } : x));

export default function ImportModal({ open, onClose, title, prompt, templateFilename, templateHeaders, templateRows, fields = [], onImport, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const fieldsRef = useRef(fields);
  const wasOpen = useRef(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fieldsRef.current = fields; }, [fields]);
  useEffect(() => {
    if (open && !wasOpen.current) {
      const v: Record<string, string | number> = {};
      for (const f of fieldsRef.current) {
        v[f.key] = f.initial == null ? '' : String(f.initial);
      }
      setValues(v);
      setErrors({});
      setFileName(null);
      setFileText(null);
      setResult(null);
      setCopied(false);
      setBusy(false);
    }
    wasOpen.current = open;
  }, [open]);

  const handleFile = (f: File) => {
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setFileText(String(reader.result ?? ''));
    reader.readAsText(f);
  };

  const downloadTemplate = () => {
    downloadCsv(templateFilename ?? `${title}示例模板.csv`, templateHeaders, templateRows ?? []);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error('复制失败'); }
  };

  const set = (key: string, val: string | number) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && String(values[f.key] ?? '').trim() === '') errs[f.key] = `请填写${f.label}`;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!fileText) { toast.warning('请先选择要导入的 CSV 文件'); return; }
    setBusy(true);
    try {
      const extra: Record<string, string | number | null> = {};
      for (const f of fields) {
        const val = values[f.key];
        extra[f.key] = f.type === 'number' ? (String(val ?? '').trim() === '' ? null : Number(val)) : String(val ?? '');
      }
      const res = await onImport(fileText, extra);
      setResult(res);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败');
    } finally { setBusy(false); }
  };

  const description = `${title}仅支持 CSV 格式，可下载示例模板查看格式。可以将示例模板 + 你的数据 + 以下提示词发给 AI 工具进行整理，整理完成后另存为 CSV 文件再上传。`;

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal.Backdrop isDismissable>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.Header><Modal.Heading>{title}</Modal.Heading></Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm leading-relaxed text-slate-700">
                  <p>{description}</p>
                  <Button variant="outline" size="sm" className="mt-2" onPress={downloadTemplate}>
                    <Download size={16} /> 下载示例模板
                  </Button>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label className="text-sm text-slate-700">AI 整理提示词</Label>
                    <Button variant="ghost" size="sm" onPress={() => void copyPrompt()}>
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '已复制' : '复制'}
                    </Button>
                  </div>
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-3 text-xs leading-relaxed text-slate-600">{prompt}</pre>
                </div>
                <div>
                  <Label className="mb-1 block text-sm text-slate-700">上传 CSV 文件</Label>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition hover:border-accent hover:bg-gray-100"
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files?.[0];
                      if (f) handleFile(f);
                    }}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                    />
                    <FileUp size={28} className="text-slate-400" />
                    <p className="text-sm text-slate-600">
                      {fileName ? `已选择：${fileName}` : '点击选择文件，或将 CSV 文件拖拽到此处'}
                    </p>
                  </div>
                </div>
                {fields.map(f => {
                  const opts = optsOf(f.options);
                  return (
                    <div key={f.key}>
                      <Label isRequired={f.required} className="mb-1 block text-sm text-slate-700">{f.label}</Label>
                      {f.type === 'textarea' ? (
                        <TextArea
                          rows={2} fullWidth
                          value={String(values[f.key] ?? '')}
                          onChange={e => set(f.key, e.target.value)}
                          aria-invalid={errors[f.key] ? true : undefined}
                        />
                      ) : f.type === 'date' ? (
                        <input
                          type="date"
                          className={dateInputCls}
                          value={String(values[f.key] ?? '')}
                          onChange={e => set(f.key, e.target.value)}
                        />
                      ) : f.type === 'select' ? (
                        <Select
                          aria-label={f.label}
                          fullWidth
                          placeholder={f.placeholder ?? '请选择'}
                          isInvalid={!!errors[f.key]}
                          selectedKey={values[f.key] == null || values[f.key] === '' ? '' : String(values[f.key])}
                          onSelectionChange={(k) => set(f.key, k === null ? '' : String(k))}
                        >
                          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {opts.map(o => <ListBox.Item key={o.value} id={o.value} textValue={o.label}>{o.label}</ListBox.Item>)}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      ) : (
                        <Input
                          fullWidth
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={String(values[f.key] ?? '')}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          aria-invalid={errors[f.key] ? true : undefined}
                        />
                      )}
                      {errors[f.key] && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
                    </div>
                  );
                })}
                {result && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                    <p className="font-medium text-slate-700">
                      新增 {result.created} · 更新 {result.updated} · 跳过 {result.skipped}
                    </p>
                    {result.errors.length > 0 && (
                      <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-slate-500">
                        {result.errors.map((e, i) => <li key={i}>第 {e.row} 行：{e.message}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={busy}>取消</Button>
              <Button variant="primary" onPress={() => void submit()} isDisabled={!fileText || busy}>
                {busy ? '导入中…' : '开始导入'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
