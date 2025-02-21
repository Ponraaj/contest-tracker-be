import schedule from 'node-schedule';
import Queue from 'bull';
import { updateCodeforcesdata } from './codeforcesController';
import { updateLeetcodeData, removeFirstContest } from './leetcodeController';
import { updateCodechefdata } from './codechefController';

interface Contest {
  site: 'leetcode' | 'codechef' | 'codeforces';
  title: string;
  startTime: number;
  duration: number;
  endTime: number;
  url: string;
}

const CONTESTS_API = 'https://competeapi.vercel.app/contests/upcoming';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    console.log(`Retrying Redis connection... Attempt ${times}`);
    return delay;
  },
};

const queue = new Queue('ContestQueue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

async function handleLeetcodeContest(contest: Contest) {
  console.log(`Adding to Queue Leetcode contest: ${contest.title}`);
  await queue.add({ type: 'Leetcode' });
}

async function handleCodechefContest(contest: Contest) {
  console.log(`Adding to Queue Codechef contest: ${contest.title}`);
  await queue.add({ type: 'Codechef' });
}

async function handleCodeforcesContest(contest: Contest) {
  console.log(`Adding to Queue Codeforces contest: ${contest.title}`);
  await queue.add({ type: 'Codeforces' });
}

export async function fetchUpcomingContests() {
  try {
    const { default: got } = await import('got');
    const response = await got(CONTESTS_API).json<Contest[]>();
    const todayIST = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
    });

    const todayContests = response.filter((contest) => {
      const startDate = new Date(contest.startTime).toLocaleDateString(
        'en-IN',
        { timeZone: 'Asia/Kolkata' }
      );
      return startDate === todayIST;
    });

    for (const contest of todayContests) {
      scheduleContestFetch(contest);
    }

    console.log(`Scheduled ${todayContests.length} contests for processing.`);
  } catch (error) {
    console.error('Error fetching contests:', error);
  }
}

function scheduleContestFetch(contest: Contest) {
  let offsetHours: number;
  switch (contest.site.toLowerCase()) {
    case 'leetcode':
      offsetHours = 3;
      break;
    case 'codechef':
    case 'codeforces':
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

  schedule.scheduleJob(fetchTimeIST, async () => {
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
      case 'leetcode':
        await handleLeetcodeContest(contest);
        break;
      case 'codechef':
        await handleCodechefContest(contest);
        break;
      case 'codeforces':
        await handleCodeforcesContest(contest);
        break;
      default:
        console.warn(`Unknown platform ${contest.site}, skipping processing`);
    }
  } catch (error) {
    console.error(`Error processing contest ${contest.title}:`, error);
  }
}

queue.process(async (job, done) => {
  try {
    console.log(`Processing job: ${job.data.type}`);

    switch (job.data.type) {
      case 'Leetcode':
        await updateLeetcodeData();
        await removeFirstContest();
        break;
      case 'Codechef':
        await updateCodechefdata();
        break;
      case 'Codeforces':
        await updateCodeforcesdata();
        break;
      default:
        console.warn(`Unknown job: ${job.data.type}`);
    }

    done();
  } catch (error) {
    console.error(`Error processing job: ${job.data.type}\n`, error);
    done(error as Error);
  }
});

process.on('SIGTERM', async () => {
  queue.close();
  process.exit(0);
});
