export type GeoEstateUser = {
  email: string;
  full_name: string;
  role: string;
  role_name: string;
  token: string;
};

type GeoEstateRole = "admin" | "agent" | "manager" | "developer";

function getUserRole(user: GeoEstateUser | null): GeoEstateRole | null {
  const role = user?.role?.toLowerCase();

  if (role === "admin" || role === "agent" || role === "manager" || role === "developer") {
    return role;
  }

  return null;
}

function hasRole(user: GeoEstateUser | null, roles: GeoEstateRole[]) {
  const role = getUserRole(user);
  return role !== null && roles.includes(role);
}

export function getCurrentUser(): GeoEstateUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawUser = localStorage.getItem("geoestate_user");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    localStorage.removeItem("geoestate_user");
    return null;
  }
}

export function logoutUser() {
  localStorage.removeItem("geoestate_user");
}

export function canViewDashboard(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "manager", "developer"]);
}

export function canViewProperties(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "agent", "manager", "developer"]);
}

export function canCreateProperty(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "agent"]);
}

export function canEditProperty(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "agent"]);
}

export function canDeleteProperty(user: GeoEstateUser | null) {
  return hasRole(user, ["admin"]);
}

export function canViewMap(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "agent", "manager", "developer"]);
}

export function canAddPropertyFromMap(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "agent"]);
}

export function canViewAnalytics(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "manager", "developer"]);
}

export function canViewForecasts(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "manager", "developer"]);
}

export function canManageUsers(user: GeoEstateUser | null) {
  return hasRole(user, ["admin"]);
}

export function canExportReports(user: GeoEstateUser | null) {
  return hasRole(user, ["admin", "agent", "manager", "developer"]);
}
