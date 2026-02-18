# Guide de Test — Extension VS Code chainskills

## Prérequis

✅ **Complétés** :

- CLI chainskills compilé et lié globalement (`npm link`)
- Extension compilée avec succès (dist/extension.js - 23 KB)
- Workflow de test créé (test-workflow.workflow.md)

## Test Rapide (5 minutes)

### 1. Lancer l'Hôte de Développement d'Extension

```bash
cd /home/TheWatcher01/projects/chainskills/vscode
```

Dans VS Code :

1. Appuyez sur **F5** (ou Exécuter > Démarrer le débogage)
2. Une nouvelle fenêtre "Extension Development Host" s'ouvrira
3. L'extension est maintenant active dans cette fenêtre

### 2. Vérifier l'Installation

Dans la fenêtre Extension Development Host :

**Vérification 1 : Coloration Syntaxique**

- Ouvrir `test-workflow.workflow.md`
- Vérifier que les directives sont colorées (`@env`, `@if`, `@else`, `@output`)
- Vérifier que les variables sont colorées (`$target`, `$result`, `$TARGET`)

**Vérification 2 : TreeView**

- Ouvrir l'Explorateur (Ctrl+Shift+E)
- Chercher la vue "CHAINSKILLS WORKFLOWS" en bas
- Devrait afficher : test-workflow (v1.0.0)
- Cliquer pour ouvrir le fichier

**Vérification 3 : Commandes (Palette de Commandes - Ctrl+Shift+P)**

- Taper "chainskills"
- Devrait voir 10 commandes :
  - chainskills: Run Workflow
  - chainskills: Run Workflow (Dry Run)
  - chainskills: Validate Workflow
  - chainskills: Inspect Workflow DAG
  - chainskills: Pause Execution
  - chainskills: Resume Execution
  - chainskills: Stop Execution
  - chainskills: Step Through Execution
  - chainskills: Browse Workflow Templates
  - chainskills: Refresh Workflows

**Vérification 4 : Barre d'Outils Éditeur**

- Ouvrir `test-workflow.workflow.md`
- Regarder la barre d'outils de l'éditeur (en haut à droite)
- Devrait voir 3 icônes :
  - ▶️ Run Workflow
  - ✓ Validate Workflow
  - 📊 Inspect Workflow DAG

### 3. Tester les Fonctionnalités Principales

#### Test de Validation

1. Ouvrir `test-workflow.workflow.md`
2. Cliquer sur l'icône ✓ dans la barre d'outils (ou Ctrl+Shift+P > "chainskills: Validate Workflow")
3. Vérifier le panneau **Problèmes** (Affichage > Problèmes)
4. Devrait afficher : "Workflow validated successfully" (ou erreurs le cas échéant)

#### Test d'Inspection DAG

1. Avec `test-workflow.workflow.md` ouvert
2. Cliquer sur l'icône 📊 (ou exécuter "Inspect Workflow DAG")
3. Vérifier le panneau **Sortie** (Affichage > Sortie, sélectionner "chainskills DAG")
4. Devrait afficher le DAG ASCII :
   ```
   ┌─────────────────────┐
   │ test-workflow       │
   └─────────────────────┘
           │
           ▼
   ┌─────────────────────┐
   │ Step 1: Initialize  │
   └─────────────────────┘
           │
           ▼
   ┌─────────────────────┐
   │ Step 2: Execute Test│
   └─────────────────────┘
           │
           ▼
   ┌─────────────────────┐
   │ Step 3: Output      │
   └─────────────────────┘
   ```

#### Test d'Exécution (Simulation)

1. Avec `test-workflow.workflow.md` ouvert
2. Exécuter la commande : "chainskills: Run Workflow (Dry Run)"
3. Vérifier le panneau **Sortie** (sélectionner "chainskills")
4. Devrait afficher :
   ```
   Running workflow: test-workflow.workflow.md
   [DRY RUN] Workflow executed successfully
   ```

#### Test d'Exécution (Réelle)

1. Avec `test-workflow.workflow.md` ouvert
2. Cliquer sur l'icône ▶️ (ou exécuter "chainskills: Run Workflow")
3. Entrer l'entrée : `target=example.com`
4. Vérifier le panneau **Sortie**
5. Devrait afficher :
   - Logs d'exécution des étapes
   - Substitutions de variables
   - Sortie finale

### 4. Tester les Interactions TreeView

1. Dans l'Explorateur, trouver "CHAINSKILLS WORKFLOWS"
2. Clic droit sur test-workflow
3. Le menu contextuel devrait afficher :
   - Run Workflow
   - Run Workflow (Dry Run)
   - Validate Workflow
   - Inspect Workflow DAG

### 5. Tester la Configuration

1. Ouvrir les Paramètres (Ctrl+,)
2. Rechercher "chainskills"
3. Devrait voir 5 paramètres :
   - **CLI Path** : chainskills (par défaut)
   - **Executor** : mastra (liste déroulante : simple | mastra)
   - **Auto Validate** : true (case à cocher)
   - **Show DAG on Inspect** : true (case à cocher)
   - **Templates Path** : (chaîne vide)

## Suite de Tests Complète (15 minutes)

### Test 1 : Auto-Validation à la Sauvegarde

1. Ouvrir `test-workflow.workflow.md`
2. S'assurer que "Auto Validate" est activé dans les paramètres
3. Ajouter une erreur de syntaxe : `@invalid_directive`
4. Sauvegarder (Ctrl+S)
5. **Attendu** : Le panneau Problèmes affiche l'erreur immédiatement

### Test 2 : Observateur de Fichiers

1. Créer un nouveau fichier : `new-workflow.workflow.md`
2. Ajouter un frontmatter minimal :

   ```yaml
   ---
   name: new-workflow
   version: 1.0.0
   ---
   # Étape 1

   Test
   ```

3. Sauvegarder
4. **Attendu** : La TreeView se rafraîchit et affiche new-workflow

### Test 3 : Contrôle d'Exécution (nécessite un workflow long)

Créer `long-workflow.workflow.md` :

```markdown
---
name: long-workflow
version: 1.0.0
---

# Étape 1

@repeat max:10 until false:
Étape de longue durée...
```

1. Exécuter le workflow
2. Pendant l'exécution, cliquer sur le bouton **Pause** dans la barre d'état
3. **Attendu** : Processus mis en pause (SIGSTOP)
4. Cliquer sur **Resume**
5. **Attendu** : L'exécution continue
6. Cliquer sur **Stop**
7. **Attendu** : Processus terminé (SIGTERM)

### Test 4 : Navigateur de Templates

1. Définir `chainskills.templatesPath` à `/home/TheWatcher01/projects/chainskills/cli-mcp-core/templates`
2. Exécuter "chainskills: Browse Workflow Templates"
3. Devrait afficher 5 templates :
   - Code Review
   - TDD Cycle
   - Domain Reconnaissance
   - Vulnerability Scan
   - Grant Application
4. En sélectionner un
5. **Attendu** : Ouvre le fichier template

### Test 5 : Intégration Problem Matcher

1. Créer `.vscode/tasks.json` dans l'espace de travail Extension Development Host :
   ```json
   {
     "version": "2.0.0",
     "tasks": [
       {
         "label": "Run Workflow",
         "type": "shell",
         "command": "chainskills",
         "args": ["run", "${file}", "--format=vscode"],
         "problemMatcher": "$chainskills"
       }
     ]
   }
   ```
2. Ouvrir un workflow avec des erreurs
3. Exécuter la tâche : Terminal > Exécuter la tâche > "Run Workflow"
4. **Attendu** : Erreurs dans le panneau Problèmes avec liens cliquables

## Déboguer le Code de l'Extension

Pour déboguer le code TypeScript de l'extension :

1. Définir des points d'arrêt dans `src/extension.ts`, `src/commands.ts`, etc.
2. Appuyer sur F5 pour lancer l'Extension Development Host
3. Déclencher le chemin de code (ex : exécuter une commande)
4. Le débogueur se mettra en pause aux points d'arrêt
5. Inspecter les variables, parcourir le code

## Empaqueter l'Extension pour Distribution

```bash
cd /home/TheWatcher01/projects/chainskills/vscode
npm run package
```

Cela crée : `chainskills-vscode-0.4.0.vsix`

Installation manuelle :

```bash
code --install-extension chainskills-vscode-0.4.0.vsix
```

## Dépannage

### L'extension ne s'active pas

**Vérifier** : Panneau Sortie > "Extension Host"
**Chercher** : "chainskills extension is now active"

### Les commandes n'apparaissent pas

**Vérifier** : `package.json` > `activationEvents`
**S'assurer** : `onLanguage:markdown` ou `workspaceContains:**/*.workflow.md`

### TreeView vide

**Vérifier** : Y a-t-il des fichiers `.workflow.md` dans l'espace de travail ?
**Déboguer** : Définir un point d'arrêt dans `WorkflowTreeProvider.getChildren()`

### CLI introuvable

**Vérifier** : Paramètres > chainskills.cliPath
**Vérifier** : Exécuter `which chainskills` dans le terminal
**Corriger** : Exécuter `npm link` dans le dépôt chainskills

### La coloration syntaxique ne fonctionne pas

**Vérifier** : `syntaxes/workflow.tmLanguage.json` enregistré dans `package.json`
**Vérifier** : Le langage du fichier est "Workflow Markdown" (barre d'état en bas à droite)

## Checklist de Test

- [ ] L'extension s'active sans erreurs
- [ ] TreeView affiche les workflows dans l'Explorateur
- [ ] Coloration syntaxique pour les directives et variables
- [ ] 10 commandes apparaissent dans la Palette de Commandes
- [ ] La commande Validate affiche les erreurs dans le panneau Problèmes
- [ ] La commande Inspect affiche le DAG dans le panneau Sortie
- [ ] La commande Run exécute le workflow
- [ ] Le dry run simule l'exécution
- [ ] La barre d'outils affiche 3 icônes
- [ ] Le menu contextuel TreeView fonctionne
- [ ] L'auto-validation à la sauvegarde se déclenche
- [ ] L'observateur de fichiers rafraîchit l'arbre
- [ ] Le navigateur de templates ouvre les templates
- [ ] Les paramètres de configuration persistent
- [ ] Le Problem Matcher analyse les erreurs

## Prochaines Étapes

Après des tests réussis :

1. **Commiter Phase 2** : Commit git du squelette d'extension
2. **Mettre à jour ROADMAP.md** : Marquer Phase 2 comme complétée
3. **Planification Phase 3** : Panneaux Webview (visualiseur DAG, moniteur d'exécution)
4. **Planification Phase 4** : Intégration Copilot Chat (participant @chainskills)
