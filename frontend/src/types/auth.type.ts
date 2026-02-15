interface User {
    id: number;
    username: string;
    email: string;
    createdAt: string;
    avatar: string | null;
}

interface AuthResponse<T> {
    success: boolean;
    statusCode: number;
    data: T;
    message: string;    

}

interface AuthData {
    user: User;
    token: string;
}

interface LoginRequest {
    identifier: string;
    password: string;
}

interface RegisterRequest {
    username: string;
    email: string;
    password: string;
}

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}

interface AuthContextType extends AuthState {
    login: (data: LoginRequest) => Promise<boolean>;
    register: (data: RegisterRequest) => Promise<boolean>;
    logout: () => void;
    checkAuth: () => Promise<void>;
    setCurrentUser: (user: User) => void;
}
export type { User, AuthResponse, AuthData, LoginRequest, RegisterRequest, AuthState, AuthContextType };
