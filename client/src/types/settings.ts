export interface CompanySettings {
  id: number;
  officeLatitude: number | null;
  officeLongitude: number | null;
  officeRadiusMeters: number;
  morningWindowStart: string;
  morningWindowEnd: string;
  afternoonWindowStart: string;
  afternoonWindowEnd: string;
  updatedAt: string;
}
