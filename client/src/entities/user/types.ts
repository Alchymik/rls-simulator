// entities/user/types.ts
export type Role = 'admin' | 'operator';
export interface User { id: string; login: string; role: Role; displayName: string; }