import type { CSSProperties } from 'react';
import { LaravelUser } from './laravelApi';

export const avatarPalette = [
  '#0f172a',
  '#ff6321',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#059669',
  '#d97706',
  '#475569',
];

type AvatarUser = Partial<Pick<LaravelUser, 'id' | 'name' | 'email' | 'avatar_color'>> | null | undefined;

export function userInitial(name?: string | null, fallback = 'U'): string {
  return (name?.trim().charAt(0) || fallback).toUpperCase();
}

export function avatarColorForUser(user: AvatarUser): string {
  if (user?.avatar_color && /^#[0-9A-Fa-f]{6}$/.test(user.avatar_color)) {
    return user.avatar_color;
  }

  const seed = `${user?.id ?? ''}${user?.name ?? ''}${user?.email ?? ''}`;
  const hash = Array.from(seed || 'user').reduce((total, char) => total + char.charCodeAt(0), 0);

  return avatarPalette[hash % avatarPalette.length];
}

export function avatarStyleForUser(user: AvatarUser): CSSProperties {
  return {
    backgroundColor: avatarColorForUser(user),
    color: '#ffffff',
  };
}
