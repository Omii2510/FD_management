export const roleHomePath = (role) => {
  if (role === 'admin') return '/admin-panel';
  if (role === 'bank') return '/bank-panel';
  if (role === 'user') return '/user-panel';
  return '/';
};
