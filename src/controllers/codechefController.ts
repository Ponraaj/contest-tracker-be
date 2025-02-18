import * as cheerio from "cheerio";
import prisma from "../config/db";

interface UpdateResults {
  success: string[];
  failed: string[];
  total: number;
  successCount: number;
  failureCount: number;
}

export const updateCodechefdata = async (): Promise<UpdateResults> => {
  // Fetch all students
  const students = await prisma.students.findMany();
  const results = {
    success: [] as string[],
    failed: [] as string[],
    total: students.length,
    successCount: 0,
    failureCount: 0,
  };

  for (const student of students) {
    try {
      await updateStudentCodechefData(student);
      results.success.push(student.codechef_id);
      console.log(`Updated data for ${student.codechef_id}`);
    } catch (error) {
      console.error(`Failed to update data for ${student.codechef_id}:`, error);
      results.failed.push(student.codechef_id);
    }
  }

  results.successCount = results.success.length;
  results.failureCount = results.failed.length;

  return results;
};

export const updateSingleStudentCodechef = async (
  studentId: string,
): Promise<{
  message: string;
  student?: string;
  error?: string;
}> => {
  try {
    const student = await prisma.students.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    await updateStudentCodechefData(student);

    return {
      message: "Successfully updated CodeChef participation",
      student: student.codechef_id,
    };
  } catch (error) {
    console.error(`Failed to update data for student ${studentId}:`, error);
    return {
      message: "Error updating CodeChef participation",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Helper function to update a single student's CodeChef data
async function updateStudentCodechefData(student: any) {
  const { default: got } = await import("got");
  const url = `https://www.codechef.com/users/${student.codechef_id}`;
  const html = await got(url).text();
  const $ = cheerio.load(html);

  const apiUrl = `https://codechef-api.vercel.app/handle/${student.codechef_id}`;
  const response = await got(apiUrl).json<any>();

  const cleanText = (text: string) => text.replace(/\s+/g, " ").trim();
  const latestContestData = response.ratingData[response.ratingData.length - 1];

  // Get problems solved
  const lastContest = cleanText($(".problems-solved .content").last().text());
  const contestPattern = /(Starters \d+.*?)(?=Starters \d+|$)/g;
  const contest = lastContest.match(contestPattern);
  const problemsSolved =
    contest?.[0]
      ?.split(/(?<=\))\s*/)
      .slice(1)
      .join("")
      .split(", ")
      .map(cleanText)
      .filter(Boolean) || [];

  // Create or update contest record
  const contest_record = await prisma.contest.upsert({
    where: { name: latestContestData.name },
    update: {},
    create: {
      name: latestContestData.name,
      date: new Date(latestContestData.end_date),
      type: "Codechef",
    },
  });

  // Create or update participation record
  await prisma.codechefParticipation.upsert({
    where: {
      studentId_contestId: {
        studentId: student.id,
        contestId: contest_record.id,
      },
    },
    update: {
      rank: parseInt(latestContestData.rank),
      total_qns: problemsSolved.length,
      questions: problemsSolved,
    },
    create: {
      studentId: student.id,
      contestId: contest_record.id,
      contestName: latestContestData.name,
      rank: parseInt(latestContestData.rank),
      total_qns: problemsSolved.length,
      questions: problemsSolved,
    },
  });

  // Update student's rating
  await prisma.students.update({
    where: { id: student.id },
    data: { codechef_rating: BigInt(response.currentRating) },
  });
}

