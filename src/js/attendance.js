import { db } from "../config/firebaseConfig.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

// Constants for official arrival and departure times
const ARRIVAL_TIME = "9:00 AM";
const DEPARTURE_TIME = "5:00 PM";

/**
 * Parses 12-hour time string (e.g., "9:00 AM") into hours and minutes.
 * @param {string} timeStr - Time string
 * @returns {Object} - Hours and minutes
 */
function parse12HourTime(timeStr) {
    const [time, period] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return { hours, minutes };
}

/**
 * Formats a timestamp into 12-hour time string (e.g., "2025-05-01 9:00 AM").
 * @param {number} timestamp - Timestamp
 * @returns {string} - Formatted time string
 */
function formatTo12Hour(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    const dateStr = date.toISOString().split("T")[0];
    return `${dateStr} ${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Checks if a scan is late compared to ARRIVAL_TIME.
 * @param {number} timestamp - Scan timestamp
 * @returns {boolean} - True if late
 */
function isLate(timestamp) {
    const scanTime = new Date(timestamp);
    const { hours, minutes } = parse12HourTime(ARRIVAL_TIME);
    const arrivalTimeToday = new Date(scanTime);
    arrivalTimeToday.setHours(hours, minutes, 0, 0);
    return scanTime > arrivalTimeToday;
}

/**
 * Calculates deduction hours for early departure.
 * @param {number} timestamp - Scan timestamp
 * @returns {string} - Deduction hours
 */
function calculateDeduction(timestamp) {
    const scanTime = new Date(timestamp);
    const { hours, minutes } = parse12HourTime(DEPARTURE_TIME);
    const departureTimeToday = new Date(scanTime);
    departureTimeToday.setHours(hours, minutes, 0, 0);
    if (scanTime < departureTimeToday) {
        return ((departureTimeToday - scanTime) / (1000 * 60 * 60)).toFixed(2);
    }
    return "0";
}

/**
 * Calculates working hours between arrival and departure.
 * @param {string} arrival - Arrival time
 * @param {string} departure - Departure time
 * @returns {string} - Working hours
 */
function calculateWorkingHours(arrival, departure) {
    if (!arrival || !departure || arrival === "Not set" || departure === "Not set") return "0";
    const arrivalTime = new Date(arrival);
    const departureTime = new Date(departure);
    if (departureTime <= arrivalTime) return "0";
    const hours = (departureTime - arrivalTime) / (1000 * 60 * 60);
    return hours.toFixed(2);
}

/**
 * Processes RFID scans for a user on a specific date.
 * @param {Object} scansData - Scans data
 * @param {string} uid - User UID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Object} - Arrival time, departure time, and name
 */
export function processScansForUser(scansData, uid, date) {
    let arrivalTime = null;
    let departureTime = null;
    let name = null;
    let hasArrival = false;

    if (scansData) {
        const scans = Object.entries(scansData)
            .filter(([_, scanData]) => scanData.uid === uid && new Date(scanData.timestamp).toISOString().split("T")[0] === date)
            .sort((a, b) => new Date(a[1].timestamp) - new Date(b[1].timestamp));

        scans.forEach(([_, scanData], index) => {
            const scanTime = new Date(scanData.timestamp);
            const { hours: depHours, minutes: depMinutes } = parse12HourTime(DEPARTURE_TIME);
            const departureTimeToday = new Date(scanTime);
            departureTimeToday.setHours(depHours, depMinutes, 0, 0);

            if (scanData.name) name = scanData.name;

            if (!hasArrival && (index === 0 || scanTime <= departureTimeToday)) {
                arrivalTime = scanData.timestamp;
                hasArrival = true;
            } else {
                departureTime = scanData.timestamp;
            }
        });
    }

    return { arrivalTime, departureTime, name };
}

/**
 * Updates UsersLogs node with processed scan data.
 * @param {Object} scansData - Scans data
 */
export async function updateUsersLogsNode(scansData) {
    if (!scansData) return;

    const usersLogsData = {};
    Object.entries(scansData).forEach(([_, scanData]) => {
        const scanTime = new Date(scanData.timestamp);
        const date = scanTime.toISOString().split("T")[0];
        const uid = scanData.uid;
        const key = `${uid}_${date}`;
        if (!usersLogsData[key]) {
            usersLogsData[key] = { uid, date };
        }
    });

    for (const [key, { uid, date }] of Object.entries(usersLogsData)) {
        const { arrivalTime, departureTime, name } = processScansForUser(scansData, uid, date);
        const status = arrivalTime || departureTime ? "Present" : "Absent";
        const late = arrivalTime && isLate(arrivalTime) ? "Yes" : "No";
        const deduction = departureTime ? calculateDeduction(departureTime) : "0";
        const hours = calculateWorkingHours(
            arrivalTime ? formatTo12Hour(arrivalTime) : null,
            departureTime ? formatTo12Hour(departureTime) : null
        );

        try {
            await set(ref(db, `UsersLogs/${key}`), {
                Name: name || `Unknown (${uid})`,
                UID: uid,
                Time_Arriv: arrivalTime ? formatTo12Hour(arrivalTime) : "Not set",
                Time_Dept: departureTime ? formatTo12Hour(departureTime) : "Not set",
                Status: status,
                Late: late,
                Deduction: deduction,
                Hours: hours
            });
        } catch (error) {
            console.error(`Error updating UsersLogs/${key}:`, error);
        }
    }
}

/**
 * Updates Users node with the latest employee names.
 * @param {Object} usersLogsData - UsersLogs data
 */
export async function updateUsersNode(usersLogsData) {
    if (!usersLogsData) return;

    const uniqueUsers = {};
    Object.entries(usersLogsData).forEach(([key, userData]) => {
        const uid = userData.UID;
        const date = key.split("_")[1];
        if (!uniqueUsers[uid] || new Date(date) > new Date(uniqueUsers[uid].date)) {
            uniqueUsers[uid] = { Name: userData.Name, UID: uid, date };
        }
    });

    for (const [uid, { Name }] of Object.entries(uniqueUsers)) {
        try {
            const userRef = ref(db, `Users/${uid}`);
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};
            await set(userRef, {
                Name,
                UID: uid,
                Role: userData.Role || "employee",
                HourlyRate: userData.HourlyRate || 0,
                TotalHours: userData.TotalHours || 0,
                Salary: userData.Salary || 0
            });
        } catch (error) {
            console.error(`Error updating Users/${uid}:`, error);
        }
    }
}