const vscode = require('vscode')
const path = require('path')

/**
 * 
 * @param {string} link 
 * @returns 
 */
function isValidHttpUrl(link) {
    let url;
    
    try {
        url = new URL(link);
    } catch (_) {
        console.error("error url")
        return false;
    }

    return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * 
 * @param {string} source 
 * @returns 
 */
function isLocalFile(source){
    return source.indexOf('://') == -1;
}

/**
 * 
 * @param {string} path 
 * @returns 
 */
function isUrlEncodedFile(path){
    return path.startsWith('data:image');
}

function getActiveFilePath(){
    return vscode.window.activeTextEditor.document.uri.fsPath
}

/**
 * converts relative url to absolute rul
 * @param {string} baseUri 
 * @param {string} relativeUrl 
 * @returns 
 */
function toAbsoluteUrl(baseUri, relativeUrl) {
    const base = vscode.Uri.parse(baseUri);
    const absoluteUri = vscode.Uri.joinPath(base, relativeUrl);
    return absoluteUri.fsPath;
}


module.exports = {
    isValidHttpUrl,
    getActiveFilePath,
    toAbsoluteUrl,
    isLocalFile,
    isUrlEncodedFile
};