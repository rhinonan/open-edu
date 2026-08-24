'use client';
import { AlertDialog, Button } from '@heroui/react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function Confirm({ open, onOpenChange, title, message, confirmText = '确定', cancelText = '取消', danger, onConfirm }: Props) {
  return (
    <AlertDialog isOpen={open} onOpenChange={onOpenChange}>
      <AlertDialog.Backdrop isDismissable />
      <AlertDialog.Container placement="center" size="sm">
        <AlertDialog.Icon status={danger ? 'danger' : 'default'} />
        <AlertDialog.Heading>{title}</AlertDialog.Heading>
        <AlertDialog.Body>{message}</AlertDialog.Body>
        <AlertDialog.Footer>
          <Button variant="ghost" onPress={() => onOpenChange(false)}>{cancelText}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onPress={() => void onConfirm()}>{confirmText}</Button>
        </AlertDialog.Footer>
      </AlertDialog.Container>
    </AlertDialog>
  );
}
