-- CreateEnum
CREATE TYPE "PinPermission" AS ENUM ('ALL_MEMBERS', 'CREATOR_ONLY');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "pinPermission" "PinPermission" NOT NULL DEFAULT 'ALL_MEMBERS';

-- CreateIndex
CREATE UNIQUE INDEX "Message_id_conversationId_key" ON "Message"("id", "conversationId");

-- CreateTable
CREATE TABLE "ConversationPin" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "pinnedByUserId" INTEGER NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationPin_conversationId_pinnedAt_idx" ON "ConversationPin"("conversationId", "pinnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationPin_conversationId_messageId_key" ON "ConversationPin"("conversationId", "messageId");

-- AddForeignKey
ALTER TABLE "ConversationPin" ADD CONSTRAINT "ConversationPin_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationPin" ADD CONSTRAINT "ConversationPin_messageId_conversationId_fkey" FOREIGN KEY ("messageId", "conversationId") REFERENCES "Message"("id", "conversationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationPin" ADD CONSTRAINT "ConversationPin_pinnedByUserId_fkey" FOREIGN KEY ("pinnedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
