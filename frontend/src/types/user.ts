export type UserRole = 'admin' | 'purchasing' | 'purchaser' | 'cashier' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId?: string;
  createdAt?: string;
  updatedAt?: string;
}