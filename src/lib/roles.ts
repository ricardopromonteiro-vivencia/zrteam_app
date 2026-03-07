// ============================================================
// Utilitário de roles - centraliza as verificações de permissão
// Qualquer futura alteração de roles basta ser feita aqui.
// ============================================================

/** Roles com acesso de professor (professor normal e responsável) */
export const PROFESSOR_ROLES = ['Professor', 'Professor Responsável'] as const;

/** Roles com acesso de gestão (admin, professor e professor responsável) */
export const MANAGEMENT_ROLES = ['Admin', 'Professor', 'Professor Responsável'] as const;

/** Verifica se um role tem privilégios de professor */
export function isProfessor(role: string | undefined | null): boolean {
    return PROFESSOR_ROLES.includes(role as any);
}

/** Verifica se um role tem privilégios de gestão (admin ou professor) */
export function canManage(role: string | undefined | null): boolean {
    return MANAGEMENT_ROLES.includes(role as any);
}

/** Verifica se é Admin */
export function isAdmin(role: string | undefined | null): boolean {
    return role === 'Admin';
}

/** Verifica se é Professor Responsável (head professor) */
export function isHeadProfessor(role: string | undefined | null): boolean {
    return role === 'Professor Responsável';
}
