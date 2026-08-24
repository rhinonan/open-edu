'use client';
import { Toast, toastQueue } from '@heroui/react';

export default function ToastProvider() {
  return <Toast.Provider queue={toastQueue} placement="top" />;
}
