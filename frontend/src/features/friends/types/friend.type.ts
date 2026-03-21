interface Friend {
    id: number;
    username: string;
    avatar: string | null;
    isOnline: boolean;
    lastSeen: string | null;
}

interface FriendState {
    friends: Friend[];
    loading: boolean;
    error: string | null;
    selectedFriendId: number | null; // ID of the selected friend
}

  interface FriendContextType {                                                                                                                                 
    friends: Friend[];                                                                                                                                          
    selectedFriend: Friend | null;                                                                                                                              
    loading: boolean;                                                                                                                                           
    error: string | null;                                                                                                                                       
    fetchFriends: () => Promise<void>;                                                                                                                          
    addFriend: (username: string) => Promise<{ success: boolean; message?: string }>;                                                                                                          
    removeFriend: (id: number) => Promise<{ success: boolean; message?: string }>;                                                                                                             
    selectFriend: (id: number | null) => void;                                                                                                                  
  }    

export type { Friend, FriendState, FriendContextType };