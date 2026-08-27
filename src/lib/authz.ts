export function canAccessReturn(ownerId: string, session: { userId: string; role: string }) {
  return session.role === "ADMIN" || ownerId === session.userId || session.role === "TAX_PROFESSIONAL";
}

export function canAccessDocument(ownerId: string, session: { userId: string; role: string }) {
  return canAccessReturn(ownerId, session);
}
