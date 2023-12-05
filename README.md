# QuickInput Sample with Quick Create Implemented (per issue #196580)

This extension implements the quick create feature:
When you use the quickOpen feature (“ctrl” + “P”) to search for a path that doesn’t exist, displaying “no matching results” was the end of the conversation. Is it requested to add a feature: when a path doesn’t exist, a prompt appears and suggests you to hit enter to create this file. 


# How to run locally

- Run `npm install` in terminal to install dependencies
- Run the `Run Extension` target in the Debug View. This will:
	- Start a task `npm: watch` to compile the code
	- Run the extension in a new VS Code window
