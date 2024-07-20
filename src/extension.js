
// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

const  HTMLParser = require('node-html-parser');

const puppeteer = require('puppeteer');
const { getLanguageService } = require('vscode-html-languageservice');

const { rmFilesExcept } = require('./utils/helper.js');


let browser = null; // puppeteer browser instance
const imgDir = '.tmp-img'; // temp img directory



/**
 * This method is called when your extension is activated
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	
	if (!fs.existsSync(path.join(getGlobalStoragePath(context), imgDir))){
		// create a temp directory in global storage to store temp img files
		fs.mkdirSync(path.join(getGlobalStoragePath(context), imgDir));
	}

	console.log('"Hover preview" is now active!');

	const disposable = vscode.commands.registerCommand('hoverpreview.hello', function () {
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello 👋 from HoverPreview!');
	});

	const htmlLanguageService = getLanguageService();

	// https://pptr.dev/api/puppeteer.puppeteernodelaunchoptions
	puppeteer.launch({
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
		defaultViewport: {
			width: 1800,
			height: 900
		}
	}).then(browserObj => {
		// You can use the `browser` object here
		browser = browserObj;
		vscode.window.showInformationMessage('HoverPreview is now ready!');

	}).catch(error => {
		console.error('Error launching Puppeteer:', error);
		vscode.window.showErrorMessage("Hover preview error launching puppeteer");
	});

	const disposableHover = vscode.languages.registerHoverProvider("html", {
		async provideHover(document, position, token) {

			// const text = document.getText();
			const offset = document.offsetAt(position);

			const fullTag = getHoverTagContents(offset, document, htmlLanguageService);

			if (fullTag) {
				// const baseUri = vscode.workspace.workspaceFolders[0].uri.fsPath;// this gets the current working folder
				const currentFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;

				if (!currentFilePath){
					vscode.window.showErrorMessage("No open html file");
					return;
				}

				const baseUri = vscode.Uri.file(path.resolve(currentFilePath, "..")).fsPath; // get the active working directory

				const filePath = path.join(baseUri, '.hoverpreview.temp.html');
				fs.writeFileSync(filePath, fullTag, 'utf8'); // create a temp file and write the contents

				const pathUri = vscode.Uri.file(filePath).toString(); // adds file:/// eg: file:///home/documents
				
				const imgUri = await renderHtmlToImage(browser, context, pathUri);

				fs.unlink(filePath, ()=>{}); // remove the temp file after rendering
			
				// Include an image in the hover text
				// const hoverContent = new vscode.MarkdownString(`<img src='${imgUri}' alt="rendered preview" width='200' height='200'/>`); // new Date is there to avoid caching and preview new one
				const hoverContent = new vscode.MarkdownString(`![preview](${imgUri}|width=200|height=200)`); // new Date is there to avoid caching and preview new one
				// hoverContent.supportHtml = true;
				hoverContent.isTrusted = true;
				hoverContent.baseUri = imgUri;
				
				return new vscode.Hover(hoverContent);

			}

			return null;
		}
	});

	context.subscriptions.push(disposableHover);
	context.subscriptions.push(disposable);
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

    return globalStoragePath;
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

	const startOffset = node.start;
	const endOffset = node.end;

	const htmlText = document.getText();
	let subTags = htmlText.substring(startOffset, endOffset + 1);

	if (subTags) {
		// only if there are tags near hover position add the script and styling tags else don't add
		subTags += extractStyleScriptTags(htmlText);
	}
	// console.log("sub tags: ", subTags)

	return subTags;
}


/**
 * returns link and style tags
 * @param {string} document 
 */
function extractStyleScriptTags(document){

	const parsedHtml = HTMLParser.parse(document);
	const tags = parsedHtml.querySelectorAll("link, script");

	return tags.join("\n");
}


/**
 * uses puppeteer and renders html and takes a screenshot
 * @param {puppeteer.Browser} browser 
 * @param {import('vscode').ExtensionContext} context 
 * @param {string|null} htmlFilePath 
 * @returns 
 */
async function renderHtmlToImage(browser, context, htmlFilePath=null) {

	if (!browser){
		vscode.window.showInformationMessage("Loading Hover preview extension please wait...");
		return null;
	}

	let page = null;

	if (browser.pages.length === 0){
		page = await browser.newPage();
	}else{
		page = browser.pages[0];
		page.reload();
	}
	await page.goto(htmlFilePath);
	// https://stackoverflow.com/questions/62592345/puppeteer-wont-load-images-if-page-is-loaded-using-setcontent
	// await page.setContent(html, { waitUntil:  ["load","networkidle0"] });
	// page.addStyleTag({path: "/css/tailwind-build.css"})
	
	// NOTE: to avoid file path caching problem, we'll create a new file every time a SS is taken
	const fileName = `hover-preview-${new Date()}.jpg`;

	const tempImagePath = path.join(getGlobalStoragePath(context), imgDir, fileName);

	rmFilesExcept(path.join(getGlobalStoragePath(context), imgDir), fileName); // empty the tmp directory to avoid using up storage
	
	// https://pptr.dev/guides/screenshots/
	await page.screenshot({ 
							// encoding: 'base64', 
							omitBackground: false, 
							path: tempImagePath
						});

	// return `data:image/png;base64,${screenshot}`;
	// return imgPath;
	// return vscode.Uri.file(tempImagePath);
	return vscode.Uri.file(tempImagePath);
}


// This method is called when your extension is deactivated
function deactivate() {
	if (browser){
		browser.close();
	}
 }

module.exports = {
	activate,
	deactivate
}
