// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const htmlToImage = require('html-to-image');

// const htmlparser2 = require('htmlparser2');
const puppeteer = require('puppeteer');

const { getLanguageService } = require('vscode-html-languageservice');

const { HoverWebViewPanel } = require("./webview/previewPanel.js")


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

	const disposableHover = vscode.languages.registerHoverProvider("html", {
		async provideHover(document, position, token) {

			// const text = document.getText();
            const offset = document.offsetAt(position);

			const fullTag = getHoverTagContents(offset, document, htmlLanguageService);
			
			if (fullTag){
				console.log("yaa! element");
				// const fullTag = getFullTagContent(node, document);
				console.log("Full tag: ", fullTag)
				
				// return null
				const imgUri = await renderHtmlToImage(fullTag);

				// console.log("Img uri: ", imgUri)

				// const imgSrc = "https://github.com/PaulleDemon/Django-SAAS-Boilerplate/raw/main/railway.png"
				// Include an image in the hover text
				const hoverContent = new vscode.MarkdownString(`<img src='${imgUri}' width='200' height='200' />`);
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
 * @param {number} offset 
 * @param {vscode.TextDocument} document 
 * @param {import('vscode-html-languageservice').LanguageService} htmlLanguageService 
 */

function getHoverTagContents(offset, document, htmlLanguageService){
	const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
	const node = htmlDocument.findNodeAt(offset);

	const startOffset = node.start;
    const endOffset = node.end;
	const text = document.getText();
    let subTags = text.substring(startOffset, endOffset + 1);
	const styleAndScriptTags = [];

	if (subTags){
		// only if there are tags near hover position add the script and styling tags else forget it
		htmlDocument.roots.forEach(root => {
			collectStyleAndScriptTags(root, styleAndScriptTags);
		});

		styleAndScriptTags.forEach(tag => {
			const tagStart = tag.start;
			const tagEnd = tag.end;
			subTags += text.substring(tagStart, tagEnd + 1);
		});
	}

    return subTags;
}

/**
 * Extracts script and link styling tags and adds to the original styleAndScriptTags list
 * 
 * @param {import('vscode-html-languageservice').Node} node 
 * @param {any[]} styleAndScriptTags 
 */
function collectStyleAndScriptTags(node, styleAndScriptTags) {
    if (node.tag === 'link' || node.tag === 'script') {
        styleAndScriptTags.push(node);
    }

    if (node.children) {
        node.children.forEach(child => {
            collectStyleAndScriptTags(child, styleAndScriptTags);
        });
    }
}

async function renderHtmlToImage(html) {
	const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const screenshot = await page.screenshot({ encoding: 'base64' });
    await browser.close();
    return `data:image/png;base64,${screenshot}`;
}


// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
