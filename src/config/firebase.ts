import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

export const app = initializeApp(JSON.parse(import.meta.env.VITE_TANKME_PUBLIC_KEY));
export const auth = getAuth(app);
export const remoteDB = getFirestore(app);

if (
  typeof import.meta.env.VITE_EMULATION_ENABLED !== 'undefined' &&
  JSON.parse(import.meta.env.VITE_EMULATION_ENABLED) === true
) {
  const host = '127.0.0.1'; /* '192.168.108.186' */
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(remoteDB, host, 8080);
}
