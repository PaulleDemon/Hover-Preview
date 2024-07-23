const vscode = require('vscode');
const path = require('path');
const HTMLParser = require('node-html-parser');

const fs = require('fs');

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

	return parseDoc.toString();
}


/**
 * asynchronously removes all file from a directory except the exception file
 * @param {string} dir - directory name
 * @param {string} exceptionFile - file name
 */
function rmFilesExcept(dir, exceptionFile){

    fs.readdir(dir, (err, files) => {
        if (err) throw err;
      
        for (const file of files) {

            if (file === exceptionFile)
                continue

            fs.unlink(path.join(dir, file), (err) => {
                if (err) throw err;
            });
        }
    });

}

/**
 * emptys the directory
 * @param {string} dir - directory path 
 */
function rmDirFiles(dir){
    fs.readdir(dir, (err, files) => {
        if (err) throw err;
      
        for (const file of files) {
            fs.unlink(path.join(dir, file), (err) => {
                if (err) throw err;
            });
        }
    });
}


/**
 * returns the configuration from settings.json file
 * @param {string} key 
 * @param {any} defaultValue, - if key not found whats the default it should return 
 */
function getConfiguration(key, defaultValue){
    let configuration = vscode.workspace.getConfiguration('hoverPreview');
    return configuration.get(key, defaultValue);
}


/**
 * Extracts script and link styling tags and adds to the original styleAndScriptTags list
 * This is necessary to render the page with styles applied. If the path is relative then its 
 * converted to absolute path
 * @param {import('vscode-html-languageservice').Node} node 
 * @param {any[]} styleAndScriptTags 
 * @param {string} baseUri  
 */
function addStyleAndScriptTags(node, styleAndScriptTags, baseUri) {
	// console.log("root: ", node.tag)

	if (node.tag === 'link' || node.tag === 'script') {
		styleAndScriptTags.push(node);
	}

	if (node.children) {
		node.children.forEach(child => {
			addStyleAndScriptTags(child, styleAndScriptTags, baseUri);
		});
	}
}

module.exports = {
    rmDirFiles,
    rmFilesExcept,
    getConfiguration
};