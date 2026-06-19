pipeline {
    agent any

    environment {
        BACKEND_URL = 'http://your-backend:3000'   // URL of this backend
        API_KEY     = credentials('REPORT_API_KEY') // Jenkins secret text credential
    }

    stages {
        stage('Test') {
            steps {
                // Replace this with your actual test command
                sh 'npm test'
            }
        }
    }

    post {
        always {
            script {
                // 1. Create a run
                def createResp = httpRequest(
                    url: "${BACKEND_URL}/api/runs",
                    httpMode: 'POST',
                    contentType: 'APPLICATION_JSON',
                    customHeaders: [[name: 'X-API-Key', value: "${API_KEY}"]],
                    requestBody: groovy.json.JsonOutput.toJson([
                        jobName    : env.JOB_NAME,
                        buildNumber: env.BUILD_NUMBER as Integer,
                        branch     : env.GIT_BRANCH ?: 'unknown',
                        commitHash : env.GIT_COMMIT ?: '',
                        triggeredBy: currentBuild.getBuildCauses()[0]?.userId ?: 'jenkins',
                        jenkinsUrl : env.BUILD_URL,
                        startedAt  : new Date(currentBuild.startTimeInMillis).toInstant().toString()
                    ])
                )

                def runId = readJSON(text: createResp.content).runId

                // 2. Send each JUnit XML report to the backend
                def xmlFiles = findFiles(glob: '**/test-results/**/*.xml')
                if (xmlFiles.length == 0) {
                    xmlFiles = findFiles(glob: '**/surefire-reports/**/*.xml')
                }

                xmlFiles.each { file ->
                    def xml = readFile(file.path)
                    httpRequest(
                        url: "${BACKEND_URL}/api/runs/${runId}/results",
                        httpMode: 'POST',
                        contentType: 'APPLICATION_XML',
                        customHeaders: [[name: 'X-API-Key', value: "${API_KEY}"]],
                        requestBody: xml
                    )
                }

                // 3. Finish the run
                httpRequest(
                    url: "${BACKEND_URL}/api/runs/${runId}/finish",
                    httpMode: 'PATCH',
                    contentType: 'APPLICATION_JSON',
                    customHeaders: [[name: 'X-API-Key', value: "${API_KEY}"]],
                    requestBody: groovy.json.JsonOutput.toJson([
                        finishedAt: new Date().toInstant().toString()
                    ])
                )
            }
        }
    }
}
