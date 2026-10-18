/** The RoleGate rule of the server (FormAccessService.checkRoleGate): a denied role wins over an allowed one. */
export function roleGateVerdict(allowed: string[], denied: string[], roles: string[]): "GRANTED" | "ROLE_DENIED" | "ROLE_REQUIRED" {
    if (roles.some(r => denied.includes(r))) return "ROLE_DENIED";
    if (allowed.length > 0 && !roles.some(r => allowed.includes(r))) return "ROLE_REQUIRED";
    return "GRANTED";
}
