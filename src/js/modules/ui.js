import { db } from "../config/firebaseConfig.js";
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
import { registerEmployee, editUserName } from "./userManagement.js";

import { calculateSalaries } from "./salary.js";

const ARRIVAL_TIME = "9:00 AM";
const DEPARTURE_TIME = "5:00 PM";

/**
 * Sets up the UI, including Firebase connection status, event listeners, and initial data fetch.
 */
export function setupUI() {
    console.log("UI module loaded");
    const connectionStatus = document.getElementById("connectionStatus");
    const errorMessageDiv = document.getElementById("errorMessage");

    try {
        connectionStatus.textContent = "Firebase: Initialized successfully";
        connectionStatus.className = "text-sm text-white";
        const connectedRef = ref(db, ".info/connected");
        onValue(connectedRef, (snapshot) => {
            const isConnected = snapshot.val();
            connectionStatus.textContent = `Firebase: Initialized | Realtime Database: ${isConnected ? "Connected" : "Disconnected"}`;
            connectionStatus.className = `text-sm ${isConnected ? "text-white" : "text-red-300"}`;
        });
    } catch (error) {
        showError(errorMessageDiv, `Firebase connection failed: ${error.message}`);
        connectionStatus.textContent = `Firebase connection failed: ${error.messaFge}`;
        connectionStatus.className = "text-sm text-red-300";
    }

    document.getElementById("registerButton").addEventListener("click", () => {
        const name = document.getElementById("regName").value.trim();
        const uid = document.getElementById("regUID").value.trim();

        registerEmployee(
            name,
            uid,
            (error) => showError(errorMessageDiv, error),
            () => {
                alert("Employee registered successfully!");
                document.getElementById("regName").value = "";
                document.getElementById("regUID").value = "";
                errorMessageDiv.classList.add("hidden");
            }
        );
    });

    document.getElementById("calculateSalariesButton").addEventListener("click", () => {
        calculateSalaries(
            (error) => showError(errorMessageDiv, error),
            () => alert("Salaries calculated and updated successfully!")
        );
    });

    const today = new Date().toISOString().split("T")[0];
    document.getElementById("datePicker").value = today;
    fetchUsersLogs(today);

    document.getElementById("datePicker").addEventListener("change", (event) => {
        fetchUsersLogs(event.target.value);
    });

    // Event delegation for unregistered scans actions
    document.getElementById("unregisteredScans").addEventListener("click", async (event) => {
        if (event.target.classList.contains("add-name-btn")) {
            const uid = event.target.dataset.uid;

            // Prompt for the employee's name
            const name = prompt(`Enter name for UID: ${uid}`);
            if (!name || name.trim() === "") {
                alert("Name cannot be empty. Please try again.");
                return;
            }

            // Prompt for the employee's role
            const role = prompt(`Enter role for ${name} (admin/employee):`).toLowerCase();
            if (role !== "admin" && role !== "employee") {
                alert("Invalid role. Please enter either 'admin' or 'employee'.");
                return;
            }

            try {
                // Save the user to the Users table in Firebase
                await set(ref(db, `Users/${uid}`), {
                    Name: `${name} (${uid})`,
                    UID: uid,
                    Role: role,
                });

                alert(`User ${name} (${role}) registered successfully!`);

                // Refresh the logs to remove the unregistered scan
                const selectedDate = document.getElementById("datePicker").value;
                fetchUsersLogs(selectedDate);
            } catch (error) {
                console.error("Error registering user:", error);
                alert("Failed to register user. Please try again.");
            }
        }
    });

    document.getElementById("rfidScanInput").addEventListener("change", async (event) => {
        const uid = event.target.value.trim();
        if (uid) {
            await handleRFIDScan(uid);
            const selectedDate = document.getElementById("datePicker").value;
            fetchUsersLogs(selectedDate); // Refresh the dashboard
        }
        event.target.value = ""; // Clear the input field
    });
}

function showError(errorDiv, message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove("hidden");
}

function parse12HourTime(timeString) {
    const [time, modifier] = timeString.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    return {
        hours: modifier === "PM" && hours !== 12 ? hours + 12 : hours,
        minutes,
    };
}

export function fetchUsersLogs(selectedDate) {
    const userList = document.getElementById("userList");
    const unregisteredScans = document.getElementById("unregisteredScans");
    const errorMessageDiv = document.getElementById("errorMessage");

    try {
        const usersRef = ref(db, "Users");
        const usersLogsRef = ref(db, "UsersLogs");
        const scansRef = ref(db, "rfid_scans");

        // Fetch registered logs
        onValue(usersLogsRef, (snapshot) => {
            userList.innerHTML = "";
            const usersLogsData = snapshot.val();

            if (!usersLogsData) {
                userList.innerHTML = `<tr><td colspan="8" class="px-6 py-4 text-gray-500 text-center">No user logs found for ${selectedDate}.</td></tr>`;
                return;
            }

            const filteredLogs = Object.entries(usersLogsData).filter(([key]) => key.endsWith(selectedDate));
            filteredLogs.forEach(([key, userData]) => {
                const name = userData.Name || "Unknown";
                const uid = userData.UID || "Unknown";
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td class="px-4 py-2">${name}</td>
                    <td class="px-4 py-2">${uid}</td>
                    <td class="px-4 py-2">${userData.Time_Arriv || "Not set"}</td>
                    <td class="px-4 py-2">${userData.Time_Dept || "Not set"}</td>
                    <td class="px-4 py-2">${userData.Status || "Not set"}</td>
                    <td class="px-4 py-2">${userData.Late || "No"}</td>
                    <td class="px-4 py-2">${userData.Hours || "0"}</td>
                    <td class="px-4 py-2">
                        <button class="bg-teal-500 text-white px-3 py-1 rounded hover:bg-teal-600 transition" data-action="details" data-uid="${uid}">View Details</button>
                    </td>
                `;
                userList.appendChild(row);
            });
        });

        // Fetch unregistered scans and check against Users
        onValue(scansRef, (snapshot) => {
            unregisteredScans.innerHTML = "";
            const scansData = snapshot.val();

            if (!scansData) {
                unregisteredScans.innerHTML = `<tr><td colspan="3" class="px-4 py-2 text-gray-500 text-center">No unregistered scans found for ${selectedDate}.</td></tr>`;
                return;
            }

            onValue(usersRef, (usersSnapshot) => {
                const usersData = usersSnapshot.val() || {};

                const filteredScans = Object.entries(scansData).filter(([_, scanData]) => {
                    const scanDate = new Date(scanData.timestamp).toISOString().split("T")[0];
                    return scanDate === selectedDate;
                });

                filteredScans.forEach(([_, scanData]) => {
                    const uid = scanData.uid;

                    if (usersData[uid]) {
                        // User exists in Users table, log attendance
                        const user = usersData[uid];
                        const logKey = `${uid}_${selectedDate}`;
                        const scanTime = new Date(scanData.timestamp);
                        const arrivalTime = new Date(scanTime);
                        const departureTime = new Date(scanTime);

                        // Set official arrival and departure times
                        const { hours: arrivalHours, minutes: arrivalMinutes } = parse12HourTime(ARRIVAL_TIME);
                        const { hours: departureHours, minutes: departureMinutes } = parse12HourTime(DEPARTURE_TIME);
                        arrivalTime.setHours(arrivalHours, arrivalMinutes, 0, 0);
                        departureTime.setHours(departureHours, departureMinutes, 0, 0);

                        onValue(ref(db, `UsersLogs/${logKey}`), (logSnapshot) => {
                            const existingLog = logSnapshot.val();

                            if (!existingLog) {
                                // First scan: Register arrival
                                set(ref(db, `UsersLogs/${logKey}`), {
                                    UID: uid,
                                    Name: user.Name,
                                    Status: "Present",
                                    Time_Arriv: scanData.timestamp,
                                    Time_Dept: null,
                                    Late: scanTime > arrivalTime ? "Yes" : "No",
                                    Hours: 0,
                                    Deduction: 0,
                                });
                            } else if (!existingLog.Time_Dept) {
                                // Second scan: Register departure
                                if (scanTime < departureTime) {
                                    const hoursWorked = ((scanTime - new Date(existingLog.Time_Arriv)) / (1000 * 60 * 60)).toFixed(2);
                                    set(ref(db, `UsersLogs/${logKey}`), {
                                        ...existingLog,
                                        Time_Dept: scanData.timestamp,
                                        Status: "Departed",
                                        Hours: hoursWorked,
                                        Deduction: ((departureTime - scanTime) / (1000 * 60 * 60)).toFixed(2),
                                    });
                                } else {
                                    alert("You cannot return after departure.");
                                }
                            }
                        }, { onlyOnce: true });

                        // Remove from unregistered scans
                        set(ref(db, `rfid_scans/${uid}`), null);
                    } else {
                        // User does not exist, add to unregistered scans table
                        const row = document.createElement("tr");
                        row.innerHTML = `
                            <td class="px-4 py-2">${uid}</td>
                            <td class="px-4 py-2">${new Date(scanData.timestamp).toLocaleString()}</td>
                            <td class="px-4 py-2">
                                <button class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition add-name-btn" data-uid="${uid}">Add Name</button>
                            </td>
                        `;
                        unregisteredScans.appendChild(row);
                    }
                });
            });
        });
    } catch (error) {
        showError(errorMessageDiv, `Error fetching logs: ${error.message}`);
    }
}