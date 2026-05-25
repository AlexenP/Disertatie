const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
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
  property_type_name: string;
  latitude: number;
  longitude: number;
  surface_sqm: number;
  price: number;
  price_per_sqm: number;
  monthly_rent: number;
  status: string;
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
};
