/** One-line JSON logs on stderr, so they stay readable and can be shipped later without changes. */

function write(level, message, context) {
  const entry = { time: new Date().toISOString(), level, message, ...context };
  if (context?.error instanceof Error) {
    entry.error = { message: context.error.message, stack: context.error.stack };
  }
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export function createLogger({ silent = false } = {}) {
  const log = (level) => (message, context = {}) => { if (!silent) write(level, message, context); };
  return Object.freeze({ info: log('info'), warn: log('warn'), error: log('error') });
}
