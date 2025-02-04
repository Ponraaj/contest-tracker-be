/*
  Warnings:

  - You are about to drop the column `studentsId` on the `ContestParticipation` table. All the data in the column will be lost.
  - Added the required column `contestName` to the `ContestParticipation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finishTime` to the `ContestParticipation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questions` to the `ContestParticipation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `ContestParticipation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_qns` to the `ContestParticipation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ContestParticipation" DROP CONSTRAINT "ContestParticipation_studentsId_fkey";

-- DropIndex
DROP INDEX "ContestParticipation_studentsId_idx";

-- AlterTable
ALTER TABLE "ContestParticipation" DROP COLUMN "studentsId",
ADD COLUMN     "contestName" TEXT NOT NULL,
ADD COLUMN     "finishTime" TEXT NOT NULL,
ADD COLUMN     "questions" JSONB NOT NULL,
ADD COLUMN     "studentId" TEXT NOT NULL,
ADD COLUMN     "total_qns" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Students" ALTER COLUMN "college" SET DEFAULT 'CIT';

-- CreateIndex
CREATE INDEX "ContestParticipation_studentId_idx" ON "ContestParticipation"("studentId");

-- AddForeignKey
ALTER TABLE "ContestParticipation" ADD CONSTRAINT "ContestParticipation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestParticipation" ADD CONSTRAINT "ContestParticipation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
