function saveToken(token: string): void {
    localStorage.setItem('accessToken', token);
}

function getToken(): string | null {
    return localStorage.getItem('accessToken')
}

function removeToken(): void {
    localStorage.removeItem('accessToken')
}

export {saveToken, getToken, removeToken}