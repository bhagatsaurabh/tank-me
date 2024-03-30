export interface Profile {
  id?: string;
  username?: string | null;
  email?: string | null;
  stats?: { matches: number; wins: number; points: number };
  // To make Firestore types happy...
  [path: `${string}.${string}`]: any;
}

export interface BroadcastMessage {
  type: 'auth';
  value: any;
}
