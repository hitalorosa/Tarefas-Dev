-- AlterTable
ALTER TABLE "Project" ADD COLUMN "status" TEXT;
ALTER TABLE "Project" ADD COLUMN "statusNote" TEXT;

-- CreateTable
CREATE TABLE "ProjectStar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectStar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStar_projectId_userId_key" ON "ProjectStar"("projectId", "userId");
