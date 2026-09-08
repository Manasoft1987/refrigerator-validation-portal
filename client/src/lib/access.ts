type UserLike = { role?: string | null } | null | undefined;
type CompanyLike = { membership?: { role?: string | null } | null } | null | undefined;

export function isViewerOnlyCompanyUser(user: UserLike, companies: CompanyLike[] | undefined | null) {
  if (!user || user.role === "admin") return false;
  const memberships = (companies ?? []).map(company => company?.membership?.role).filter(Boolean);
  return memberships.length > 0 && memberships.every(role => role === "viewer");
}

export function canEditCompanyWorkspace(user: UserLike, companies: CompanyLike[] | undefined | null) {
  return !isViewerOnlyCompanyUser(user, companies);
}
