import * as admin from 'firebase-admin';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
admin.initializeApp({ projectId: 'lean-841e5' });

import { getAdminFlowMetricsBQ } from './src/callables/analytics/getAdminFlowMetricsBQ';

async function test() {
    try {
        const req = {
            unitId: 'testUnit',
            periodKey: '7d'
        };
        const context = {
            auth: { uid: 'testUser' }
        };
        
        await getAdminFlowMetricsBQ.run(req, context);
        console.log("Success");
    } catch (e) {
        console.error("Error executing:", e);
    }
}
test();
