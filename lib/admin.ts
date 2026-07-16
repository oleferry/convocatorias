// Emails con acceso de administrador (panel de leads). Configurable por env
// ADMIN_EMAILS (separados por comas). Fallback al correo de la cuenta.
// Nota: ADMIN_EMAILS solo llega al bundle en server components/API routes;
// en client components (p.ej. dashboard) esta función siempre usa el fallback
// de abajo, así que para añadir un admin ahí hay que editar ese fallback.
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || 'daniel@gafasvan.com,daniel.paniagua.f@gmail.com')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}
export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase())
}
