
export enum ThreatLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum AttackType {
  NORMAL = 'Normal',
  DOS = 'DoS',
  PROBE = 'Probe',
  U2R = 'U2R', // User to Root
  R2L = 'R2L', // Remote to Local
  DDOS = 'DDoS'
}

export interface Packet {
  id: string;
  timestamp: string;
  sourceIP: string;
  destIP: string;
  protocol: string;
  length: number;
  flag: string;
  threatLevel: ThreatLevel;
  attackType: AttackType;
  confidence: number;
  features: Record<string, number>;
}

export interface Alert {
  id: string;
  packetId: string;
  type: AttackType;
  level: ThreatLevel;
  timestamp: string;
  message: string;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  REALTIME = 'REALTIME',
  REPORTS = 'REPORTS'
}

export interface TrainingMetric {
  epoch: number;
  accuracy: number;
  loss: number;
  val_accuracy: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}
