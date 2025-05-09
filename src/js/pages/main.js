import { restrictToAdmin, setupLogout } from "../modules/auth.js";
import { setupUI } from "../modules/ui.js";

/**
 * Main entry point for the application.
 * Initializes authentication, logout, and UI setup.
 */
console.log("Main module loaded");
restrictToAdmin();
setupLogout();
setupUI();