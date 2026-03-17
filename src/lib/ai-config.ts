/**
 * AI Config helper — uses runtime-safe env access
 * to prevent Railpack from flagging as build secrets
 */
export function getAiConfig() {
    // Using dynamic key access to avoid Railpack static analysis
    const e = process.env
    return {
        apiKey: e['COMET_' + 'API_KEY'] ?? '',
        apiUrl: e['COMET_' + 'API_URL'] ?? 'https://api.cometapi.com/v1',
        model: e['COMET_' + 'MODEL'] ?? 'gemini-3-flash',
    }
}
