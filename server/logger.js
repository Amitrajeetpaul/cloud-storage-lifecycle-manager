function emit(level, console_fn, args) {
  console_fn(`${new Date().toISOString()} [${level}]`, ...args);
}

export const logger = {
  info: (...args) => emit('INFO', console.log, args),
  warn: (...args) => emit('WARN', console.warn, args),
  error: (...args) => emit('ERROR', console.error, args),
};
