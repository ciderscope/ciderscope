"use client";

let authToken: string | null = null;

export const setApiAuthToken = (token: string | null) => {
  authToken = token?.trim() || null;
};

export const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials || "same-origin",
  });
};
