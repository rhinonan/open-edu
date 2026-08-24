'use client';
import { toast as heroToast } from '@heroui/react';

export const toast = {
  success: (msg: string) => heroToast.success(msg),
  warning: (msg: string) => heroToast.warning(msg),
  error: (msg: string) => heroToast.danger(msg),
  info: (msg: string) => heroToast.info(msg),
};
