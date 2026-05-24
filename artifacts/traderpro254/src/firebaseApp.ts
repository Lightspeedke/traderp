import { initializeApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { firebaseConfig } from "./firebaseConfig";
import type { FirebaseApp } from "firebase/app";

let app: FirebaseApp;
let auth: Auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization failed:", error);
  // Create a dummy auth object to prevent crashes
  auth = {} as Auth;
}

export { auth };
