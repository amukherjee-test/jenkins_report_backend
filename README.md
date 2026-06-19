# Jenkins Report Backend

Receives test reports pushed from Jenkins pipelines and stores them in MongoDB.
Handles multiple test suites per build via JUnit XML.

---

## Architecture

```
Jenkins Pipeline (Groovy)
    │
    ├─ POST /api/runs              → create a run
    ├─ POST /api/runs/:id/results  → send JUnit XML (one call per suite/file)
    └─ PATCH /api/runs/:id/finish  → finalize and compute summary
```

---

## Step 1 — Install dependencies

```bash
npm install
```

---

## Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/jenkins-reports
ADMIN_SECRET=change-this-to-a-strong-secret
```

---

## Step 3 — Start the server

```bash
npm run dev
```

---

## Step 4 — Create a project and get an API key

Every Jenkins job needs a project registered in the backend first.
Run this once per project:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: your-admin-secret" \
  -d '{"name": "my-project", "description": "optional"}'
```

Response:
```json
{
  "apiKey": "abc123...",
  "project": { "_id": "...", "name": "my-project" }
}
```

**Save the `apiKey` — it is shown only once.**

---

## Step 5 — Add the API key to Jenkins

1. Go to **Jenkins → Manage Jenkins → Credentials**
2. Add a **Secret text** credential
3. Set the ID to `REPORT_API_KEY` and paste the `apiKey` as the value

---

## Step 6 — Add the Jenkinsfile to your repo

Copy the `Jenkinsfile` from this repo into the root of the project you want to report on.

Update two lines at the top:

```groovy
BACKEND_URL = 'http://your-backend:3000'   // your backend's URL
API_KEY     = credentials('REPORT_API_KEY') // must match the credential ID from Step 5
```

Replace the `sh 'npm test'` line with your actual test command. The pipeline expects JUnit XML output under `**/test-results/**/*.xml` or `**/surefire-reports/**/*.xml`.

---

## Step 7 — Run the pipeline

Trigger a build in Jenkins. After tests finish the pipeline will automatically:

1. Create a run record in the backend
2. Send all JUnit XML files as test results
3. Finalize the run with a pass/fail summary

### Jenkins plugin required

The `Jenkinsfile` uses the **HTTP Request** plugin. Install it at:
**Manage Jenkins → Plugins → Available → HTTP Request**

---

## Deploying the backend to the VM via Jenkins

If you can only access the VM through Jenkins, use `Jenkinsfile.deploy` to install and run the backend directly on the VM. It uses **PM2** to keep the backend alive permanently, including after reboots.

### One-time setup

**1. Add your `.env` as a Jenkins secret file**
- Go to **Jenkins → Manage Jenkins → Credentials**
- Add a **Secret file** credential
- Set the ID to `REPORT_BACKEND_ENV`
- Upload your `.env` file as the content

**2. Create a new Jenkins pipeline job**
- New Item → Pipeline
- Under Pipeline, set:
  - Definition: `Pipeline script from SCM`
  - SCM: Git → your repo URL
  - Script Path: `Jenkinsfile.deploy`

**3. Run the job**

Jenkins will:
1. Clone the repo to `/opt/jenkins-report-backend` on the VM
2. Install dependencies and compile TypeScript
3. Write the `.env` file from the Jenkins secret
4. Install PM2 (if not already installed)
5. Start the backend and register it to survive reboots

### Useful PM2 commands (run on VM or via Jenkins shell)

```bash
pm2 status                          # check if the app is running
pm2 logs jenkins-report-backend     # view live logs
pm2 restart jenkins-report-backend  # restart the app
pm2 stop jenkins-report-backend     # stop the app
```

After the first deploy, re-run the job anytime you want to deploy updates.
