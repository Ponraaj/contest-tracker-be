import { updateCodechefParticipation } from "./controllers/codechefController.js";
import { updateCodeforcesParticipation } from "./controllers/codeforcesController";

console.log("Process started !!");
updateCodechefParticipation()
  .then((results) => {
    console.log("Response:", {
      message: "CodeChef participation update completed",
      results
    });
    console.log("DONE !!");
  })
  .catch((error) => console.error("Error:", error));