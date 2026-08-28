'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Label, ListBox, Modal, Select, TextArea } from '@heroui/react';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';
export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: Array<string | { value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  initial?: string | number;
}

export interface Props {
  title: string;
  fields: FieldDef[];
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string | number | null>) => Promise<void> | void;
  initial?: Record<string, unknown>;
  size?: 'sm' | 'md';
}

const dateInputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-accent focus:outline-none';

const optsOf = (o?: Array<string | { value: string; label: string }>) =>
  (o ?? []).map(x => (typeof x === 'string' ? { value: x, label: x } : x));

export default function FormModal({ title, fields, open, onClose, onSubmit, initial, size = 'md' }: Props) {
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // fields/initial 用 ref 快照，避免引用变化清空正在编辑的值；只在 open false→true 时初始化
  const fieldsRef = useRef(fields);
  const initialRef = useRef(initial);
  const wasOpen = useRef(false);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);
  useEffect(() => { initialRef.current = initial; }, [initial]);
  useEffect(() => {
    if (open && !wasOpen.current) {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const v: Record<string, string | number> = {};
      for (const f of fieldsRef.current) {
        const raw = initialRef.current?.[f.key] ?? f.initial ?? null;
        const resolved = raw === null || raw === undefined ? (f.type === 'date' ? today : '') : String(raw);
        v[f.key] = resolved;
      }
      setValues(v);
      setErrors({});
      setBusy(false);
    }
    wasOpen.current = open;
  }, [open]);

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
    setBusy(true);
    try {
      const body: Record<string, string | number | null> = {};
      for (const f of fields) {
        const val = values[f.key];
        body[f.key] = f.type === 'number' ? (String(val ?? '').trim() === '' ? null : Number(val)) : String(val ?? '');
      }
      await onSubmit(body);
      onClose();
    } catch { /* 调用方自行处理错误 */ } finally { setBusy(false); }
  };

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal.Backdrop isDismissable>
        <Modal.Container placement="center" size={size}>
          <Modal.Dialog>
            <Modal.Header><Modal.Heading>{title}</Modal.Heading></Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
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
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose} isDisabled={busy}>取消</Button>
              <Button variant="primary" onPress={() => void submit()} isDisabled={busy}>{busy ? '保存中…' : '保存'}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
