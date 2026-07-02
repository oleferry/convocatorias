// Emails con acceso de administrador (panel de leads). Configurable por env
// ADMIN_EMAILS (separados por comas). Fallback al correo de la cuenta.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || 'daniel@gafasvan.com,daniel.paniagua.f@gmail.com')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}
export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase())
}
