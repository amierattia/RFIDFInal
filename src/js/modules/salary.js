import { db } from "../config/firebaseConfig.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

/**
 * Calculates and updates salaries for all employees.
 * @param {function} errorCallback - Callback for error handling
 * @param {function} successCallback - Callback for successful calculation
 */
export async function calculateSalaries(errorCallback, successCallback) {
    try {
        const usersLogsRef = ref(db, "UsersLogs");
        const usersRef = ref(db, "Users");
        const usersLogsSnapshot = await get(usersLogsRef);
        const usersSnapshot = await get(usersRef);
        const usersLogsData = usersLogsSnapshot.val() || {};
        const usersData = usersSnapshot.val() || {};

        for (const [uid, userData] of Object.entries(usersData)) {
            if (userData.Role === "employee") {
                const totalHours = Object.entries(usersLogsData)
                    .filter(([key]) => key.startsWith(uid))
                    .reduce((sum, [_, log]) => sum + parseFloat(log.Hours || 0), 0);
                    
                const hourlyRate = parseFloat(userData.HourlyRate) || 10;

                const salary = (totalHours * hourlyRate).toFixed(2);

                await set(ref(db, `Users/${uid}`), {
                    ...userData,
                    TotalHours: totalHours.toFixed(2),
                    Salary: salary
                });
            }
        }
        successCallback();
    } catch (error) {
        errorCallback(`Salary calculation failed: ${error.message}`);
    }
}