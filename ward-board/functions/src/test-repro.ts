import firebaseFunctionsTest from 'firebase-functions-test';

// Set up emulator environment - MUST be set BEFORE initializing admin
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const test = firebaseFunctionsTest({
    projectId: 'lean-841e5',
});

import { setUnitUserRole } from './callables/setUnitUserRole';

async function run() {
    try {
        console.log("=== REPRODUCTION START ===");
        const data = {
            unitId: 'Unidade A',
            email: 'e2e-add-user@lean.com',
            role: 'editor',
            reason: 'Testing 500 error reproduction',
            source: { appArea: 'admin' }
        };
        const context = {
            auth: {
                uid: 'admin-uid',
                token: {
                    email: 'admin@lean.com',
                    name: 'Admin User'
                }
            }
        };

        console.log("Invoking setUnitUserRole wrapped...");
        const wrapped = test.wrap(setUnitUserRole);
        const result = await wrapped(data, context as any);
        console.log("Result:", result);
    } catch (error: any) {
        console.error("Caught error in reproduction script:");
        console.error("Code:", error.code);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
    } finally {
        test.cleanup();
    }
}

run();
