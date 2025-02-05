-- AlterTable
ALTER TABLE "ContestParticipation" ALTER COLUMN "finishTime" DROP NOT NULL,
ALTER COLUMN "questions" DROP NOT NULL,
ALTER COLUMN "total_qns" DROP NOT NULL;
