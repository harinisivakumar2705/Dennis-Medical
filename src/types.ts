import { Timestamp } from 'firebase/firestore';

export enum PatientStatus {
  WAITING = 'waiting',
  IN_TRIAGE = 'in triage',
  IN_APPOINTMENT = 'in appointment',
  ADMISSION_PENDING = 'admission pending',
  UNDER_OBSERVATION = 'under observation',
  PENDING_DISCHARGE = 'pending discharge',
  DISCHARGED = 'discharged'
}

export interface RoleDefinition {
  name: string;
  canReadPatients: boolean;
  canWritePatients: boolean;
  canIntake: boolean;
  canManageUsers: boolean;
  canSchedule: boolean;
  isSystem: boolean;
}

export const ROLE_MAP: Record<string, RoleDefinition> = {
  admin: {
    name: 'admin',
    canReadPatients: true,
    canWritePatients: true,
    canIntake: true,
    canManageUsers: true,
    canSchedule: true,
    isSystem: true
  },
  clinician: {
    name: 'clinician',
    canReadPatients: true,
    canWritePatients: true,
    canIntake: true,
    canManageUsers: false,
    canSchedule: true,
    isSystem: true
  },
  doctor: {
    name: 'doctor',
    canReadPatients: true,
    canWritePatients: true,
    canIntake: true,
    canManageUsers: false,
    canSchedule: true,
    isSystem: true
  },
  staff: {
    name: 'staff',
    canReadPatients: true,
    canWritePatients: false,
    canIntake: true,
    canManageUsers: false,
    canSchedule: true,
    isSystem: true
  }
};

export const STATUS_OPTIONS = [
  { value: PatientStatus.WAITING, label: 'Waiting', color: 'bg-blue-100 text-blue-700' },
  { value: PatientStatus.IN_TRIAGE, label: 'In Triage', color: 'bg-amber-100 text-amber-700' },
  { value: PatientStatus.IN_APPOINTMENT, label: 'In Appointment', color: 'bg-emerald-100 text-emerald-700' },
  { value: PatientStatus.ADMISSION_PENDING, label: 'Admission Pending', color: 'bg-purple-100 text-purple-700' },
  { value: PatientStatus.UNDER_OBSERVATION, label: 'Under Observation', color: 'bg-indigo-100 text-indigo-700' },
  { value: PatientStatus.PENDING_DISCHARGE, label: 'Pending Discharge', color: 'bg-orange-100 text-orange-700' },
  { value: PatientStatus.DISCHARGED, label: 'Discharged', color: 'bg-slate-100 text-slate-600' },
];

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: string; // References RoleDefinition.name
  createdAt: Timestamp;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  startTime: Timestamp;
  type: string;
  status: 'scheduled' | 'checked_in' | 'cancelled' | 'completed';
}

export interface PatientChart {
  medicalHistory: string;
  medications: string;
  notes: string;
  allergies: string;
  previousVisitNotes: string;
  identifyingInfo: {
    address: string;
    phone: string;
    emergencyContact: string;
  };
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  nhi: string;
  sex: 'F' | 'M';
  status: PatientStatus;
  room?: string;
  lastUpdated: Timestamp;
  chart?: PatientChart;
}

export interface AuditLog {
  id: string;
  timestamp: Timestamp;
  userUid: string;
  userEmail: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'INVITE' | 'INVITE_ACCEPTED';
  resourceType: string;
  resourceId: string;
  details?: string;
}
