import { insertToDB } from "./controllers/leetcodeController";
import { removeFirstContest } from "./controllers/leetcodeController";

//NOTE: Contest ah remove pannala

console.log("Process started !!");
insertToDB().then(async () => {
  console.log("DONE !!");
  console.log("Removing the first contest frm JSON");
});
