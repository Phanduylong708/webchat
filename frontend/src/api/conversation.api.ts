import { api } from "@/lib/axios.config";
import { handleApiError } from "@/utils/apiError.util";
import type {
  ResponseType,
  ConversationsResponse,
  ConversationsDetail,
  PinnedMessageItem,
} from "@/types/chat.type";

async function getConversations(): Promise<ConversationsResponse[]> {
    try {
        const response: ResponseType<{ conversations: ConversationsResponse[] }> = await api.get("/conversations");
        const conversations = response.data.conversations;
        return conversations;  
    } catch (error) {
        throw handleApiError(error);
    }
}

async function getConversationsDetails(conversationsId: number): Promise<ConversationsDetail> {
    try {
        const response: ResponseType<{ conversation: ConversationsDetail }> = await api.get(`/conversations/${conversationsId}`);
        const conversation = response.data.conversation;
        return conversation;
    } catch (error) {
        throw handleApiError(error);
    }
}

async function getConversationPins(conversationId: number): Promise<PinnedMessageItem[]> {
    try {
        const response: ResponseType<{ pins: PinnedMessageItem[] }> = await api.get(`/conversations/${conversationId}/pins`);
        return response.data.pins;
    } catch (error) {
        throw handleApiError(error);
    }
}

async function addMemberApi(conversationId: number, userId: number): Promise<void> {
    try {
        await api.post(`/conversations/${conversationId}/members`, { userId });
    } catch (error) {
        throw handleApiError(error);
    }
}

async function createGroupApi(title: string, memberIds: number[]): Promise<void> {
    try {
        await api.post("/conversations/group", {title, memberIds});
    } catch (error) {
        throw handleApiError(error);
    }
}

async function leaveGroupApi(conversationId: number): Promise<void> {
    try {
        await api.delete(`/conversations/${conversationId}/leave`);
    } catch (error) {
        throw handleApiError(error);
    }
}

async function removeMemberApi(conversationId: number, userId: number): Promise<void> {
    try {
        await api.delete(`/conversations/${conversationId}/members/${userId}`);
    } catch (error) {
        throw handleApiError(error);
    }
}

async function startPrivateChatApi(recipientId: number): Promise<{ conversationId: number }> {
    try {
        const response: ResponseType<{ conversationId: number }> = await api.post("/conversations/private", { recipientId });
        return { conversationId: response.data.conversationId };
    } catch (error) {
        throw handleApiError(error);
    }
}

export {
    getConversations,
    getConversationsDetails,
    getConversationPins,
    addMemberApi,
    createGroupApi,
    leaveGroupApi,
    removeMemberApi,
    startPrivateChatApi,
};
