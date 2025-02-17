import { updateCodechefParticipation } from "./controllers/codechefController.js";
import { updateCodeforcesParticipation } from "./controllers/codeforcesController";
import { removeFirstContest } from "./controllers/leetcodeController.js";

async function updateAllPlatforms() {
  console.log("Process started !!");
  // Update Codeforces
  try {
    const codeforcesResults = await updateCodeforcesParticipation();
    console.log("Codeforces Response:", {
      message: "Codeforces participation update completed",
      results: codeforcesResults
    });
  } catch (error) {
    console.error("Codeforces Error:", error);
  }

  console.log("All updates completed !!");
}

updateAllPlatforms()
  .catch((error) => console.error("Fatal Error:", error));