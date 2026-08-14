export type MessageSeverity = 'info' | 'success' | 'error'

export type ShowMessage = (message: string, severity?: MessageSeverity) => void
