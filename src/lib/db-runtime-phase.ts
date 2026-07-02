export function isTestPhase(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.NODE_TEST_CONTEXT) return true;
  if (typeof process !== 'undefined') {
    const runtimeArgs = [...(process.argv ?? []), ...(process.execArgv ?? [])];
    if (runtimeArgs.includes('--test')) return true;
    if (runtimeArgs.some(arg => arg.includes('node:test'))) return true;
    if (runtimeArgs.some(arg => arg.startsWith('--test-'))) return true;
  }
  return false;
}

export function isBuildPhase(): boolean {
  if (process.env.npm_lifecycle_event === 'build') return true;
  if (process.env.NEXT_PHASE === 'phase-production-build') return true;
  if (typeof process !== 'undefined' && process.argv) {
    if (process.argv.some(arg => arg.includes('build') || arg.includes('next-build'))) return true;
  }
  return false;
}

export function isProtectedDbPhase(): boolean {
  return isBuildPhase() || isTestPhase();
}
