import { insertToDB } from "./controllers/fetchController";
import { removeFirstContest } from "./controllers/contestController";

console.log("Process started !!");
insertToDB().then(async () => {
  console.log("DONE !!");
  console.log("Removing the first contest frm JSON");
});
