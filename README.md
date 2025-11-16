# Mock-code-editor

Libraries need to install -

1. For Backend -

A) npm install express cors ws y-websocket
npm install typescript ts-node-dev @types/node @types/express --save-dev
npm install node-fetch@3.3.2
npm install helmet
npm install dotenv
npm install y-websocket --save
npm install --save-dev concurrently
npm install @google/generative-ai



Explaination :
| Library     | Purpose                            |
| ----------- | ---------------------------------- |
| express     | Backend HTTP server                |
| cors        | Allow frontend to connect          |
| ws          | WebSocket server for collaboration |
| y-websocket | Yjs synchronized WebSocket server  |
| typescript  | Type safety                        |
| ts-node-dev | Development auto-reload            |
| @types/*    | Type definitions                   |

B) Initialize type script - npx tsc --init

C) We need to install a version of y-websocket that still exports setupWSConnection - npm install y-websocket@1.4.5

D) Command to run Backend : npm run dev

2. For FrontEnd -

A) npm install -g @angular/cli - ( Need to install the Angular CI first)

B) ng new frontend --style=scss --routing=true
ng new frontend : Creates a new Angular project named frontend
--style=scss : Sets the default stylesheet format for the project to SCSS (Sass) instead of plain CSS
--routing=true : Adds a routing module (app-routing.module.ts) to your project. This makes it easier to configure navigation between different components/pages using Angular’s Router.

C) npm install yjs y-websocket
   npm install codemirror @codemirror/basic-setup @codemirror/lang-javascript @codemirror/autocomplete
   npm install y-codemirror.next
   npm install zone.js

Explaination :
| Library                     | Purpose                                 |
| --------------------------- | --------------------------------------- |
| yjs                         | Shared data structure                   |
| y-websocket                 | Connects Yjs to backend WebSocket       |
| codemirror                  | Core code editor                        |
| @codemirror/basic-setup     | Basic editing features                  |
| @codemirror/lang-javascript | Syntax highlighting                     |
| @codemirror/autocomplete    | Lays foundation for AI completion later |
| y-codemirror.next           | Shows other users' cursors              |

D) ng generate component editor

E) Command to run Frontend : ng serve

