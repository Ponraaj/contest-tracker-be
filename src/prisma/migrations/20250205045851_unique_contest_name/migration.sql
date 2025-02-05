/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Contest` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Contest_name_key" ON "Contest"("name");
