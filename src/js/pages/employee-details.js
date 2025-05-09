import { db } from "../config/firebaseConfig.js";
import { ref, onValue, get, set } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
// DOM elements
const connectionStatus = document.getElementById("connectionStatus");
const errorMessageDiv = document.getElementById("errorMessage");
let chartInstance = null;

/**
 * Displays an error message in the UI.
 * @param {string} message - Error message
 */
function showError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove("hidden");
}

/**
 * Restricts access to authenticated users and retrieves employee UID.
 * @returns {string|null} - Employee UID or null if invalid
 */
function restrictAccess() {
    const userRole = localStorage.getItem("userRole");
    const userUID = localStorage.getItem("userUID");
    if (!userRole || !userUID) {
        window.location.href = "login.html";
        return null;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const employeeUID = urlParams.get("uid");
    if (!employeeUID) {
        showError("No employee UID provided.");
        return null;
    }

    return employeeUID;
}

/**
 * Sets up navigation buttons (back and logout).
 * @param {string} userRole - User role (admin or employee)
 */
function setupNavigation(userRole) {
    document.getElementById("logoutButton").addEventListener("click", () => {
        localStorage.removeItem("userUID");
        localStorage.removeItem("userRole");
        window.location.href = "login.html";
    });

    document.getElementById("backButton").addEventListener("click", () => {
        window.location.href = userRole === "admin" ? "index.html" : "employee.html";
    });
}

/**
 * Sets up salary save and cancel actions for admins.
 * @param {string} employeeUID - Employee UID
 */
function setupSalaryActions(employeeUID) {
    const userRole = localStorage.getItem("userRole");
    const hourlyRateInput = document.getElementById("hourlyRate");
    const salaryActions = document.getElementById("salaryActions");

    if (userRole === "admin") {
        hourlyRateInput.disabled = false;
        salaryActions.classList.remove("hidden");
    }

    document.getElementById("saveSalaryButton").addEventListener("click", async () => {
        const hourlyRate = parseFloat(hourlyRateInput.value);
        if (isNaN(hourlyRate) || hourlyRate < 0) {
            showError("Please enter a valid hourly rate.");
            return;
        }

        try {
            const userRef = ref(db, `Users/${employeeUID}`);
            const snapshot = await get(userRef);
            const userData = snapshot.val();
            if (!userData) {
                showError("Employee data not found.");
                return;
            }
            const totalHours = parseFloat(userData.TotalHours) || 0;
            const salary = (totalHours * hourlyRate).toFixed(2);

            await set(userRef, {
                ...userData,
                HourlyRate: hourlyRate.toFixed(2),
                Salary: salary
            });

            document.getElementById("salary").textContent = salary;
            hourlyRateInput.disabled = true;
            salaryActions.classList.add("hidden");
            errorMessageDiv.classList.add("hidden");
            alert("Salary updated successfully!");
        } catch (error) {
            console.error("Error saving salary:", error);
            showError(`Error saving salary: ${error.message}`);
        }
    });

    document.getElementById("cancelSalaryButton").addEventListener("click", async () => {
        try {
            const userRef = ref(db, `Users/${employeeUID}`);
            const snapshot = await get(userRef);
            const userData = snapshot.val();
            hourlyRateInput.value = userData?.HourlyRate || "";
            hourlyRateInput.disabled = true;
            salaryActions.classList.add("hidden");
            errorMessageDiv.classList.add("hidden");
        } catch (error) {
            console.error("Error canceling salary edit:", error);
            showError(`Error canceling: ${error.message}`);
        }
    });
}

/**
 * Monitors Firebase Realtime Database connection status.
 */
function monitorFirebaseConnection() {
    try {
        connectionStatus.textContent = "Firebase: Initialized successfully";
        connectionStatus.className = "text-sm text-white";
        const connectedRef = ref(db, ".info/connected");
        onValue(connectedRef, (snapshot) => {
            const isConnected = snapshot.val();
            console.log("Realtime Database connection:", isConnected ? "Connected" : "Disconnected");
            connectionStatus.textContent = `Firebase: Initialized | Realtime Database: ${isConnected ? "Connected" : "Disconnected"}`;
            connectionStatus.className = `text-sm ${isConnected ? "text-white" : "text-red-300"}`;
        });
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showError(`Firebase initialization failed: ${error.message}`);
        connectionStatus.textContent = `Firebase connection failed: ${error.message}`;
        connectionStatus.className = "text-sm text-red-300";
    }
}

/**
 * Loads personal information for the employee.
 * @param {string} employeeUID - Employee UID
 */
async function loadPersonalInfo(employeeUID) {
    try {
        const userRef = ref(db, `Users/${employeeUID}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        console.log("Personal info data:", userData);
        if (userData) {
            document.getElementById("userName").textContent = userData.Name || "Unknown";
            document.getElementById("userUID").textContent = userData.UID || employeeUID;
            document.getElementById("userRole").textContent = userData.Role || "Unknown";
            document.getElementById("hourlyRate").value = userData.HourlyRate || "";
            document.getElementById("salaryTotalHours").textContent = userData.TotalHours || "0";
            document.getElementById("salary").textContent = userData.Salary || "0";
            errorMessageDiv.classList.add("hidden");
        } else {
            showError("Employee data not found in Users node.");
        }
    } catch (error) {
        console.error("Error loading personal info:", error);
        showError(`Error loading personal info: ${error.message}`);
    }
}

/**
 * Calculates late hours based on arrival time.
 * @param {string} arrival - Arrival time
 * @returns {number} - Late hours
 */
function calculateLateHours(arrival) {
    if (!arrival || arrival === "Not set") return 0;
    try {
        const arrivalTime = new Date(arrival);
        const standardArrival = new Date(arrivalTime);
        standardArrival.setHours(9, 0, 0, 0);
        if (arrivalTime > standardArrival) {
            return (arrivalTime - standardArrival) / (1000 * 60 * 60);
        }
        return 0;
    } catch (error) {
        console.error("Error calculating late hours:", error);
        return 0;
    }
}

/**
 * Initializes a pie chart for attendance and absence percentages.
 * @param {number} attendancePercent - Attendance percentage
 * @param {number} absencePercent - Absence percentage
 */
function initializeChart(attendancePercent, absencePercent) {
    const ctx = document.getElementById("attendanceChart").getContext("2d");
    if (chartInstance) {
        chartInstance.destroy();
    }
    chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["Attendance", "Absence"],
            datasets: [{
                data: [attendancePercent, absencePercent],
                backgroundColor: ["#2563eb", "#6b7280"],
                borderColor: ["#1e40af", "#4b5563"],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed}%`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Fetches and displays employee attendance data for a date range.
 * @param {string} employeeUID - Employee UID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 */
function fetchEmployeeData(employeeUID, startDate, endDate) {
    const attendancePercentEl = document.getElementById("attendancePercent");
    const absencePercentEl = document.getElementById("absencePercent");
    const totalHoursEl = document.getElementById("totalHours");
    const lateArrivalsEl = document.getElementById("lateArrivals");
    const totalLateHoursEl = document.getElementById("totalLateHours");
    const lateHoursPercentEl = document.getElementById("lateHoursPercent");

    try {
        const usersLogsRef = ref(db, "UsersLogs");
        onValue(usersLogsRef, (snapshot) => {
            const usersLogsData = snapshot.val();
            console.log("UsersLogs data:", usersLogsData);

            if (!usersLogsData) {
                attendancePercentEl.textContent = "0%";
                absencePercentEl.textContent = "0%";
                totalHoursEl.textContent = "0";
                lateArrivalsEl.textContent = "0";
                totalLateHoursEl.textContent = "0";
                lateHoursPercentEl.textContent = "0%";
                initializeChart(0, 0);
                showError("No attendance logs found.");
                return;
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            const filteredLogs = Object.entries(usersLogsData).filter(([key, _]) => {
                const logDate = key.split("_")[1];
                const logDateObj = new Date(logDate);
                return key.startsWith(employeeUID) && logDateObj >= start && logDateObj <= end;
            });
            console.log("Filtered logs:", filteredLogs);

            let presentDays = 0;
            let totalHours = 0;
            let lateArrivals = 0;
            let lateHours = 0;

            filteredLogs.forEach(([key, userData]) => {
                console.log(`Processing log: ${key}`, userData);
                if (userData.Status === "Present") presentDays++;
                if (userData.Late === "Yes") lateArrivals++;
                totalHours += parseFloat(userData.Hours || 0);
                lateHours += calculateLateHours(userData.Time_Arriv);
            });

            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const attendancePercent = totalDays > 0 ? (presentDays / totalDays * 100).toFixed(1) : 0;
            const absencePercent = (100 - attendancePercent).toFixed(1);
            const lateHoursPercent = totalHours > 0 ? (lateHours / totalHours * 100).toFixed(1) : 0;

            attendancePercentEl.textContent = `${attendancePercent}%`;
            absencePercentEl.textContent = `${absencePercent}%`;
            totalHoursEl.textContent = totalHours.toFixed(2);
            lateArrivalsEl.textContent = lateArrivals;
            totalLateHoursEl.textContent = lateHours.toFixed(2);
            lateHoursPercentEl.textContent = `${lateHoursPercent}%`;

            initializeChart(parseFloat(attendancePercent), parseFloat(absencePercent));
            errorMessageDiv.classList.add("hidden");
        }, (error) => {
            console.error("Error fetching UsersLogs:", error);
            showError(`Error fetching logs: ${error.message}`);
            initializeChart(0, 0);
        });
    } catch (error) {
        console.error("Error setting up UsersLogs listener:", error);
        showError(`Error setting up data listeners: ${error.message}`);
        initializeChart(0, 0);
    }
}

/**
 * Sets up date range input listeners.
 * @param {string} employeeUID - Employee UID
 */
function setupDateRangeListeners(employeeUID) {
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    startDateInput.value = startDate.toISOString().split("T")[0];
    endDateInput.value = endDate.toISOString().split("T")[0];

    startDateInput.addEventListener("change", (event) => {
        const start = event.target.value;
        const end = endDateInput.value;
        if (start && end) fetchEmployeeData(employeeUID, start, end);
    });

    endDateInput.addEventListener("change", (event) => {
        const end = event.target.value;
        const start = startDateInput.value;
        if (start && end) fetchEmployeeData(employeeUID, start, end);
    });

    fetchEmployeeData(employeeUID, startDate.toISOString().split("T")[0], endDate.toISOString().split("T")[0]);
}

/**
 * Initializes the employee details page.
 */
function init() {
    console.log("Employee details module loaded");
    const employeeUID = restrictAccess();
    if (!employeeUID) return;

    const userRole = localStorage.getItem("userRole");
    setupNavigation(userRole);
    setupSalaryActions(employeeUID);
    monitorFirebaseConnection();
    loadPersonalInfo(employeeUID);
    setupDateRangeListeners(employeeUID);
}

init();