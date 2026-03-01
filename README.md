# For GrandMa

**Votre rapport médical, expliqué simplement.**

Application web qui permet de coller ou d’uploader un rapport médical (PDF ou photo), d’en obtenir une explication vulgarisée et de poser des questions via un chat ancré au contenu du rapport. Aucune donnée n’est stockée ni persistée.

---

## Vue d’ensemble

- **Frontend** : React (TypeScript) + Vite, port **8080**
- **Backend** : API Node.js (Express), port **3001**
- **LLM** : Google Gemini (Gemma 3 27B) par défaut, ou API compatible OpenAI (OpenAI, Ollama, etc.)

Le frontend proxyfie les requêtes `/api` vers le backend. Les deux processus doivent tourner en parallèle pour utiliser l’application.

---

## Installation

### Prérequis

- **Node.js** 18+ (recommandé : LTS)
- **npm** (ou pnpm / yarn)

### 1. Cloner et installer les dépendances

```bash
git clone <url-du-repo>
cd forGrandMa
npm install
cd server && npm install && cd ..
```

Les dépendances sont installées à la **racine** (frontend) et dans **server/** (backend).

### 2. Configuration des variables d’environnement

À la **racine** du projet, créer un fichier `.env` (ou copier `.env.example` s’il existe) avec au minimum :

```env
# Obligatoire : clé Google AI (Gemma 3 27B)
# Créer une clé : https://aistudio.google.com/app/apikey
GOOGLE_API_KEY=votre_cle_google

# Optionnel : port du backend (défaut 3001)
# PORT=3001
```

**Alternative (OpenAI / Ollama)** : commenter ou retirer `GOOGLE_API_KEY` et décommenter :

```env
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Pour Ollama en local : `OPENAI_API_URL=http://localhost:11434/v1` et un `OPENAI_MODEL` adapté.

### 3. Lancer l’application

Ouvrir **deux terminaux** :

**Terminal 1 – Backend**

```bash
npm run dev:server
```

Le serveur API écoute sur `http://localhost:3001`.

**Terminal 2 – Frontend**

```bash
npm run dev
```

L’interface est disponible sur **http://localhost:8080**.

---

## Fonctionnement

### Parcours utilisateur

1. **Document** : l’utilisateur colle le texte du rapport, uploade un PDF ou envoie une photo.
2. **Extraction** : le backend extrait (via LLM) les champs structurés : localisation, type d’examen, faits principaux, termes techniques, conclusion, niveau d’urgence.
3. **Questions de contexte** : selon le type d’examen, des questions optionnelles sont proposées (ex. antécédents, traitements) pour personnaliser l’explication.
4. **Analyse** : à partir de l’extraction (et des réponses contexte si fournies), le pipeline enchaîne :
   - **Vulgarisation** : explication en langage simple
   - **Validation** : garde-fou (OK / à nuancer) pour éviter les interprétations dangereuses
   - **Questions pour le médecin** : suggestions de questions à poser au praticien
5. **Légendes** (optionnel) : si des images d’imagerie (radio, IRM, etc.) sont ajoutées, le backend peut générer des légendes et flèches, et adapter la vulgarisation pour s’y référer.
6. **Chat** : l’utilisateur peut poser des questions ; les réponses sont ancrées au rapport (extraction + vulgarisation) pour rester cohérentes.

Aucune donnée n’est enregistrée : tout est traité en mémoire et non stocké.

### Pipeline backend (côté serveur)

Fichiers principaux :

- **`server/index.js`** : routes Express et entrées API
- **`server/pipeline.js`** : enchaînement Extraction → Vulgarisation → Validation → Questions (avec option contexte patient et flux SSE)
- **`server/llm.js`** : appels LLM (Google Gemini ou API OpenAI-compatible), dont OCR sur image
- **`server/prompts.js`** : prompts système et utilisateur pour extraction, vulgarisation, validation, questions
- **`server/contextQuestions.js`** : questions de contexte par type d’examen
- **`server/legendes.js`** : génération des légendes sur les images
- **`server/adaptVulgarization.js`** : adaptation de la vulgarisation aux libellés de légendes

### API (résumé)

| Méthode | Route | Description |
|--------|--------|-------------|
| GET | `/` | Page d’accueil minimale du serveur |
| GET | `/api/health` | Santé du serveur |
| GET | `/api/test-llm` | Test de l’API LLM |
| GET | `/api/report/context-questions?type_examen=...` | Questions de contexte pour un type d’examen |
| POST | `/api/report/extract` | Extraction seule (`reportText`) → `extraction` + `contextQuestions` |
| POST | `/api/report/understand` | Pipeline complet en une fois (`reportText`) |
| POST | `/api/report/understand-stream` | Même pipeline en flux SSE (avec option `extraction` + `patientContext`) |
| POST | `/api/chat` | Réponse chat (`message`, `context`, `history` optionnel) |
| POST | `/api/report/legendes` | Légendes sur une image (`image` base64, `extraction`) |
| POST | `/api/report/adapt-vulgarization` | Adaptation de la vulgarisation aux libellés de légendes |
| POST | `/api/report/ocr` | OCR sur une image (`image` base64) → `text` |

### Frontend (structure)

- **`src/pages/Index.tsx`** : page principale ; orchestration upload PDF/photo, extraction, questions de contexte, lancement du pipeline en stream, légendes, chat.
- **`src/components/PdfViewer.tsx`** : zone de dépôt / collage de texte, affichage PDF ou image, déclenchement de l’extraction et envoi des images pour légendes.
- **`src/components/LeftPanel.tsx`** : panneau gauche (document + éventuelles images légendées).
- **`src/components/ChatPanel.tsx`** : formulaire des questions de contexte, bouton d’analyse, affichage vulgarisation + questions pour le médecin, chat.
- **`src/components/ReportExplanationPanel.tsx`** : affichage du résultat (vulgarisation, questions).
- **`src/components/ImageWithLegends.tsx`** : affichage d’une image avec légendes et flèches.

Le frontend utilise `VITE_API_URL` (vide par défaut = même origine) pour les appels API ; en dev, le proxy Vite envoie `/api` vers `http://localhost:3001`.

---

## Scripts disponibles (racine)

| Script | Commande | Description |
|--------|----------|-------------|
| `dev` | `npm run dev` | Lance Vite (frontend) sur le port 8080 |
| `dev:server` | `npm run dev:server` | Lance le serveur API (Node) sur le port 3001 |
| `build` | `npm run build` | Build de production du frontend |
| `build:dev` | `npm run build:dev` | Build en mode development |
| `preview` | `npm run preview` | Prévisualisation du build frontend |
| `lint` | `npm run lint` | Lint ESLint |
| `test` | `npm run test` | Lance les tests (Vitest) |

---

## Résumé technique

- **Pas de base de données** : tout est en mémoire, aucune persistance des rapports ou conversations.
- **Deux processus** : frontend (Vite) et backend (Express) à lancer séparément.
- **Un seul `package.json` à la racine** pour le frontend ; **`server/package.json`** pour l’API.
- **Variables sensibles** : ne jamais commiter `.env` ; garder `GOOGLE_API_KEY` (ou `OPENAI_*`) hors du dépôt.

Pour plus de détails sur l’API seule, voir **`server/README.md`**.
