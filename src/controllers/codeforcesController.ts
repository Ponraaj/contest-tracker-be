import prisma from "../config/db";

interface UpdateResults {
  success: string[];
  failed: string[];
  total: number;
  successCount: number;
  failureCount: number;
}

// Codeforces API Response Types
interface CodeforcesRatingResponse {
  status: string;
  result: {
    contestId: number;
    contestName: string;
    handle: string;
    rank: number;
    ratingUpdateTimeSeconds: number;
    oldRating: number;
    newRating: number;
  }[];
}

interface CodeforcesProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: string;
  points?: number;
  rating?: number;
  tags: string[];
}

interface CodeforcesSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds: number;
  problem: CodeforcesProblem;
  author: {
    contestId?: number;
    members: { handle: string }[];
    participantType?: string;
    ghost?: boolean;
    startTimeSeconds?: number;
  };
  programmingLanguage: string;
  verdict: string;
  testset: string;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
}

interface CodeforcesSubmissionResponse {
  status: string;
  result: CodeforcesSubmission[];
}

export const updateCodeforcesParticipation = async (): Promise<UpdateResults> => {
  // Fetch all students
  const students = await prisma.students.findMany();
  const results = {
    success: [] as string[],
    failed: [] as string[],
    total: students.length,
    successCount: 0,
    failureCount: 0
  };

  for (const student of students) {
    try {
      await updateStudentCodeforcesData(student);
      results.success.push(student.codeforces_id);
      console.log(`Updated data for ${student.codeforces_id}`);
    } catch (error) {
      console.error(`Failed to update data for ${student.codeforces_id}:`, error);
      results.failed.push(student.codeforces_id);
    }
  }

  results.successCount = results.success.length;
  results.failureCount = results.failed.length;

  return results;
};

export const updateSingleStudentCodeforces = async (studentId: string): Promise<{
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

    await updateStudentCodeforcesData(student);

    return {
      message: "Successfully updated Codeforces participation",
      student: student.codeforces_id,
    };
  } catch (error) {
    console.error(`Failed to update data for student ${studentId}:`, error);
    return {
      message: "Error updating Codeforces participation",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Helper function to update a single student's Codeforces data
async function updateStudentCodeforcesData(student: any) {
  const { default: got } = await import('got');

  // Fetch contest history
  const ratingResponse = await got(
    `https://codeforces.com/api/user.rating?handle=${student.codeforces_id}`
  ).json<CodeforcesRatingResponse>();

  if (!ratingResponse.result.length) {
    throw new Error("No contest data found");
  }

  const contests = ratingResponse.result;
  const latestContest = contests[contests.length - 1];

  // Fetch submission history for the latest contest
  const submissionResponse = await got(
    `https://codeforces.com/api/user.status?handle=${student.codeforces_id}&from=1&count=1000`
  ).json<CodeforcesSubmissionResponse>();

  if (!submissionResponse.result.length) {
    throw new Error("No submissions found");
  }

  const submissions = submissionResponse.result;
  const latestContestSubmissions = submissions.filter(
    (sub) => sub.contestId === latestContest.contestId
  );

  // Get solved problems (unique problems with OK verdict)
  const solvedProblems = latestContestSubmissions
    .filter((sub) => sub.verdict === "OK")
    .map((sub) => sub.problem.name)
    .filter((value: string, index: number, self: string[]) => 
      self.indexOf(value) === index
    );

  // Create or update contest record
  const contest_record = await prisma.contest.upsert({
    where: { name: latestContest.contestName },
    update: {},
    create: {
      name: latestContest.contestName,
      date: new Date(latestContest.ratingUpdateTimeSeconds * 1000),
      type: "Codeforces",
    },
  });

  // Create or update participation record
  await prisma.codeforcesParticipation.upsert({
    where: {
      studentId_contestId: {
        studentId: student.id,
        contestId: contest_record.id,
      },
    },
    update: {
      rank: latestContest.rank,
      finishTime: new Date(latestContest.ratingUpdateTimeSeconds * 1000).toISOString(),
      total_qns: solvedProblems.length,
      questions: solvedProblems,
    },
    create: {
      studentId: student.id,
      contestId: contest_record.id,
      contestName: latestContest.contestName,
      rank: latestContest.rank,
      finishTime: new Date(latestContest.ratingUpdateTimeSeconds * 1000).toISOString(),
      total_qns: solvedProblems.length,
      questions: solvedProblems,
    },
  });

  // Update student's rating
  await prisma.students.update({
    where: { id: student.id },
    data: { codeforces_rating: BigInt(latestContest.newRating) },
  });
}