// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// const htmlToImage = require('html-to-image');

var HTMLParser = require('node-html-parser');

// const htmlparser2 = require('htmlparser2');
const puppeteer = require('puppeteer');
const { getLanguageService } = require('vscode-html-languageservice');

const { isValidHttpUrl, isLocalFile, getActiveFilePath, toAbsoluteUrl, isUrlEncodedFile } = require("./utils/common.js")
const { HoverWebViewPanel } = require("./webview/previewPanel.js");


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {


	console.log('"Hover preview" is now active!');

	const disposable = vscode.commands.registerCommand('hoverpreview.enablePreview', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello! from HoverPreview!');
	});

	const webviewCommand = vscode.commands.registerCommand("hoverpreview.helloWorld", () => {
		HoverWebViewPanel.render();
	});

	const htmlLanguageService = getLanguageService();

	let browser = null;
	// https://pptr.dev/api/puppeteer.puppeteernodelaunchoptions
	(async () => {
		browser = await puppeteer.launch({
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
		defaultViewport: {
			width: 1800,
			height: 900
		}
	});
	})()
	console.log("WE: ", )

	const disposableHover = vscode.languages.registerHoverProvider("html", {
		async provideHover(document, position, token) {

			// const text = document.getText();
			const offset = document.offsetAt(position);

			const fullTag = getHoverTagContents(offset, document, htmlLanguageService);

			if (fullTag) {
				const baseUri = vscode.workspace.workspaceFolders[0].uri.fsPath;

				const filePath = path.join(baseUri, '.hoverpreview.temp.html');
				fs.writeFileSync(filePath, fullTag, 'utf8'); // create a temp file and write the contents

				const pathUri = vscode.Uri.file(filePath).toString() // adds file:/// eg: file:///home/documents
				const imgUri = await renderHtmlToImage(browser, context, pathUri, fullTag);
				console.log("img uri: ", imgUri.fsPath, imgUri.path)
				fs.unlink(filePath, ()=>{}) // remove the file after rendering
				// Include an image in the hover text
				const hoverContent = new vscode.MarkdownString(`<img src='${imgUri.path}?time=${new Date().getTime()}' alt="rendered preview" width='200' height='200'/>`); // new Date is there to avoid caching and preview new one
				// const hoverContent = new vscode.MarkdownString(fullTag);
				hoverContent.supportHtml = true;
				hoverContent.isTrusted = true;
				// hoverContent.baseUri = vscode.Uri.file(imgSrc)
				return new vscode.Hover(hoverContent);

			}

			return null;
		}
	});

	context.subscriptions.push(disposableHover);
	context.subscriptions.push(disposable);
	context.subscriptions.push(webviewCommand);
}

/**
 * 
 * @param {import('vscode').ExtensionContext} context 
 */
function getGlobalStoragePath(context){
	const globalStoragePath = context.globalStorageUri.fsPath;

    // Ensure the global storage directory exists
    if (!fs.existsSync(globalStoragePath)) {
        fs.mkdirSync(globalStoragePath, { recursive: true });
    }

    return globalStoragePath
}

/**
 * 
 * @param {number} offset 
 * @param {vscode.TextDocument} document 
 * @param {import('vscode-html-languageservice').LanguageService} htmlLanguageService 
 */

function getHoverTagContents(offset, document, htmlLanguageService) {
	const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
	const node = htmlDocument.findNodeAt(offset);
	const baseUri = vscode.workspace.workspaceFolders[0].uri.fsPath;

	// console.log("Base uri: ", baseUri.toString());

	const startOffset = node.start;
	const endOffset = node.end;
	const text = document.getText();
	let subTags = text.substring(startOffset, endOffset + 1);
	const styleAndScriptTags = [];

	if (subTags) {
		// only if there are tags near hover position add the script and styling tags else don't add
		htmlDocument.roots.forEach(root => {
			addStyleAndScriptTags(root, styleAndScriptTags, baseUri.toString());
		});
		styleAndScriptTags.forEach(tag => {
			const tagStart = tag.start;
			const tagEnd = tag.end;
			subTags += text.substring(tagStart, tagEnd + 1);
		});
	}
	// console.log("sub tags: ", updateDocumentWithSrcUrl(subTags, baseUri))

	return subTags;
}


/**
 * 
 * @param {string} text 
 */
function updateDocumentWithSrcUrl(text, baseUri){

	const parseDoc = HTMLParser.parse(text)

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

/**
 * updates all links, img, video paths from relative to absolute uris
 * @param {import('vscode-html-languageservice').Node} node 
 */
function updateLocalUris(node, baseUri){
	
	if (!["img", "link", "script", "video"].includes(node.tag)){
		// check if the elements in the list match and they have either href or src attribute
		return
	}

	if (node.tag === "link" && Object.hasOwn(node.attributes, "href") && isLocalFile(node.attributes.href)){
		console.log("updating uri", vscode.Uri.file(node.attributes.href).toString());
		node.attributes.href = "updated"//toAbsoluteUrl(baseUri, node.attributes.href)
	}else if (Object.hasOwn(node.attributes, "src") && isLocalFile(node.attributes.src) && 
				!isUrlEncodedFile(node.attributes.src)){
		// script tags, img, videos
		node.attributes.src = "Vola"; //toAbsoluteUrl(baseUri, node.attributes.src)
	}

}


/**
 * uses puppeteer and renders html and takes a screenshot
 * @param {puppeteer.Browser} browser 
 * @param {import('vscode').ExtensionContext} context 
 * @param {string|null} htmlFilePath 
 * @param {string|null} html 
 * @returns 
 */
async function renderHtmlToImage(browser, context, htmlFilePath=null, html=null) {
	console.log("Path: ",)

	if (!browser){
		vscode.window.showInformationMessage("Loading Hover preview extension please wait...");
		return
	}

	let page = null;

	if (browser.pages.length === 0){
		page = await browser.newPage();
	}else{
		page = browser.pages[0]
	}
	await page.goto(htmlFilePath)
	// https://stackoverflow.com/questions/62592345/puppeteer-wont-load-images-if-page-is-loaded-using-setcontent
	// await page.setContent(html, { waitUntil:  ["load","networkidle0"] });
	
	// FIXME: file path caching problem

	const tempImagePath = path.join(getGlobalStoragePath(context), `hoverpreview-img.png`);

    // Write the image file (for demo purposes, assuming imageData is a buffer or base64 string)
    // const imageData = '...'; // Your image data here
    // fs.writeFileSync(tempImagePath, imageData, 'base64'); // Use 'base64' if imageData is base64 encoded


	// const imgPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'test.png') 
	// console.log("extension path: ",  tempImagePath)
	// page.addStyleTag({path: "/css/tailwind-build.css"})
	// https://pptr.dev/guides/screenshots/
	const screenshot = await page.screenshot({ 
												// encoding: 'base64', 
												omitBackground: false, 
												path: tempImagePath
											});
	// await browser.close();
	// return `data:image/png;base64,${screenshot}`;
	// return imgPath;
	return vscode.Uri.file(tempImagePath);
}


// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
