**README**

**This is how the Project File Structure looks like :** 

Mock-code-editor/

│

├── frontend/               \# Angular App (UI \+ CodeMirror)

│   └── src/app/editor/     \# Editor component (TS/HTML/SCSS)

│

└── backend/                \# Node.js Server (Gemini API \+ y-websocket)

    ├── server.js

    ├── package.json

    └── .env


**Here's the installation and set up guide :**

**Pre Requisite :** VS Studio Code, Node.js

**Backend Setup (Node.js) \-**

**A. Install dependencies**:

npm install express cors ws y-websocket

npm install typescript ts-node-dev @types/node @types/express \--save-dev

npm install node-fetch@3.3.2

npm install helmet dotenv

npm install y-websocket \--save

npm install @google/generative-ai

npm install \--save-dev concurrently

npx tsc \--init (For Initialize TypeScript)

npm install y-websocket@1.4.5 (Required because newer versions removed setupWSConnection)

**B. Configure environment variables:**

Create a file: backend/.env

Add: GEMINI\_API\_KEY=YOUR\_KEY\_HERE

Note : API key can be generated at- https://ai.google.dev/gemini-api

**C. Command to run backend : npm run dev**

Backend runs:

	REST API: http://localhost:3000

	Collaboration WS: ws://localhost:1234

**Frontend Setup (Angular) \-**

A. Install Angular CLI \- npm install \-g @angular/cli

B. Create Angular Project \- ng new frontend \--style=scss \--routing=true

C. Install editor \+ collaboration libraries:

npm install yjs y-websocket

npm install codemirror @codemirror/basic-setup @codemirror/lang-javascript @codemirror/autocomplete

npm install y-codemirror.next

npm install zone.js

ng generate component editor (Create Editor Component)

D. Command to run backend : ng serve

**How the Components Work Together:**

1\. Frontend (Angular \+ CodeMirror):

Loads EditorView inside \#editorContainer

Applies extensions: basicSetup, javascript(), autocompletion(), yCollab()

Sends code \+ cursor position → backend → Gemini API

Renders suggestions inside CodeMirror autocomplete popup

2\. Backend (Node.js):

Hosts a REST autocomplete endpoint

Forwards requests to Gemini API

Returns structured suggestion list

Hosts Y-WebSocket server for real-time sync

3\. Gemini API"

Backend calls:

Model: gemini-2.5-pro

Prompt includes:

Current code

Cursor context

Output constraints

Gemini returns code suggestions → backend → Angular → CodeMirror UI.

**Prompt Engineering (used for Gemini Completion):**

My server constructs a prompt like:

Provide 5 code completion suggestions based on the code and cursor location.

Code:
<full code>

Cursor:
<cursor position>

Return only suggestions as plain text list.


Design goals:

✔ Ensure suggestions are short
✔ Avoid natural language
✔ Generate syntactically-correct JS snippets
✔ Backend parses them into an array

**Parsing Gemini Response → CodeMirror Completions**

Backend:

Receives Gemini JSON

Extracts suggestions into:

{
  "suggestions": [
    "function myFunc() {}",
    "console.log()",
    ...
  ]
}

Note : We can modify suggestions to provide more accurate results

Frontend:

Converts them into CodeMirror completion objects:

{
  label: s,
  type: "keyword",
  apply: s
}

CodeMirror:

Displays dropdown

Inserts selected suggestion into editor

**Testing Collaboration \+ AI Features:**

1. Start backend:

npm run dev

2. Start frontend:

ng serve

3. Open two browser windows:

[http://localhost:4200?room=demo](http://localhost:4200?room=demo)

[http://localhost:4200?room=demo](http://localhost:4200?room=demo) 

Type in one → changes appear in the other instantly

Similarly for AI Completion, type something eg: for and observe the suggestions

**Thank you**

