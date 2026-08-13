import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const emuEnabled =
  typeof import.meta.env.VITE_EMULATION_ENABLED !== "undefined" &&
  JSON.parse(import.meta.env.VITE_EMULATION_ENABLED) === true;

export const app = initializeApp(JSON.parse(import.meta.env.VITE_TANKME_PUBLIC_KEY));
export const auth = getAuth(app);
export const remoteDB = getFirestore(app);

console.log("Project Id", app.options.projectId);

if (emuEnabled) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(remoteDB, "127.0.0.1", 8080);
}
