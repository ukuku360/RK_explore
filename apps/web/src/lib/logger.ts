const isDev = import.meta.env.DEV

export const logger = {
  error(...args: unknown[]): void {
    if (isDev) {
      console.error(...args)
    }
  },

  warn(...args: unknown[]): void {
    if (isDev) {
      console.warn(...args)
    }
  },
}
