export type GeoEstateUser = {
  email: string;
  full_name: string;
  role: string;
  role_name: string;
  token: string;
};

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