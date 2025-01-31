import fs from "fs/promises";
import path from "path";
import { z } from "zod";

const CONTESTS_FILE_PATH = path.join(process.cwd(), "utils", "contests.json");

// Zod Schema for validating contest data
const contestSchema = z.object({
  contest: z.string(),
  date: z.string().datetime(),
  type: z.enum(["weekly", "biweekly"]),
});

const contestArraySchema = z.array(contestSchema);

/**
 * Reads and validates contests from the JSON file.
 */
async function readContests() {
  try {
    const data = await fs.readFile(CONTESTS_FILE_PATH, "utf-8");
    const contests = JSON.parse(data);

    // Validate contests using Zod
    const validationResult = contestArraySchema.safeParse(contests);
    if (!validationResult.success) {
      console.error("Invalid contest data format:", validationResult.error);
      return [];
    }

    return validationResult.data;
  } catch (error) {
    console.error("Error reading contests file:", error);
    return [];
  }
}

/**
 * Gets the first contest from the JSON file (if available).
 */
export async function getFirstContest() {
  const contests = await readContests();
  return contests.length > 0 ? contests[0] : null;
}

/**
 * Removes the first contest from the JSON file.
 */
export async function removeFirstContest() {
  try {
    const contests = await readContests();
    if (contests.length === 0) {
      console.log("No contests to remove.");
      return;
    }

    const updatedContests = contests.slice(1);
    await fs.writeFile(
      CONTESTS_FILE_PATH,
      JSON.stringify(updatedContests, null, 2),
      "utf-8",
    );

    console.log(`Removed contest: ${contests[0].contest}`);
  } catch (error) {
    console.error("Error removing first contest:", error);
  }
}

