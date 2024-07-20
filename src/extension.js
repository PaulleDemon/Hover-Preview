// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const {v4} = require('uuid')

// const htmlToImage = require('html-to-image');

var HTMLParser = require('node-html-parser');

// const htmlparser2 = require('htmlparser2');
const puppeteer = require('puppeteer');
const { getLanguageService } = require('vscode-html-languageservice');

let browser = null;

const imgDir = '.tmp-img'


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

	const disposable = vscode.commands.registerCommand('hoverpreview.enablePreview', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello! from HoverPreview!');
	});

	const htmlLanguageService = getLanguageService();

	// let browser = null;
	// https://pptr.dev/api/puppeteer.puppeteernodelaunchoptions
	puppeteer.launch({
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
		defaultViewport: {
			width: 1800,
			height: 900
		}
	}).then(bwr => {
		// You can use the `browser` object here
		browser = bwr
	}).catch(error => {
		console.error('Error launching Puppeteer:', error);
		vscode.window.showErrorMessage("Hover preview error launching puppeteer")
	});

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
				// const id = v4()
				// imgUri.with({query: `id=${id}`})

				fs.unlink(filePath, ()=>{}) // remove the file after rendering
				
				const imgPath = `${imgUri.path}`
				console.log("img uri: ", imgPath)

				// Include an image in the hover text
				// const hoverContent = new vscode.MarkdownString(`<img src='${imgUri}' alt="rendered preview" width='200' height='200'/>`); // new Date is there to avoid caching and preview new one
				const hoverContent = new vscode.MarkdownString(`![preview](${imgUri}|width=200|height=200)`); // new Date is there to avoid caching and preview new one
				// hoverContent.supportHtml = true;
				hoverContent.isTrusted = true;
				// hoverContent.value = imgUri.query;
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
 * uses puppeteer and renders html and takes a screenshot
 * @param {puppeteer.Browser} browser 
 * @param {import('vscode').ExtensionContext} context 
 * @param {string|null} htmlFilePath 
 * @param {string|null} html 
 * @returns 
 */
async function renderHtmlToImage(browser, context, htmlFilePath=null, html=null) {

	if (!browser){
		vscode.window.showInformationMessage("Loading Hover preview extension please wait...");
		return
	}

	let page = null;

	if (browser.pages.length === 0){
		page = await browser.newPage();
	}else{
		page = browser.pages[0]
		page.reload()
	}
	await page.goto(htmlFilePath)
	// https://stackoverflow.com/questions/62592345/puppeteer-wont-load-images-if-page-is-loaded-using-setcontent
	// await page.setContent(html, { waitUntil:  ["load","networkidle0"] });
	
	// NOTE: to avoid file path caching problem, well use write files with 
	
	const tempImagePath = path.join(getGlobalStoragePath(context), imgDir, `hover-preview-${new Date()}.jpg`);
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
	// return vscode.Uri.file(tempImagePath).with({query: `id=${v4()}`});
	return vscode.Uri.file(tempImagePath);
}


// This method is called when your extension is deactivated
function deactivate() {
	if (browser){
		browser.close()
	}
 }

module.exports = {
	activate,
	deactivate
}
