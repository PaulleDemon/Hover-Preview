const vscode = require('vscode');
const path = require('path');
const HTMLParser = require('node-html-parser');

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


function getActiveFilePath(){
    return vscode.window.activeTextEditor.document.uri.fsPath;
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

/**
 * given relative paths of link, img, video, updates to absolute paths
 * @param {string} text 
 */
function updateDocumentWithSrcUrl(text, baseUri){

	const parseDoc = HTMLParser.parse(text);

	parseDoc.querySelectorAll("link").forEach((ele) => {
		const href = ele.getAttribute("href");

		if (href && isLocalFile(href)){
			ele.setAttribute("href",  toAbsoluteUrl(baseUri, href));//vscode.Uri.file(href).toString());
		}
	});

	parseDoc.querySelectorAll("img, script, video").forEach((ele) => {
		const src = ele.getAttribute("src");
		
		if (src && isLocalFile(src)){
			ele.setAttribute("src", toAbsoluteUrl(baseUri, src));
		}
	});

	return parseDoc.toString()
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
    isValidHttpUrl,
    getActiveFilePath,
    toAbsoluteUrl,
    isLocalFile,
    getRandomInt
};