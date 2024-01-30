export interface Profile {
  id?: string;
  username?: string | null;
  email?: string | null;
  // To make Firestore types happy...
  [path: `${string}.${string}`]: any;
}

export interface BroadcastMessage {
  type: 'auth';
  value: any;
}
