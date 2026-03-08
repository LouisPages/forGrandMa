# For GrandMa

Votre rapport médical, expliqué simplement.

## Lancement (A à Z)

### 1. Installation
Installez les dépendances à la racine (frontend) et dans le dossier serveur.

```bash
npm install
cd server && npm install && cd ..
```

### 2. Configuration
Créez un fichier `.env` à la racine avec votre clé API Google Gemini :
```env
GOOGLE_API_KEY=votre_cle_ici
```

### 3. Démarrage
Ouvrez deux terminaux :

**Terminal 1 (Backend)** :
```bash
npm run dev:server
```

**Terminal 2 (Frontend)** :
```bash
npm run dev
```
L'application est accessible sur [http://localhost:8080](http://localhost:8080).

---

## Structure du projet

- `src/` : Frontend React (Vite)
  - `components/` : Composants de l'interface (Chat, PDF, Légendes)
  - `pages/Index.tsx` : Page principale
- `server/` : Backend Node.js (Express)
  - `index.js` : Points d'entrée API
  - `pipeline.js` : Logique d'analyse LLM
  - `prompts.js` : Instructions envoyées à l'IA
- `docs/` : Documents et images de test pour la démo
