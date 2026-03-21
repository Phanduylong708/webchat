import type { ResponseType, Messages } from "@/types/chat.type";
import { api } from "@/lib/axios.config";
import { handleApiError } from "@/utils/apiError.util";



interface Meta {
    limit: number;
    nextCursor: number | null;
    hasMore: boolean;
} //pagination meta data

interface MessagesResponse {
    messages: Messages[];
    meta: Meta;
}

async function getMessages(conversationsId: number, before?: number , limit?: number) {
    try {
        const response: ResponseType<MessagesResponse> = await api.get(`messages/${conversationsId}`, {
            params: {
                before,
                limit
            }
        });
        return response.data;
    } catch (error) {
        throw handleApiError(error);
    }

}
export { getMessages };