import * as cheerio from 'cheerio'
import prisma from '../config/db'

interface UpdateResults {
  success: string[]
  failed: string[]
  total: number
  successCount: number
  failureCount: number
}

export const updateCodechefdata = async (
  contestName?: string,
): Promise<UpdateResults> => {
  const students = await prisma.students.findMany()
  const results = {
    success: [] as string[],
    failed: [] as string[],
    total: students.length,
    successCount: 0,
    failureCount: 0,
  }

  // If no contest name provided, exit early
  if (!contestName) {
    console.log('No contest name provided, skipping update')
    return results
  }

  console.log(`Processing data for contest: ${contestName}`)

  // Ensure the contest exists in database
  const contestDate = new Date()
  const contest_record = await prisma.contest.upsert({
    where: { name: contestName },
    update: {},
    create: {
      name: contestName,
      date: contestDate,
      type: 'Codechef',
    },
  })

  for (const student of students) {
    try {
      await updateStudentCodechefData(student, contestName, contest_record.id)
      results.success.push(student.codechef_id)
      console.log(
        `Updated data for ${student.codechef_id} - Contest: ${contestName}`,
      )
    } catch (error) {
      console.error(`Failed to update data for ${student.codechef_id}:`, error)
      results.failed.push(student.codechef_id)
    }
  }

  results.successCount = results.success.length
  results.failureCount = results.failed.length

  return results
}

export const updateSingleStudentCodechef = async (
  studentId: string,
  contestName?: string,
): Promise<{ message: string; student?: string; error?: string }> => {
  try {
    const student = await prisma.students.findUnique({
      where: { id: studentId },
    })

    if (!student) {
      throw new Error('Student not found')
    }

    if (!contestName) {
      throw new Error('Contest name is required')
    }

    // Find or create contest
    const contestDate = new Date()
    const contest_record = await prisma.contest.upsert({
      where: { name: contestName },
      update: {},
      create: {
        name: contestName,
        date: contestDate,
        type: 'Codechef',
      },
    })

    await updateStudentCodechefData(student, contestName, contest_record.id)

    return {
      message: 'Successfully updated CodeChef participation',
      student: student.codechef_id,
    }
  } catch (error) {
    console.error(`Failed to update data for student ${studentId}:`, error)
    return {
      message: 'Error updating CodeChef participation',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Helper function to update a single student's CodeChef data for a specific contest
async function updateStudentCodechefData(
  student: any,
  contestName: string,
  contestId: string,
) {
  try {
    const { default: got } = await import('got')
    const url = `https://www.codechef.com/users/${student.codechef_id}`

    // Check if the user exists on CodeChef
    let html
    try {
      html = await got(url).text()
    } catch (error) {
      console.log(`Wrong username for student: ${student.codechef_id}`)
      console.log(error)
      // Create participation record with rank -1 for wrong username
      await prisma.codechefParticipation.upsert({
        where: {
          studentId_contestId: {
            studentId: student.id,
            contestId: contestId,
          },
        },
        update: {
          rank: -1,
          total_qns: 0,
          questions: [],
        },
        create: {
          studentId: student.id,
          contestId: contestId,
          contestName,
          rank: -1,
          total_qns: 0,
          questions: [],
        },
      })
      return
    }

    const $ = cheerio.load(html)

    const apiUrl = `https://codechef-api.vercel.app/handle/${student.codechef_id}`
    let response
    try {
      response = await got(apiUrl).json<any>()
    } catch (error) {
      console.log(`API error for student: ${student.codechef_id}`, error)
      // Create participation record with rank -1 for API error
      await prisma.codechefParticipation.upsert({
        where: {
          studentId_contestId: {
            studentId: student.id,
            contestId: contestId,
          },
        },
        update: {
          rank: -1,
          total_qns: 0,
          questions: [],
        },
        create: {
          studentId: student.id,
          contestId: contestId,
          contestName,
          rank: -1,
          total_qns: 0,
          questions: [],
        },
      })
      return
    }

    const cleanText = (text: string) => text.replace(/\s+/g, ' ').trim()

    // Find the specific contest in the user's rating data
    const contestData = response.ratingData?.find(
      (contest: any) => contest.name === contestName,
    )

    let rank = -1
    let problemsSolved: string[] = []

    if (contestData) {
      rank = contestData.rank ? parseInt(contestData.rank) : -1
    } else {
      console.log(
        `Student ${student.codechef_id} hasn't attended contest ${contestName}`,
      )
      // For students who haven't attended the contest, rank is already set to -1
    }

    // Try to get problems solved for this specific contest
    const lastContest = cleanText($('.problems-solved .content').last().text())
    const contestPattern = new RegExp(
      `(${contestName}.*?)(?=Starters \\d+|$)`,
      'g',
    )
    const contest = lastContest.match(contestPattern)

    problemsSolved =
      contest?.[0]
        ?.split(/(?<=\))\s*/)
        .slice(1)
        .join('')
        .split(', ')
        .map(cleanText)
        .filter(Boolean) || []

    // Upsert participation record
    await prisma.codechefParticipation.upsert({
      where: {
        studentId_contestId: {
          studentId: student.id,
          contestId: contestId,
        },
      },
      update: {
        rank,
        total_qns: problemsSolved.length,
        questions: problemsSolved,
      },
      create: {
        studentId: student.id,
        contestId: contestId,
        contestName,
        rank,
        total_qns: problemsSolved.length,
        questions: problemsSolved,
      },
    })

    // Update student's CodeChef rating if available
    if (response.currentRating !== undefined) {
      const newRating = BigInt(response.currentRating)
      await prisma.students.update({
        where: { id: student.id },
        data: { codechef_rating: newRating },
      })
    }

    console.log(
      `Updated ${student.codechef_id}: Contest=${contestName}, Rank=${rank}, Rating=${response.currentRating || 0}, Problems=${problemsSolved.length}`,
    )
  } catch (error) {
    console.error(`Error processing student ${student.codechef_id}:`, error)
    throw error
  }
}
