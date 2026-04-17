/**
 * Connection check with retry - more resilient to network hiccups
 */
export async function checkServerConnection(): Promise<boolean> {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://168.144.46.137:8080';
  
  // Try up to 2 times with a 5 second timeout each
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${apiUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      if (response.ok) return true;
      
      // If first attempt failed but we have retries left, wait a bit
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch {
      // If first attempt failed but we have retries left, wait a bit
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  return false;
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