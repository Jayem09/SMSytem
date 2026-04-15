/**
 * Fast connection check - single attempt with short timeout
 */
export async function checkServerConnection(): Promise<boolean> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://168.144.46.137:8080';
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for connection - but show offline button quickly if fails
 */
export async function waitForConnection(maxWaitMs = 5000): Promise<boolean> {
  const startTime = Date.now();
  
  // First check - quick
  const firstCheck = await checkServerConnection();
  if (firstCheck) return true;
  
  // If first check fails, wait up to maxWaitMs
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, 1500)); // Check every 1.5s
    const connected = await checkServerConnection();
    if (connected) return true;
  }
  return false;
}

export default { checkServerConnection, waitForConnection };