/*
  Warnings:

  - A unique constraint covering the columns `[studentId,contestId]` on the table `ContestParticipation` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ContestParticipation_studentId_contestId_key" ON "ContestParticipation"("studentId", "contestId");
