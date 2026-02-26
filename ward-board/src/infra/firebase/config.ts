import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

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

// Connect to emulators if running locally
if (window.location.hostname === 'localhost') {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
}
