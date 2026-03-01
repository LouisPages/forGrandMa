# API For GrandMa

Backend du pipeline agentique (extraction → vulgarisation → validation → questions) et du chat ancré au rapport.

## Lancer le serveur

1. **Variables d'environnement**  
   À la racine du projet, copier `.env.example` en `.env` et renseigner au minimum :
   - `GOOGLE_API_KEY` (pour Gemma 3 27B) ou `OPENAI_API_KEY` (OpenAI ou compatible)

2. **Dépendances**  
   Depuis la racine du projet :
   ```bash
   cd server && npm install
   ```

3. **Démarrage**  
   Depuis la racine du projet :
   ```bash
   npm run dev:server
   ```
   Ou depuis `server/` : `npm start`

   Le serveur écoute sur `http://localhost:3001`. Le frontend Vite (port 8080) proxy `/api` vers ce serveur.

## Endpoints

- `POST /api/report/understand` — Body : `{ reportText: string }` → extraction, vulgarisation, validation, questions
- `POST /api/report/understand-stream` — Même chose, en flux SSE
- `POST /api/chat` — Body : `{ message: string, context: string, history?: { role, text }[] }` → `{ reply: string }`
- `GET /api/health` — Santé du serveur

Aucune donnée n'est persistée (no data leaks).
