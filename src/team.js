export const knownTeam = [
  {
    name: "Alessandra",
    displayName: "Alessandra",
    email: "alecvilarim@gmail.com",
    role: "admin"
  },
  {
    name: "Thayenne Clemente",
    displayName: "Thay",
    email: "thayanneclemente62@gmail.com",
    role: "seller"
  },
  {
    name: "Natalia Cassia",
    displayName: "Nati",
    email: "nathy.kassia77@gmail.com",
    role: "seller"
  },
  {
    name: "Vinicius Ribeiro",
    displayName: "Vini",
    email: "viniciusribeironetwork@gmail.com",
    role: "seller"
  }
];

export function findKnownUserByEmail(email) {
  return knownTeam.find(user => user.email === String(email || "").toLowerCase());
}

export function sellerDisplayName(user) {
  const knownUser = findKnownUserByEmail(user?.email);
  return knownUser?.displayName || user?.displayName || user?.name || "Vendedor";
}
