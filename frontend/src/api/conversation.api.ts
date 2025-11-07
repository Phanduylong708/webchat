import { api } from "@/lib/axios.config";
import { handleApiError } from "@/utils/apiError.util";
import type { ResponseType, User, ConversationsResponse } from "@/types/chat.type";


interface ConversationsDetail {
    id: number;
    title: string | null;
    type: "PRIVATE" | "GROUP";
    members: User[];
    creatorId: number;
}


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

export { getConversations, getConversationsDetails };