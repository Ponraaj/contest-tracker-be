import { updateCodechefParticipation } from "./controllers/codechefController";
import { removeFirstContest } from "./controllers/leetcodeController";

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