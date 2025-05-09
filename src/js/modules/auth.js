/**
 * Restricts access to admin users only.
 * Redirects to login page if user is not an admin.
 */
export function restrictToAdmin() {
    const userRole = localStorage.getItem("userRole");
    const userUID = localStorage.getItem("userUID");
    if (!userRole || !userUID || userRole !== "admin") {
        window.location.href = "login.html";
    }
}

/**
 * Sets up the logout button event listener.
 * Clears user data from localStorage and redirects to login page.
 */
export function setupLogout() {
    document.getElementById("logoutButton").addEventListener("click", () => {
        localStorage.removeItem("userUID");
        localStorage.removeItem("userRole");
        window.location.href = "login.html";
    });
}