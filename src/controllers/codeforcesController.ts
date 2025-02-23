import prisma from '../config/db'

interface UpdateResults {
  success: string[]
  failed: string[]
  total: number
  successCount: number
  failureCount: number
}

// Codeforces API Response Types
interface CodeforcesRatingResponse {
  status: string
  result: {
    contestId: number
    contestName: string
    handle: string
    rank: number
    ratingUpdateTimeSeconds: number
    oldRating: number
    newRating: number
  }[]
}

interface CodeforcesProblem {
  contestId?: number
  problemsetName?: string
  index: string
  name: string
  type: string
  points?: number
  rating?: number
  tags: string[]
}

interface CodeforcesSubmission {
  id: number
  contestId?: number
  creationTimeSeconds: number
  relativeTimeSeconds: number
  problem: CodeforcesProblem
  author: {
    contestId?: number
    members: { handle: string }[]
    participantType?: string
    ghost?: boolean
    startTimeSeconds?: number
  }
  programmingLanguage: string
  verdict: string
  testset: string
  passedTestCount: number
  timeConsumedMillis: number
  memoryConsumedBytes: number
}

interface CodeforcesSubmissionResponse {
  status: string
  result: CodeforcesSubmission[]
}

export const updateCodeforcesdata = async (): Promise<UpdateResults> => {
  const students = await prisma.students.findMany()
  const results = {
    success: [] as string[],
    failed: [] as string[],
    total: students.length,
    successCount: 0,
    failureCount: 0,
  }

  for (const student of students) {
    try {
      await updateStudentCodeforcesData(student)
      results.success.push(student.codeforces_id)
      console.log(`Updated data for ${student.codeforces_id}`)
    } catch (error) {
      console.error(
        `Failed to update data for ${student.codeforces_id}:`,
        error,
      )
      results.failed.push(student.codeforces_id)
    }
  }

  results.successCount = results.success.length
  results.failureCount = results.failed.length

  return results
}

export const updateSingleStudentCodeforces = async (
  studentId: string,
): Promise<{
  message: string
  student?: string
  error?: string
}> => {
  try {
    const student = await prisma.students.findUnique({
      where: { id: studentId },
    })

    if (!student) {
      throw new Error('Student not found')
    }

    await updateStudentCodeforcesData(student)

    return {
      message: 'Successfully updated Codeforces participation',
      student: student.codeforces_id,
    }
  } catch (error) {
    console.error(`Failed to update data for student ${studentId}:`, error)
    return {
      message: 'Error updating Codeforces participation',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Helper function to update a single student's Codeforces data
async function updateStudentCodeforcesData(student: any) {
  const { default: got } = await import('got')

  // Fetch all past contests
  const contestsResponse = await got(
    'https://codeforces.com/api/contest.list',
  ).json<{
    status: string
    result: {
      id: number
      name: string
      phase: string
      startTimeSeconds: number
    }[]
  }>()

  if (!contestsResponse.result.length) {
    throw new Error('No contest data found')
  }

  // Find the last ended contest
  const pastContests = contestsResponse.result
    .filter((contest) => contest.phase === 'FINISHED')
    .sort((a, b) => b.startTimeSeconds - a.startTimeSeconds)

  if (!pastContests.length) {
    throw new Error('No finished contests found')
  }

  const lastEndedContest = pastContests[0]

  // Fetch user's contest history
  const ratingResponse = await got(
    `https://codeforces.com/api/user.rating?handle=${student.codeforces_id}`,
  ).json<CodeforcesRatingResponse>()

  // Check if user participated in the last ended contest
  const userContest = ratingResponse.result.find(
    (contest) => contest.contestId === lastEndedContest.id,
  )

  let rank = -1
  let solvedProblems: string[] = []

  if (userContest) {
    // Fetch submission history
    const submissionResponse = await got(
      `https://codeforces.com/api/user.status?handle=${student.codeforces_id}&from=1&count=1000`,
    ).json<CodeforcesSubmissionResponse>()

    if (submissionResponse.result.length) {
      const latestContestSubmissions = submissionResponse.result.filter(
        (sub) => sub.contestId === lastEndedContest.id,
      )

      // Get unique solved problems
      solvedProblems = latestContestSubmissions
        .filter((sub) => sub.verdict === 'OK')
        .map((sub) => sub.problem.name)
        .filter((value, index, self) => self.indexOf(value) === index)
    }

    rank = userContest.rank
  }

  // Create or update contest record
  const contest_record = await prisma.contest.upsert({
    where: { name: lastEndedContest.name },
    update: {},
    create: {
      name: lastEndedContest.name,
      date: new Date(lastEndedContest.startTimeSeconds * 1000),
      type: 'Codeforces',
    },
  })

  // Create or update participation record
  await prisma.codeforcesParticipation.upsert({
    where: {
      studentId_contestId: {
        studentId: student.id,
        contestId: contest_record.id,
      },
    },
    update: {
      rank,
      finishTime: new Date(
        lastEndedContest.startTimeSeconds * 1000,
      ).toISOString(),
      total_qns: solvedProblems.length,
      questions: solvedProblems,
    },
    create: {
      studentId: student.id,
      contestId: contest_record.id,
      contestName: lastEndedContest.name,
      rank,
      finishTime: new Date(
        lastEndedContest.startTimeSeconds * 1000,
      ).toISOString(),
      total_qns: solvedProblems.length,
      questions: solvedProblems,
    },
  })

  // Find latest contest where the user participated
  const latestUserContest = ratingResponse.result.length
    ? ratingResponse.result[ratingResponse.result.length - 1]
    : null

  // Update student's rating
  if (latestUserContest) {
    await prisma.students.update({
      where: { id: student.id },
      data: { codeforces_rating: BigInt(latestUserContest.newRating) },
    })
  }
}
