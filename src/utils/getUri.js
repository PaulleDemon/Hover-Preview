
const { Uri } = require("vscode")

/**
 * 
 * @param {import("vscode").Webview} webview 
 * @param {Uri} extensionUri 
 * @param {string[]} pathList 
 * @returns 
 */
export function getUri(webview, extensionUri, pathList) {
    return webview.asWebviewUri(Uri.joinPath(extensionUri, ...pathList));
}