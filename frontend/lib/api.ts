const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  const rawUser = localStorage.getItem("geoestate_user");

  if (!rawUser) {
    return {};
  }

  try {
    const user = JSON.parse(rawUser);

    if (user.token) {
      return {
        Authorization: `Bearer ${user.token}`,
      };
    }
  } catch {
    localStorage.removeItem("geoestate_user");
  }

  return {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export type PropertyItem = {
  id: number;
  code: string;
  title: string;
  address: string;
  sector_id: number;
  sector_name: string;
  property_type_id: number;
  property_type_name: string;
  latitude: number;
  longitude: number;
  surface_sqm: number;
  price: number;
  price_per_sqm: number;
  price_sqm: number;
  market_average_sqm: number | null;
  market_difference_percent: number | null;
  market_label: "sub_piata" | "la_piata" | "peste_piata";
  accessibility_score?: number | null;
  facilities_score?: number | null;
  location_score?: number | null;
  investment_score?: number | null;
  poi_metro_count?: number;
  poi_transport_count?: number;
  poi_education_count?: number;
  poi_health_count?: number;
  poi_pharmacy_count?: number;
  poi_green_count?: number;
  poi_commercial_count?: number;
  nearest_metro_m?: number | null;
  nearest_transport_m?: number | null;
  nearest_school_m?: number | null;
  nearest_health_m?: number | null;
  nearest_green_m?: number | null;
  nearest_commercial_m?: number | null;
  poi_last_updated_at?: string | null;
  monthly_rent: number;
  status: string;
  owner_admin_id?: number;
  interested_clients: number;
  views_count: number;
};

export type Dashboard = {
  total_properties: number;
  total_value: number;
  average_price_sqm: number;
  average_occupancy_rate: number;
  monthly_revenue: number;
  top_sector_by_price: string;
  top_sector_by_interest: string;
};

export type SectorAnalytics = {
  sector_id: number;
  sector_name: string;
  properties_count: number;
  average_price_sqm: number;
  total_value: number;
  monthly_revenue: number;
  occupancy_rate: number;
  interest_score: number;
  avg_location_score?: number | null;
  avg_investment_score?: number | null;
};
