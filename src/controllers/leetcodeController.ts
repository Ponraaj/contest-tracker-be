import prisma from '../config/db'
import fs from 'fs/promises'
import path from 'path'

export interface Question {
  question_id: string
  time_taken: string
  wrong_submissions: number
  submission_time: string
  submission_id: string
}

export interface Participant {
  username: string
  rank: number
  finish_time: string
  total_questions: number
  questions: Question[]
}

const CONTESTS_FILE_PATH = path.join(
  process.cwd(),
  'src',
  'utils',
  'contests.json',
)

/**
 * Reads and validates contests from the JSON file.
 */
async function readContests() {
  try {
    const data = await fs.readFile(CONTESTS_FILE_PATH, 'utf-8')
    const contests = JSON.parse(data)
    return contests
  } catch (error) {
    console.error('Error reading contests file:', error)
    return []
  }
}

/**
 * Gets the first contest from the JSON file (if available).
 */
export async function getFirstContest() {
  const contests = await readContests()
  return contests.length > 0 ? contests[0] : null
}

/**
 * Removes the first contest from the JSON file.
 */
export async function removeFirstContest() {
  try {
    const contests = await readContests()
    if (contests.length === 0) {
      console.log('No contests to remove.')
      return
    }

    const updatedContests = contests.slice(1)
    await fs.writeFile(
      CONTESTS_FILE_PATH,
      JSON.stringify(updatedContests, null, 2),
      'utf-8',
    )

    console.log(`Removed contest: ${contests[0].contest}`)
  } catch (error) {
    console.error('Error removing first contest:', error)
  }
}

export const base_url = 'https://leetcode.cn/contest/api/ranking/'

//NOTE: Get updated URL
export async function getupdatedURL(base_url: string, contestName?: string) {
  try {
    if (contestName) {
      return base_url + contestName
    }

    const contestInfo = await getFirstContest()
    if (contestInfo?.contest) base_url += contestInfo.contest
    return base_url
  } catch (error) {
    console.log('Error getting the updated URL', error)
    return new Error('Error getting the updated URL')
  }
}

//NOTE: Get total no. of pages in the leaderboard
export async function getConstestPages(current_url: string | Error) {
  try {
    if (!current_url || current_url instanceof Error) {
      throw new Error('Invalid current_url')
    }

    const response = await fetch(`${current_url}?pagination=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    })
    const cntdata = await response.json()
    const userCount = cntdata.user_num
    const totalPages = Math.ceil(userCount / 25)

    return totalPages
  } catch (error) {
    console.log('Error getting total no. of pages', error)
    throw new Error('Error getting total no. of pages')
  }
}

//NOTE: Get the data from single page
export async function fetchPage(
  pageIndex: number,
  current_url: string | Error,
  attempt = 1,
) {
  try {
    console.log(`Started fetching data for page ${pageIndex}`)
    console.log(`Fetching URL:  ${current_url}?pagination=${pageIndex}`)
    const response = await fetch(`${current_url}?pagination=${pageIndex}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    })
    // if (!response.ok) {
    //   throw new Error(`HTTP error! Status: ${response.status}`);
    // }
    const data = await response.json()
    console.log(`Completed fetching data for page ${pageIndex}`)
    return data
  } catch (error) {
    console.error(`Error fetching data for page ${pageIndex}:`, error)
    if (attempt < 3) {
      console.log(`Retrying page ${pageIndex} (attempt ${attempt + 1})...`)
      return fetchPage(pageIndex, current_url, attempt + 1) // Retry fetching
    } else {
      console.error(`Failed to fetch page ${pageIndex} after 3 attempts.`)
      return null
    }
  }
}

export async function fetchLeaderBoard(contestName?: string) {
  try {
    const current_url: string | Error = await getupdatedURL(
      base_url,
      contestName,
    )
    const totalPages: number | Error = await getConstestPages(current_url)

    console.log('Current URL: ', current_url)

    if (typeof totalPages !== 'number')
      throw new Error(
        'Error fetching the leaderboard due to issues with finding the total pages in the leaderboard',
      )

    const userdata: Participant[] = []

    // Get contest date - either from specific contest or from JSON file
    let contestDate
    if (contestName) {
      // If specific contest, use current date or try to fetch actual contest date
      // For simplicity, using current date here
      contestDate = new Date().toISOString()
    } else {
      contestDate = await getFirstContest().then((res) => {
        return res?.date
      })
    }

    const contestStartTime = new Date(contestDate).getTime()

    for (let i = 1; i <= totalPages; i++) {
      const data = await fetchPage(i, current_url)

      if (data) {
        const { submissions, total_rank } = data

        for (let index = 0; index < submissions.length; index++) {
          const submissionSet = submissions[index]
          const user = total_rank[index]

          const questions = Object.values(submissionSet).map(
            (submission: any) => {
              const submissionTime = submission.date * 1000
              const timeTaken = Math.max(submissionTime - contestStartTime, 0)

              const hours = Math.floor(timeTaken / 3600000)
              const minutes = Math.floor((timeTaken % 3600000) / 60000)
              const seconds = Math.floor((timeTaken % 60000) / 1000)

              const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes
                .toString()
                .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

              return {
                question_id: submission.question_id,
                time_taken: formattedTime,
                wrong_submissions: submission.fail_count,
                submission_time: submission.date,
                submission_id: submission.submission_id,
              }
            },
          )

          userdata.push({
            username: user.username,
            rank: user.rank,
            finish_time: new Date(user.finish_time * 1000).toLocaleTimeString(
              'en-US',
              { timeZone: 'Asia/Kolkata' },
            ),
            total_questions: questions.length,
            questions,
          })
        }
      }
    }
    return userdata
  } catch (error) {
    console.log('Error fetching leaderboard:', error)
    return []
  }
}

//NOTE: Load the data into the DB
export async function updateLeetcodeData(contestSlug?: string) {
  try {
    // Determine contest details
    let contestDetails

    if (contestSlug) {
      contestDetails = {
        contest: contestSlug,
        date: new Date().toISOString(),
      }
      console.log(`Processing specific contest: ${contestSlug}`)
    } else {
      contestDetails = await getFirstContest()
      console.log(
        `Processing contest from JSON file: ${contestDetails?.contest}`,
      )
    }

    if (!contestDetails?.contest || !contestDetails?.date) {
      console.log('Contest details missing.')
      return
    }

    const data = await fetchLeaderBoard(contestSlug)

    // Upsert contest details
    const contest = await prisma.contest.upsert({
      where: { name: contestDetails.contest },
      update: {},
      //@ts-ignore
      create: {
        name: contestDetails.contest,
        date: contestDetails.date,
        type: 'Leetcode',
      },
    })

    // Create a Map for quick lookup (username -> entry)
    const leaderboardMap = new Map<string, any>()
    for (const entry of data) {
      leaderboardMap.set(entry.username, entry)
    }

    // Fetch all students
    const students = await prisma.students.findMany()

    // Iterate over students and check if they are in the leaderboard
    for (const student of students) {
      const entry = leaderboardMap.get(student.leetcode_id)

      if (entry) {
        await prisma.contestParticipation.upsert({
          where: {
            studentId_contestId: {
              studentId: student.id,
              contestId: contest.id,
            },
          },
          update: {
            rank: entry.rank,
            finishTime: entry.finish_time,
            total_qns: entry.total_questions,
            questions: entry.questions as any,
          },
          create: {
            studentId: student.id,
            contestId: contest.id,
            contestName: contestDetails.contest,
            rank: entry.rank,
            finishTime: entry.finish_time,
            total_qns: entry.total_questions,
            questions: entry.questions as any,
          },
        })

        console.log(`Updated participation for student: ${student.leetcode_id}`)
      } else {
        await prisma.contestParticipation.upsert({
          where: {
            studentId_contestId: {
              studentId: student.id,
              contestId: contest.id,
            },
          },
          update: {
            rank: -1,
            finishTime: null,
            total_qns: 0,
            questions: [] as any,
          },
          create: {
            studentId: student.id,
            contestId: contest.id,
            contestName: contestDetails.contest,
            rank: -1,
            finishTime: null,
            total_qns: 0,
            questions: [] as any,
          },
        })

        console.log(
          `Marked student ${student.leetcode_id} as non-participant with rank -1`,
        )
      }
    }

    console.log(`Successfully processed contest: ${contestDetails.contest}`)
    return true
  } catch (error) {
    console.log('Error updating contest participation:', error)
    return false
  }
}
