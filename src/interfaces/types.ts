export type Null<T> = T | null;

export type AuthStatus = 'pending' | 'blocked' | 'verified' | 'signed-in' | 'signed-out';

export type AuthType = 'email' | 'verify' | 'guest' | 'guest-verify';

export type LobbyStatus = 'idle' | 'matchmaking' | 'playing';
