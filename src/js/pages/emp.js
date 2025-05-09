import { db } from "../config/firebaseConfig.js";
import { ref, onValue, get } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";

/**
 * Displays an error message in the UI.
 * @param {string} message - Error message to display
 */
function showError(message) {
  const errorMessageDiv = document.getElementById("errorMessage");
  if (errorMessageDiv) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove("hidden");
  }
}

/**
 * Monitors Firebase Realtime Database connection status.
 */
function monitorFirebaseConnection() {
  const connectionStatus = document.getElementById("connectionStatus");
  if (!connectionStatus) return;

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

    if (userData) {
      document.getElementById("userName").textContent = userData.Name || "Unknown";
      document.getElementById("userUID").textContent = userData.UID || employeeUID;
      document.getElementById("userRole").textContent = userData.Role || "Unknown";
      document.getElementById("hourlyRate").textContent = userData.HourlyRate || "0";
      document.getElementById("salaryTotalHours").textContent = userData.TotalHours || "0";
      document.getElementById("salary").textContent = userData.Salary || "0";
      showError(""); // Clear any existing errors
    } else {
      showError("Employee data not found in Users node.");
    }
  } catch (error) {
    showError(`Error loading personal info: ${error.message}`);
  }
}

/**
 * Calculates late hours based on arrival time.
 * @param {string} arrival - Arrival time string
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
    return 0;
  }
}

/**
 * Fetches and displays employee attendance data for a date range.
 * @param {string} employeeUID - Employee UID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 */
function fetchEmployeeData(employeeUID, startDate, endDate) {
  const elements = {
    attendancePercent: document.getElementById("attendancePercent"),
    absencePercent: document.getElementById("absencePercent"),
    totalHours: document.getElementById("totalHours"),
    lateArrivals: document.getElementById("lateArrivals"),
    totalLateHours: document.getElementById("totalLateHours"),
    lateHoursPercent: document.getElementById("lateHoursPercent")
  };

  if (Object.values(elements).some(el => !el)) return;

  try {
    const usersLogsRef = ref(db, "UsersLogs");
    onValue(usersLogsRef, (snapshot) => {
      const usersLogsData = snapshot.val();

      if (!usersLogsData) {
        Object.assign(elements, {
          attendancePercent: "0%",
          absencePercent: "0%",
          totalHours: "0",
          lateArrivals: "0",
          totalLateHours: "0",
          lateHoursPercent: "0%"
        });
        showError("No attendance logs found.");
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const filteredLogs = Object.entries(usersLogsData).filter(([key]) => {
        const logDate = key.split("_")[1];
        const logDateObj = new Date(logDate);
        return key.startsWith(employeeUID) && logDateObj >= start && logDateObj <= end;
      });

      let presentDays = 0;
      let totalHours = 0;
      let lateArrivals = 0;
      let lateHours = 0;

      filteredLogs.forEach(([_, userData]) => {
        if (userData.Status === "Present") presentDays++;
        if (userData.Late === "Yes") lateArrivals++;
        totalHours += parseFloat(userData.Hours || 0);
        lateHours += calculateLateHours(userData.Time_Arriv);
      });

      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const attendancePercent = totalDays > 0 ? (presentDays / totalDays * 100).toFixed(1) : 0;
      const absencePercent = (100 - attendancePercent).toFixed(1);
      const lateHoursPercent = totalHours > 0 ? (lateHours / totalHours * 100).toFixed(1) : 0;

      elements.attendancePercent.textContent = `${attendancePercent}%`;
      elements.absencePercent.textContent = `${absencePercent}%`;
      elements.totalHours.textContent = totalHours.toFixed(2);
      elements.lateArrivals.textContent = lateArrivals;
      elements.totalLateHours.textContent = lateHours.toFixed(2);
      elements.lateHoursPercent.textContent = `${lateHoursPercent}%`;

      showError(""); // Clear any existing errors
    }, (error) => {
      showError(`Error fetching logs: ${error.message}`);
    });
  } catch (error) {
    showError(`Error setting up data listeners: ${error.message}`);
  }
}

/**
 * Sets up date range input listeners.
 * @param {string} employeeUID - Employee UID
 */
function setupDateRangeListeners(employeeUID) {
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  if (!startDateInput || !endDateInput) return;

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
 * Initializes the employee page.
 */
function init() {
  const userRole = localStorage.getItem("userRole");
  const employeeUID = localStorage.getItem("userUID");

  if (!userRole || !employeeUID) {
    window.location.href = "login.html";
    return;
  }

  if (userRole !== "employee") {
    showError("Access restricted to employees.");
    return;
  }

  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem("userUID");
      localStorage.removeItem("userRole");
      window.location.href = "login.html";
    });
  }

  monitorFirebaseConnection();
  loadPersonalInfo(employeeUID);
  setupDateRangeListeners(employeeUID);
}

init();