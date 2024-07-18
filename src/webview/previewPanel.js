const vscode = require('vscode');

class HoverWebViewPanel {
	static currentPanel;
	_panel;
	_disposables = [];

	/**
	 * 
	 * @param {vscode.WebviewPanel} panel 
	 */
	constructor(panel) {
		this._panel = panel;
		this._panel.webview.html = this._getWebviewContent();
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	dispose() {
		HoverWebViewPanel.currentPanel = undefined;

		this._panel.dispose();

		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}

	_getWebviewContent() {
		// Tip: Install the es6-string-html VS Code extension to enable code highlighting below
		return /*html*/ `
		  <!DOCTYPE html>
		  <html lang="en">
			<head>
			  <meta charset="UTF-8">
			  <meta name="viewport" content="width=device-width, initial-scale=1.0">
			  <title>Hello World!</title>
			</head>
			<body>
			  <h1>Hello World! what the heck</h1>
			</body>
		  </html>
		`;
	  }

	static render() {
		if (HoverWebViewPanel.currentPanel) {
			HoverWebViewPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
		} else {
			const panel = vscode.window.createWebviewPanel("hello-world", "Hello World", vscode.ViewColumn.One, {
				// Empty for now
			});

			HoverWebViewPanel.currentPanel = new HoverWebViewPanel(panel);
		}
	}
}


module.exports = { HoverWebViewPanel };