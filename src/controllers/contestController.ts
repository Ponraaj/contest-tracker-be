import fs from "fs";
import path from "path";
import prisma from "../config/db";

const filePath = "../utils/contests.json";

//NOTE: Fetch Contest
export async function getContest() {
  const jsonPath = path.join(process.cwd(), filePath);
  try {
    // Read the JSON file
    const data = fs.readFileSync(jsonPath, "utf-8");
    let contests = JSON.parse(data);

    if (contests.length === 0) {
      console.log("No contests in the JSON file.");
      return;
    }

    // Get the first contest
    const currentContest = contests.shift();

    // Insert into database using Prisma
    await prisma.contest.create({
      data: {
        name: currentContest.contest,
        date: new Date(currentContest.date),
      },
    });

    contests = contests.slice(1); // Remove first element
    fs.writeFileSync(jsonPath, JSON.stringify(contests, null, 4));

    console.log("Inserted and removed contest:", currentContest);
  } catch (err) {
    console.error("Error processing contest data:", err);
  }
}
