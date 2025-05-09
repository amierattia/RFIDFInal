import { db } from "../config/firebaseConfig.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

/**
 * Registers a new employee in the Firebase database.
 * @param {string} name - Employee name
 * @param {string} uid - Employee UID
 * @param {function} errorCallback - Callback for error handling
 * @param {function} successCallback - Callback for successful registration
 */
export async function registerEmployee(name, uid, errorCallback, successCallback) {
    if (!name || !uid) {
        errorCallback("Please enter both name and UID.");
        return;
    }

    try {
        const userRef = ref(db, `Users/${uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            errorCallback("UID already registered.");
            return;
        }

        const combinedName = `${name} (${uid})`;
        await set(userRef, {
            Name: combinedName,
            UID: uid,
            Role: "employee",
            HourlyRate: 0,
            TotalHours: 0,
            Salary: 0
        });

        successCallback();
    } catch (error) {
        errorCallback(`Registration failed: ${error.message}`);
    }
}

/**
 * Edits an employee's name across Users, UsersLogs, and rfid_scans.
 * @param {string} key - UsersLogs key (uid_date)
 * @param {string} currentName - Current employee name
 * @param {string} uid - Employee UID
 * @param {function} errorCallback - Callback for error handling
 * @param {function} successCallback - Callback for successful update
 */
export async function editUserName(key, currentName, uid, errorCallback, successCallback) {
    const nameWithoutUid = currentName.replace(/\s*\([^)]+\)$/, "");
    const newName = prompt("Enter new name:", nameWithoutUid);

    if (newName && newName.trim()) {
        try {
            const combinedName = `${newName.trim()} (${uid})`;

            // Update UsersLogs
            const userLogRef = ref(db, `UsersLogs/${key}`);
            const userLogSnapshot = await get(userLogRef);
            await set(userLogRef, { ...userLogSnapshot.val(), Name: combinedName });

            // Update Users
            const userRef = ref(db, `Users/${uid}`);
            const userSnapshot = await get(userRef);
            await set(userRef, { ...userSnapshot.val(), Name: combinedName });

            // Update rfid_scans
            const scansRef = ref(db, "rfid_scans");
            const scansSnapshot = await get(scansRef);
            const scansData = scansSnapshot.val() || {};
            for (const [scanId, scanData] of Object.entries(scansData)) {
                if (scanData.uid === uid && new Date(scanData.timestamp).toISOString().split("T")[0] === key.split("_")[1]) {
                    await set(ref(db, `rfid_scans/${scanId}`), { ...scanData, name: combinedName });
                }
            }

            successCallback();
        } catch (error) {
            errorCallback(`Failed to update name: ${error.message}`);
        }
    }
}