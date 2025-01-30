import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import schedule from 'node-schedule';
import { z } from 'zod';

// Initialize Prisma client
const prisma = new PrismaClient();

// Types
type ContestData = {
  contest: string;
  date: string;
  type: 'weekly' | 'biweekly';
};

// Validation schema for contest data
const contestSchema = z.object({
  contest: z.string(),
  date: z.string().datetime(),
  type: z.enum(['weekly', 'biweekly'])
});

const contestArraySchema = z.array(contestSchema);

// Configuration
const CONTESTS_FILE_PATH = path.join(process.cwd(), 'utils', 'contests.json');
let isProcessing = false;

/**
 * Read and validate contests from JSON file
 */
async function readContests(): Promise<ContestData[]> {
  try {
    const data = await fs.readFile(CONTESTS_FILE_PATH, 'utf-8');
    const contests = JSON.parse(data);
    
    const validationResult = contestArraySchema.safeParse(contests);
    
    if (!validationResult.success) {
      throw new Error('Invalid contest data format');
    }
    
    return validationResult.data;
  } catch (error) {
    console.error('Error reading contests file:', error);
    throw error;
  }
}

/**
 * Update contests file after processing
 */
async function updateContestsFile(contests: ContestData[]): Promise<void> {
  try {
    await fs.writeFile(
      CONTESTS_FILE_PATH,
      JSON.stringify(contests, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Error updating contests file:', error);
    throw error;
  }
}

/**
 * Process a single contest
 */
async function processContest(contest: ContestData): Promise<void> {
  try {
    await prisma.contest.create({
      data: {
        name: contest.contest,
        date: new Date(contest.date),
      }
    });
    
    console.log(`Successfully processed contest: ${contest.contest}`);
  } catch (error) {
    console.error(`Error processing contest ${contest.contest}:`, error);
    throw error;
  }
}

/**
 * Main function to fetch and process contests
 */
export async function getContest(): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    console.log('Contest processing already in progress');
    return;
  }

  isProcessing = true;

  try {
    const contests = await readContests();

    if (contests.length === 0) {
      console.log('No contests available in the JSON file.');
      return;
    }

    const currentContest = contests[0];
    await processContest(currentContest);
    
    // Remove processed contest and update file
    const remainingContests = contests.slice(1);
    await updateContestsFile(remainingContests);

  } catch (error) {
    console.error('Error in getContest:', error);
    throw error;
  } finally {
    isProcessing = false;
  }
}

/**
 * Initialize contest scheduling
 */
export function initializeScheduler(): void {
  // Schedule weekly contests (Sundays at 10:00 AM)
  schedule.scheduleJob('0 10 * * 0', async () => {
    console.log('Running weekly contest scheduler');
    try {
      const contests = await readContests();
      const nextContest = contests[0];
      
      if (nextContest && nextContest.type === 'weekly' && 
          new Date(nextContest.date).toDateString() === new Date().toDateString()) {
        await getContest();
      }
    } catch (error) {
      console.error('Error in weekly contest scheduler:', error);
    }
  });

  // Schedule biweekly contests (Saturdays at 22:00)
  schedule.scheduleJob('0 22 * * 6', async () => {
    console.log('Running biweekly contest scheduler');
    try {
      const contests = await readContests();
      const nextContest = contests[0];
      
      if (nextContest && nextContest.type === 'biweekly' && 
          new Date(nextContest.date).toDateString() === new Date().toDateString()) {
        await getContest();
      }
    } catch (error) {
      console.error('Error in biweekly contest scheduler:', error);
    }
  });
}