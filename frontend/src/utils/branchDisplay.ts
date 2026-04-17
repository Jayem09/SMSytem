import type { User } from '../context/AuthContextObject';

export function getBranchDisplayName(user: User | null): string {
  if (user?.branch?.name) {
    return user.branch.name;
  }

  if (user?.branch_id) {
    return `Branch #${user.branch_id}`;
  }

  return '';
}
