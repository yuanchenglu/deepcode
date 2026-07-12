export function verifyChallenge(body: { challenge?: string }): { challenge: string } | null {
  if (!body.challenge) return null
  return { challenge: body.challenge }
}
