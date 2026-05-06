import axios from "axios";

/// <summary>
/// <para>Gets the JWT token from localStorage.</para>
/// </summary>
function getToken(): string | null {
    return localStorage.getItem("authToken");
}

/// <summary>
/// <para>Sets the JWT token in localStorage.</para>
/// </summary>
export function setToken(token: string): void {
    localStorage.setItem("authToken", token);
}

const authUserKey = "authUser";

/// <summary>
/// <para>Persists the logged-in user profile (for UI; token carries authorization).</para>
/// </summary>
export function setAuthUserJson(json: string): void {
    localStorage.setItem(authUserKey, json);
}

/// <summary>
/// <para>Removes the JWT token from localStorage.</para>
/// </summary>
export function removeToken(): void {
    localStorage.removeItem("authToken");
    localStorage.removeItem(authUserKey);
    // Dispatch custom event to notify app about logout
    window.dispatchEvent(new Event("auth:logout"));
}

/// <summary>
/// <para>Creates a configured Axios instance for the backend.</para>
/// </summary>
export const apiClient = axios.create({
    /// <summary>Specifies the base URL provided through environment variables.</summary>
    baseURL: import.meta.env.VITE_API_URL ?? "https://localhost:44368",
    /// <summary>Specifies default headers.</summary>
    headers: {
        "Content-Type": "application/json",
    },
});

// Add request interceptor to include JWT token
apiClient.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle 401 errors
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid, remove it
            removeToken();
        }
        return Promise.reject(error);
    }
);

