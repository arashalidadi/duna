// The external portal role has portal:access, but not the staff dashboard grant.
// Staff who also have portal access still start on their normal dashboard.
export function postLoginRoute(permissions: readonly string[]): '/portal' | '/dashboard' {
  return permissions.includes('portal:access') && !permissions.includes('dashboard:read')
    ? '/portal'
    : '/dashboard';
}
