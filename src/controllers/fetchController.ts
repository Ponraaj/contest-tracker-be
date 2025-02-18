import schedule from "node-schedule";

interface Contest {
  site: "leetcode" | "codechef" | "codeforces";
  title: string;
  startTime: number;
  duration: number;
  endTime: number;
  url: string;
}

const CONTESTS_API = "https://competeapi.vercel.app/contests/upcoming";

async function handleLeetcodeContest(contest: Contest) {
  console.log(`Processing Leetcode contest: ${contest.title}`);
  // Add your Leetcode-specific logic here
}

async function handleCodechefContest(contest: Contest) {
  console.log(`Processing Codechef contest: ${contest.title}`);
  // Add your Codechef-specific logic here
}

async function handleCodeforcesContest(contest: Contest) {
  console.log(`Processing Codeforces contest: ${contest.title}`);
  // Add your Codeforces-specific logic here
}

export async function fetchUpcomingContests() {
  try {
    const { default: got } = await import("got");
    const response = await got(CONTESTS_API).json<Contest[]>();
    const todayIST = new Date().toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const todayContests = response.filter((contest) => {
      const startDate = new Date(contest.startTime).toLocaleDateString(
        "en-IN",
        { timeZone: "Asia/Kolkata" }
      );
      return startDate === todayIST;
    });

    for (const contest of todayContests) {
      scheduleContestFetch(contest);
    }

    console.log(`Scheduled ${todayContests.length} contests for processing.`);
  } catch (error) {
    console.error("Error fetching contests:", error);
  }
}

function scheduleContestFetch(contest: Contest) {
  let offsetHours: number;
  switch (contest.site.toLowerCase()) {
    case "leetcode":
      offsetHours = 3;
      break;
    case "codechef":
    case "codeforces":
      offsetHours = 8;
      break;
    default:
      console.warn(
        `Unknown platform ${contest.site}, using default 8 hour offset`
      );
      offsetHours = 8;
  }

  const fetchTimeIST = new Date(
    new Date(contest.endTime).getTime() + offsetHours * 60 * 60 * 1000
  );

  // Schedule the job using the Date object directly
  const job = schedule.scheduleJob(fetchTimeIST, async () => {
    console.log(`Processing contest: ${contest.title} at ${fetchTimeIST}`);
    await processContest(contest);
  });

  console.log(
    `Scheduled processing for "${contest.title}" at ${fetchTimeIST} (IST)`
  );
}

async function processContest(contest: Contest) {
  try {
    switch (contest.site.toLowerCase()) {
      case "leetcode":
        await handleLeetcodeContest(contest);
        break;
      case "codechef":
        await handleCodechefContest(contest);
        break;
      case "codeforces":
        await handleCodeforcesContest(contest);
        break;
      default:
        console.warn(`Unknown platform ${contest.site}, skipping processing`);
    }
  } catch (error) {
    console.error(`Error processing contest ${contest.title}:`, error);
  }
}
