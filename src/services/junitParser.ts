import xml2js from 'xml2js';

export interface TestCaseResult {
  suiteName: string;
  testName: string;
  testKey: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  durationMs: number;
  errorMessage: string;
  stackTrace: string;
  stdOut: string;
  stdErr: string;
}

export async function parseJUnit(xmlString: string): Promise<TestCaseResult[]> {
  const parser = new xml2js.Parser({ explicitArray: true, trim: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await parser.parseStringPromise(xmlString);

  const testCases: TestCaseResult[] = [];

  const root = result.testsuites || result;
  const suites: any[] = root.testsuite
    ? Array.isArray(root.testsuite)
      ? root.testsuite
      : [root.testsuite]
    : root.testsuites?.testsuite || [];

  for (const suite of suites) {
    const suiteName: string = suite.$.name || 'Unknown Suite';
    const cases: any[] = suite.testcase || [];

    for (const tc of cases) {
      const attr = tc.$ || {};
      const testName: string = attr.name || 'Unknown Test';
      const durationMs: number = attr.time ? Math.round(parseFloat(attr.time) * 1000) : 0;

      let status: TestCaseResult['status'] = 'passed';
      let errorMessage = '';
      let stackTrace = '';

      if (tc.failure?.length) {
        status = 'failed';
        errorMessage = tc.failure[0].$.message || tc.failure[0]._ || '';
        stackTrace = tc.failure[0]._ || '';
      } else if (tc.error?.length) {
        status = 'error';
        errorMessage = tc.error[0].$.message || tc.error[0]._ || '';
        stackTrace = tc.error[0]._ || '';
      } else if (tc.skipped?.length) {
        status = 'skipped';
      }

      testCases.push({
        suiteName,
        testName,
        testKey: `${suiteName}::${testName}`,
        status,
        durationMs,
        errorMessage,
        stackTrace,
        stdOut: tc['system-out']?.[0] || '',
        stdErr: tc['system-err']?.[0] || '',
      });
    }
  }

  return testCases;
}
