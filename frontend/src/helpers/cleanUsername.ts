
export default function cleanUsername(username: string) {
  return username && username.toLowerCase() || '';
}
