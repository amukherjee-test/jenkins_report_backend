# Jenkins Report Backend

Fetches build reports from Jenkins and stores them as JSON files on disk.

---

## Step 1 — Install dependencies

```bash
npm install
```

---

## Step 2 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in the three values:

```
PORT=3000
JENKINS_URL=http://your-jenkins:8080
JENKINS_USER=your-username
JENKINS_TOKEN=your-api-token
```

### How to get your Jenkins API Token

1. Open Jenkins in your browser and log in
2. Click your name in the top-right corner
3. Click **Configure**
4. Scroll down to **API Token**
5. Click **Add new Token**, give it a name, click **Generate**
6. Copy the token and paste it as `JENKINS_TOKEN` in `.env`

> Use your API token, not your login password.

---

## Step 3 — Start the server

```bash
npm run dev
```

You should see:

```
Server running on port 3000
```

---

## Step 4 — Fetch a report from Jenkins

Send a POST request with the job name and build number:

```bash
curl -X POST http://localhost:3000/api/jenkins/fetch \
  -H "Content-Type: application/json" \
  -d '{"jobName": "my-job", "buildNumber": 5}'
```

**How to find your job name and build number:**
- Open the build in Jenkins — the URL looks like `http://your-jenkins:8080/job/my-job/5/`
- `my-job` is the job name, `5` is the build number

---

## Step 5 — Check the stored files

After a successful fetch, files are saved under the `reports/` folder:

```
reports/
└── my-job/
    └── 5/
        ├── build.json        # build metadata (status, duration, commit, etc.)
        └── test-report.json  # test results (only present if the build ran tests)
```
