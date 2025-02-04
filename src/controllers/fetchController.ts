import { getFirstContest } from "./contestController";
import prisma from "../config/db";

export let base_url = "https://leetcode.cn/contest/api/ranking";

export interface Question {
  question_id: String;
  time_taken: String;
  wrong_submissions: Number;
  submission_time: String;
  submission_id: String;
}

export interface Participant {
  username: String;
  rank: Number;
  finish_time: String;
  total_questions: Number;
  questions: Question[];
}

//NOTE: Get updated URL
export async function getupdatedURL(base_url: String) {
  try {
    const contestName = await getFirstContest();
    if (contestName?.contest) base_url += contestName?.contest;
    return base_url;
  } catch (error) {
    console.log("Error getting the updated URL");
    return new Error("Error getting the updated URL");
  }
}

//NOTE: Get total no. of pages in the leaderboard
export async function getConstestPages(current_url: String | Error) {
  try {
    if (!current_url) {
      throw new Error("Invalid current_url");
    }

    const response = await fetch(`${current_url}?pagination=1`);
    const cntdata = await response.json();
    const userCount = cntdata.user_num;
    const totalPages = Math.ceil(userCount / 25);

    return totalPages;
  } catch (error) {
    console.log("Error geting toatal no. of pages", error);
    throw new Error("Error geting toatal no. of pages");
  }
}

//NOTE: Get the data from single page
export async function fetchPage(pageIndex: Number, attempt = 1) {
  try {
    console.log(`Started fetching data for page ${pageIndex}`);
    const response = await fetch(`${base_url}?pagination=${pageIndex}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Completed fetching data for page ${pageIndex}`);
    return data;
  } catch (error) {
    console.error(`Error fetching data for page ${pageIndex}:`, error);
    if (attempt < 3) {
      console.log(`Retrying page ${pageIndex} (attempt ${attempt + 1})...`);
      return fetchPage(pageIndex, attempt + 1); // Retry fetching
    } else {
      console.error(`Failed to fetch page ${pageIndex} after 3 attempts.`);
      return null;
    }
  }
}

// TODO: 1. fix time taken for each problem
export async function fetchLeaderBoard() {
  try {
    const current_url: String | Error = await getupdatedURL(base_url);
    const totalPages: number | Error = await getConstestPages(current_url);

    if (typeof totalPages !== "number")
      throw new Error(
        "Error fetching the leaderboard due to issues with finding the total pages in the leaderboard",
      );

    let data: Participant[] = [];

    const contestStartDate = await getFirstContest().then((res) => res?.date);

    for (let i = 1; i <= totalPages; i++) {
      const data = await fetchPage(i);

      if (data) {
        const { submissions, total_rank } = data;

        for (let index = 0; index < submissions.length; index++) {
          const submissionSet = submissions[index];
          const user = total_rank[index];

          let questions = Object.values(submissionSet).map(
            (submission: any) => {
              const submissionTime = new Date(submission.date * 1000).getTime();
              //@ts-ignore
              const timeTaken = Math.max(submissionTime - contestStartDate, 0);

              const hours = Math.floor(timeTaken / 3600000);
              const minutes = Math.floor((timeTaken % 3600000) / 60000);
              const seconds = Math.floor((timeTaken % 60000) / 1000);

              const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
                .toString()
                .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

              return {
                question_id: submission.question_id,
                time_taken: formattedTime,
                wrong_submissions: submission.fail_count,
                submission_time: submission.date,
                submission_id: submission.submission_id,
              };
            },
          );

          data.push({
            username: user.username,
            rank: user.rank,
            finish_time: new Date(user.finish_time * 1000).toLocaleTimeString(
              "en-US",
              { timeZone: "Asia/Kolkata" },
            ),
            total_questions: questions.length,
            questions,
          });
        }
      }
    }

    return data;
  } catch (error) {
    console.log("Error fetching leaderboard:", error);
    return [];
  }
}

//NOTE: Load the data into the DB
export async function insertToDB() {
  try {
    const data = await fetchLeaderBoard();

    const contestDetails = await getFirstContest();
    if (!contestDetails?.contest || !contestDetails?.date) {
      console.log("Contest details missing.");
      return;
    }

    const contest = await prisma.contest.findFirst({
      where: { name: contestDetails.contest },
    });

    if (!contest) {
      console.error(`Contest ${contestDetails.contest} not found in DB.`);
      return;
    }

    for (const entry of data) {
      const student = await prisma.students.findUnique({
        where: { leetcode_id: entry.username },
      });

      if (student) {
        await prisma.contestParticipation.create({
          data: {
            studentId: student.id,
            contestId: contest.id,
            contestName: contestDetails.contest,
            rank: entry.rank,
            finishTime: entry.finish_time,
            total_qns: entry.total_questions,
            questions: entry.questions as any,
          },
        });
        console.log(`Inserted data for ${entry.username}`);
      } else {
        console.log(`Student ${entry.username} not found in DB, skipping.`);
      }
    }
  } catch (error) {
    console.log("Error inserting contest data:", error);
  }
}
