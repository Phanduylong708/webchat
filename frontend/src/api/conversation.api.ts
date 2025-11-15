import { api } from "@/lib/axios.config";
import { handleApiError } from "@/utils/apiError.util";
import type { ResponseType, ConversationsResponse, ConversationsDetail} from "@/types/chat.type";

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
        const response: ResponseType<ConversationsDetail> = await api.get(`/conversations/${conversationsId}`);
        const conversation = response.data;
        return conversation;
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

export { getConversations, getConversationsDetails, addMemberApi, createGroupApi, leaveGroupApi };