import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebaseConfig";

let app;
let auth;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization failed:", error);
  // Create a dummy auth object to prevent crashes
  auth = {} as any;
}

export { auth };
