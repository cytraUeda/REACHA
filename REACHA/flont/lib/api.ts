export async function apiGet<T>(path: string): Promise<T> {
  try {
    const res = await fetch(path, { next: { revalidate: 0 } });
    if (!res.ok) {
      let errorMessage = `GET ${path} ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        errorMessage = `GET ${path} ${res.status} ${res.statusText}`;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('ネットワークエラーが発生しました。接続を確認してください。');
      }
      throw error;
    }
    throw new Error('予期しないエラーが発生しました');
  }
}

export async function apiPost<T>(path: string, body: unknown, options?: { timeout?: number; signal?: AbortSignal }): Promise<T> {
  const timeout = options?.timeout || 600000; // Default 10 minutes, proposal creation can take longer (5 files × ~2 min each)
  const externalSignal = options?.signal;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // Combine external signal with timeout signal
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => {
      controller.abort();
    });
  }
  
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      let errorMessage = `POST ${path} ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // If response is not JSON, use status text
        errorMessage = `POST ${path} ${res.status} ${res.statusText}`;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        // Check if it was aborted by external signal (not timeout)
        if (externalSignal?.aborted) {
          throw new Error('リクエストがキャンセルされました');
        }
        throw new Error('リクエストがタイムアウトしました。時間がかかりすぎている可能性があります。しばらく待ってから再試行してください。');
      }
      // Network errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('ネットワークエラーが発生しました。接続を確認してください。');
      }
      throw error;
    }
    throw new Error('予期しないエラーが発生しました');
  }
}

export async function apiDelete<T>(path: string): Promise<T> {
  try {
    const res = await fetch(path, { method: 'DELETE' });
    if (!res.ok) {
      let errorMessage = `DELETE ${path} ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        errorMessage = `DELETE ${path} ${res.status} ${res.statusText}`;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  } catch (error) {
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('ネットワークエラーが発生しました。接続を確認してください。');
      }
      throw error;
    }
    throw new Error('予期しないエラーが発生しました');
  }
}

export type ResultsItem = {
  index: number;
  title: string;
  text: string;
  markdown: string;
  originalText?: string;
  originalMarkdown?: string;
  edited?: boolean;
  historyCount?: number;
};

export type ResultsResponse = {
  company: string;
  status: 'running' | 'completed' | 'not_found';
  queries: string[];
  progress: { completed: number; total: number } | null;
  items: ResultsItem[];
  hasProposal?: boolean;
};


