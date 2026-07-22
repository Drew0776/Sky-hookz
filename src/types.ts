export type BundleStatus = 'RAW' | 'STAGED' | 'BENDING' | 'LOADED' | 'RACKED' | 'COATED' | 'REJECTED';
export type RebarGrade = 'Black' | 'Epoxy';
export type TrailerSize = 'Flatbed' | 'Step Deck';
export type UserRole = 'CRANE_OPERATOR' | 'SHEAR_OPERATOR' | 'BENDER' | 'ADMIN';
export type PlantLocation = 'St. Paul, MN' | 'Marion, OH' | 'Sedalia, MO';
export type ASTMSpecification = 'ASTM_A775' | 'ASTM_A934';

export interface Bundle {
  id: string;
  tagId: string;
  jobId: string;
  mark: string;
  grade: RebarGrade;
  barSize: string; // e.g., "#3"-"#11"
  length: number; // in feet
  weight: number; // in lbs
  isEpoxy: boolean;
  route: string;
  status: BundleStatus;
  location: string; // Station/Rack name
  door?: string; // Door assignment
  trailerSize?: TrailerSize;
  stagedAt?: string;
  updatedAt: string;
  plantLocation: PlantLocation;
  heatNumber: string;
  millCertUrl: string;
  specification: ASTMSpecification;
  shippingDate: string;
}

export interface Job {
  id: string;
  customerName: string;
  projectName: string;
  orderNumber: string;
  totalBundles: number;
  completedBundles: number;
  createdAt: string;
  plantLocation: PlantLocation;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  tagId: string;
  operatorName: string;
  action: string; // e.g., STAGED, PICKUP, DROP, BENT, LOADED, RACKED
  fromLocation: string;
  toLocation: string;
  details?: string;
}

export interface Exception {
  id: string;
  timestamp: string;
  tagId: string;
  operatorName: string;
  type: string; // e.g., "Misplaced Bar", "Fabrication Error", "Coating Issue", "Quality Audit"
  description: string;
  status: 'OPEN' | 'RESOLVED';
  resolvedAt?: string;
  resolvedBy?: string;
  qualityAudit?: {
    coatingDamagePct: number;
    damagedFootSection: string;
    inspectorName: string;
    inspectionDate: string;
  };
}

export interface Operator {
  id: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  currentStation?: string;
}

export interface ShiftMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  shift: 'First Shift' | 'Second Shift';
}

export interface DashboardMetrics {
  bendingCount: number;
  totalActiveJobs: number;
  stagedCount: number;
  loadedCount: number;
  rackedCount: number;
  rejectedCount?: number;
  uvHazardsCount?: number;
  firstShiftThroughput: number; // tons/hours processed
  secondShiftThroughput: number;
}

export interface Obstruction {
  zoneId: string;
  name: string;
  type: 'CRITICAL' | 'CONSTRAINT' | 'PROXIMITY';
  reason: string;
  desc: string;
}
