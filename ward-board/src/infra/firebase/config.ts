import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyCUalOgay8sBO_SOuinbrkmEhtuPjw04Ws",
    authDomain: "lean-841e5.firebaseapp.com",
    projectId: "lean-841e5",
    storageBucket: "lean-841e5.firebasestorage.app",
    messagingSenderId: "94538925557",
    appId: "1:94538925557:web:85bca17614e80c36774cbc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
// southamerica-east1: All functions now use this region
export const functions = getFunctions(app, 'southamerica-east1');

// Connect to emulators if running locally
if (import.meta.env.DEV) {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFunctionsEmulator(functions, 'localhost', 5001);
    // E2E test helper — signs in with a custom token without going through OAuth redirect
    (window as unknown as Record<string, unknown>)['__testSignIn'] =
        async (token: string) => {
            const { signInWithCustomToken } = await import('firebase/auth');
            return signInWithCustomToken(auth, token);
        };
}

